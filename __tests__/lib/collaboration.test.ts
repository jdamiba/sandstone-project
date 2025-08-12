import { CollaborationManager } from "@/lib/collaboration";

// Mock Socket.IO
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}));

describe("Collaboration Manager", () => {
  let collaboration: CollaborationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    collaboration = new CollaborationManager();
  });

  describe("Connection Management", () => {
    it("should connect to collaboration server", () => {
      expect(mockSocket.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should handle connection events", () => {
      const connectCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )[1];

      connectCallback();

      // Should emit join-document if documentId and userId are set
      collaboration.joinDocument("test-doc", "test-user");
      connectCallback();

      expect(mockSocket.emit).toHaveBeenCalledWith("join-document", {
        documentId: "test-doc",
        userId: "test-user",
      });
    });

    it("should handle disconnection events", () => {
      const disconnectCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "disconnect"
      )[1];

      disconnectCallback();

      // Should clear users and notify
      expect(collaboration.getUsers()).toHaveLength(0);
    });
  });

  describe("Document Management", () => {
    it("should join a document", () => {
      collaboration.joinDocument("test-doc", "test-user");

      expect(mockSocket.emit).toHaveBeenCalledWith("join-document", {
        documentId: "test-doc",
        userId: "test-user",
      });
      expect(collaboration.getDocumentId()).toBe("test-doc");
      expect(collaboration.getUserId()).toBe("test-user");
    });

    it("should leave a document", () => {
      collaboration.joinDocument("test-doc", "test-user");
      collaboration.leaveDocument();

      expect(mockSocket.emit).toHaveBeenCalledWith("leave-document", {
        documentId: "test-doc",
      });
      expect(collaboration.getDocumentId()).toBeNull();
      expect(collaboration.getUserId()).toBeNull();
    });

    it("should send document changes", () => {
      collaboration.joinDocument("test-doc", "test-user");
      collaboration.sendDocumentChange("New content");

      expect(mockSocket.emit).toHaveBeenCalledWith("document-change", {
        documentId: "test-doc",
        userId: "test-user",
        change: {
          newContent: "New content",
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("Cursor Management", () => {
    it("should update cursor position", () => {
      collaboration.joinDocument("test-doc", "test-user");
      collaboration.updateCursor(10, { start: 10, end: 15 }, "Test User");

      expect(mockSocket.emit).toHaveBeenCalledWith("cursor-update", {
        documentId: "test-doc",
        userId: "test-user",
        position: 10,
        selection: { start: 10, end: 15 },
        username: "Test User",
      });
    });

    it("should send typing indicators", () => {
      collaboration.joinDocument("test-doc", "test-user");
      collaboration.sendTypingIndicator();

      expect(mockSocket.emit).toHaveBeenCalledWith("typing-start", {
        documentId: "test-doc",
        userId: "test-user",
      });
    });

    it("should stop typing indicators", () => {
      collaboration.joinDocument("test-doc", "test-user");

      collaboration.stopTyping();

      expect(mockSocket.emit).toHaveBeenCalledWith("typing-stop", {
        documentId: "test-doc",
        userId: "test-user",
      });
    });
  });

  describe("User Management", () => {
    it("should handle user updates", () => {
      const mockUsers = [
        {
          userId: "user1",
          socketId: "socket1",
          name: "User 1",
          color: "#FF0000",
          position: 10,
          isTyping: false,
        },
        {
          userId: "user2",
          socketId: "socket2",
          name: "User 2",
          color: "#00FF00",
          position: 20,
          isTyping: true,
        },
      ];

      const userUpdateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "document-state"
      )[1];

      userUpdateCallback({
        content: "test content",
        version: 1,
        lastEdited: new Date().toISOString(),
        currentUsers: mockUsers,
      });

      expect(collaboration.getUsers()).toHaveLength(2);
    });

    it("should handle user disconnection", () => {
      // Add a user first by triggering document state update
      const documentStateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "document-state"
      )[1];

      documentStateCallback({
        content: "test content",
        version: 1,
        lastEdited: new Date().toISOString(),
        currentUsers: [
          {
            userId: "user1",
            socketId: "socket1",
            name: "User 1",
            color: "#FF0000",
            position: 10,
            isTyping: false,
          },
        ],
      });

      expect(collaboration.getUsers()).toHaveLength(1);

      const disconnectCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "user-left"
      )[1];

      disconnectCallback({
        socketId: "socket1",
        timestamp: new Date().toISOString(),
      });

      // The user should be removed from the users list
      expect(collaboration.getUsers()).toHaveLength(0);
    });
  });

  describe("Performance Tests", () => {
    it("should handle many concurrent users efficiently", () => {
      const startTime = performance.now();

      // Simulate 100 concurrent users by triggering document state updates
      const users = Array.from({ length: 100 }, (_, i) => ({
        userId: `user-${i}`,
        socketId: `socket-${i}`,
        name: `User ${i}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        position: Math.floor(Math.random() * 1000),
        isTyping: Math.random() > 0.5,
      }));

      const documentStateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "document-state"
      )[1];

      documentStateCallback({
        content: "test content",
        version: 1,
        lastEdited: new Date().toISOString(),
        currentUsers: users,
      });

      const endTime = performance.now();

      expect(collaboration.getUsers()).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it("should handle frequent cursor updates efficiently", () => {
      const iterations = 1000;
      const startTime = performance.now();

      collaboration.joinDocument("test-doc", "test-user");

      for (let i = 0; i < iterations; i++) {
        collaboration.updateCursor(i, undefined, "Test User");
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // Average time per cursor update should be less than 1ms
    });

    it("should handle large document changes efficiently", () => {
      const startTime = performance.now();

      // Generate large document content (100KB)
      const largeContent = "Lorem ipsum dolor sit amet. ".repeat(4000);

      collaboration.joinDocument("test-doc", "test-user");

      collaboration.sendDocumentChange(largeContent);

      const endTime = performance.now();

      expect(mockSocket.emit).toHaveBeenCalledWith("document-change", {
        documentId: "test-doc",
        userId: "test-user",
        change: {
          newContent: largeContent,
          timestamp: expect.any(String),
        },
      });
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe("Error Handling", () => {
    it("should handle connection errors gracefully", () => {
      const errorCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect_error"
      )[1];

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      errorCallback(new Error("Connection failed"));

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to connect to collaboration server:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should handle access denied errors", () => {
      const accessDeniedCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "access-denied"
      )[1];

      const mockOnError = jest.fn();
      collaboration.setErrorCallback(mockOnError);

      accessDeniedCallback({ message: "Access denied" });

      expect(mockOnError).toHaveBeenCalledWith("Access denied");
    });
  });

  describe("Benchmark Tests", () => {
    it("benchmark: should handle rapid cursor updates efficiently", () => {
      const iterations = 1000;
      const startTime = performance.now();

      collaboration.joinDocument("test-doc", "test-user");

      for (let i = 0; i < iterations; i++) {
        collaboration.updateCursor(i, { start: i, end: i + 1 }, "Test User");
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.5); // Average time per cursor update should be less than 0.5ms
    });

    it("benchmark: should handle document state updates efficiently", () => {
      const iterations = 100;
      const startTime = performance.now();

      const documentStateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "document-state"
      )[1];

      const mockDocumentState = {
        content: "Test content",
        version: 1,
        lastEdited: new Date().toISOString(),
        currentUsers: Array.from({ length: 10 }, (_, i) => ({
          userId: `user-${i}`,
          socketId: `socket-${i}`,
          username: `User ${i}`,
          position: Math.floor(Math.random() * 100),
          isTyping: false,
        })),
      };

      for (let i = 0; i < iterations; i++) {
        documentStateCallback(mockDocumentState);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(5); // Average time per document state update should be less than 5ms
    });
  });

  describe("Memory Management", () => {
    it("should not leak memory with many users", () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Add many users by triggering document state updates
      const documentStateCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === "document-state"
      )[1];

      const manyUsers = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        socketId: `socket-${i}`,
        name: `User ${i}`,
        color: "#FF0000",
        position: i,
        isTyping: false,
      }));

      documentStateCallback({
        content: "test content",
        version: 1,
        lastEdited: new Date().toISOString(),
        currentUsers: manyUsers,
      });

      // Clear users by leaving document
      collaboration.leaveDocument();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
