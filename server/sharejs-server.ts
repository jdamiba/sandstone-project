import { createServer } from "http";
import { Server } from "socket.io";
import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create database pool with proper SSL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
console.log("Testing database connection...");
pool
  .query("SELECT NOW() as current_time")
  .then((result: any) => {
    console.log("Database connection successful:", result.rows[0]);

    // List all documents to verify data
    return pool.query("SELECT id, title, is_public FROM documents LIMIT 5");
  })
  .then((result: any) => {
    console.log("Available documents:", result.rows);
  })
  .catch((error: any) => {
    console.error("Database connection failed:", error);
  });

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
    );
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "https://your-app.vercel.app",
      "https://your-app.railway.app",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// Simple document state management (we'll add ShareDB later)
const documentStates = new Map<
  string,
  {
    content: string;
    version: number;
    users: Set<string>;
  }
>();

// Track users and their cursor positions
const userStates = new Map<
  string,
  {
    userId: string;
    socketId: string;
    position?: number;
    selection?: { start: number; end: number };
    username?: string;
    isTyping: boolean;
  }
>();

// Simple document state management
function getOrCreateDocumentState(documentId: string) {
  if (!documentStates.has(documentId)) {
    documentStates.set(documentId, {
      content: "",
      version: 0,
      users: new Set(),
    });
  }
  return documentStates.get(documentId)!;
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  console.log("Client origin:", socket.handshake.headers.origin);

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  // Join document room
  socket.on("join-document", async (data) => {
    const { documentId, userId } = data;
    console.log(`User ${userId} attempting to join document ${documentId}`);

    // Verify user has access to document
    try {
      // First, let's check what document we're looking for
      const documentCheckQuery = `SELECT d.*, d.owner_id, d.is_public FROM documents d WHERE d.id = $1`;
      const documentCheck = await pool.query(documentCheckQuery, [documentId]);

      if (documentCheck.rows.length === 0) {
        console.log(`Document ${documentId} not found`);
        socket.emit("access-denied", { message: "Document not found" });
        return;
      }

      const docInfo = documentCheck.rows[0];
      console.log(
        `Document ${documentId}: owner_id=${docInfo.owner_id}, is_public=${docInfo.is_public}`
      );
      console.log(
        `User ${userId} attempting to access document owned by ${docInfo.owner_id}`
      );

      // Check if the user exists in our database
      const userCheckQuery = `SELECT id, clerk_user_id FROM users WHERE id = $1`;
      const userCheck = await pool.query(userCheckQuery, [userId]);
      console.log(
        `User check for ${userId}:`,
        userCheck.rows.length > 0 ? "EXISTS" : "NOT FOUND"
      );
      if (userCheck.rows.length > 0) {
        console.log(
          `User details: id=${userCheck.rows[0].id}, clerk_user_id=${userCheck.rows[0].clerk_user_id}`
        );
      }

      const accessQuery = `
        SELECT d.* FROM documents d
        WHERE d.id = $1 AND (
          d.owner_id = $2 OR 
          d.is_public = TRUE OR
          EXISTS (
            SELECT 1 FROM document_collaborators 
            WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
          )
        )
      `;

      const result = await pool.query(accessQuery, [documentId, userId]);
      console.log(
        `Access check result for user ${userId} on document ${documentId}:`,
        result.rows.length > 0 ? "ACCESS GRANTED" : "ACCESS DENIED"
      );

      if (result.rows.length === 0) {
        console.log(
          `Access denied for user ${userId} on document ${documentId}`
        );
        socket.emit("access-denied", { message: "Access denied to document" });
        return;
      }

      // Join the document room
      socket.join(`document-${documentId}`);

      // Send current document state
      const document = result.rows[0];
      const docState = getOrCreateDocumentState(documentId);
      docState.content = document.content;
      docState.version = document.content_version;
      docState.users.add(socket.id);

      // Send current users list to the new user
      const currentUsers = Array.from(docState.users)
        .filter((socketId) => socketId !== socket.id) // Don't include the new user
        .map((socketId) => {
          const userState = userStates.get(socketId);
          return {
            socketId,
            userId: userState?.userId || socketId,
            position: userState?.position,
            selection: userState?.selection,
            username: userState?.username,
            isTyping: userState?.isTyping || false,
            timestamp: new Date().toISOString(),
          };
        });

      socket.emit("document-state", {
        content: document.content,
        version: document.content_version,
        lastEdited: document.last_edited_at,
        currentUsers,
      });

      // Notify other users in the room about the new user
      socket.to(`document-${documentId}`).emit("user-joined", {
        userId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      console.log(`User ${userId} joined document ${documentId}`);
    } catch (error) {
      console.error("Error joining document:", error);
      socket.emit("error", { message: "Failed to join document" });
    }
  });

  // Handle cursor position updates
  socket.on("cursor-update", (data) => {
    const { documentId, position, selection, username } = data;

    // Store the cursor position for this user
    userStates.set(socket.id, {
      userId: data.userId,
      socketId: socket.id,
      position,
      selection,
      username,
      isTyping: userStates.get(socket.id)?.isTyping || false,
    });

    // Broadcast to other users
    socket.to(`document-${documentId}`).emit("cursor-update", {
      userId: data.userId,
      socketId: socket.id,
      position,
      selection,
      username,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle typing indicators
  socket.on("typing-start", (data) => {
    const { documentId } = data;

    // Store typing state
    const currentState = userStates.get(socket.id);
    if (currentState) {
      currentState.isTyping = true;
      userStates.set(socket.id, currentState);
    }

    socket.to(`document-${documentId}`).emit("typing-start", {
      userId: data.userId,
      socketId: socket.id,
    });
  });

  socket.on("typing-stop", (data) => {
    const { documentId } = data;

    // Store typing state
    const currentState = userStates.get(socket.id);
    if (currentState) {
      currentState.isTyping = false;
      userStates.set(socket.id, currentState);
    }

    socket.to(`document-${documentId}`).emit("typing-stop", {
      userId: data.userId,
      socketId: socket.id,
    });
  });

  // Handle document content changes
  socket.on("document-change", async (data) => {
    const { documentId, userId, change } = data;
    console.log(
      `Document change from user ${userId} on document ${documentId}:`,
      change
    );

    try {
      // Update the document in the database
      const updateQuery = `
        UPDATE documents 
        SET content = $1, updated_at = NOW(), last_edited_at = NOW(), content_version = content_version + 1
        WHERE id = $2
      `;

      await pool.query(updateQuery, [change.newContent, documentId]);

      // Update local state
      const docState = getOrCreateDocumentState(documentId);
      docState.content = change.newContent;
      docState.version += 1;

      // Broadcast the change to all other users in the document room
      socket.to(`document-${documentId}`).emit("document-updated", {
        userId,
        socketId: socket.id,
        change: {
          newContent: change.newContent,
          version: docState.version,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(
        `Document ${documentId} updated by user ${userId}, version ${docState.version}`
      );
    } catch (error) {
      console.error("Error updating document:", error);
      socket.emit("error", { message: "Failed to update document" });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Remove user from all document states
    documentStates.forEach((docState, documentId) => {
      if (docState.users.has(socket.id)) {
        docState.users.delete(socket.id);

        // Notify other users in the document
        socket.to(`document-${documentId}`).emit("user-left", {
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Clean up user state
    userStates.delete(socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Collaboration server running on port ${PORT}`);
});

export { io };
