import { io, Socket } from "socket.io-client";
import { useState, useEffect } from "react";

export interface CollaborationUser {
  userId: string;
  socketId: string;
  name: string;
  avatar?: string;
  color: string;
  position?: number;
  selection?: { start: number; end: number };
  isTyping?: boolean;
  username?: string;
}

export interface DocumentState {
  content: string;
  version: number;
  lastEdited: string;
}

export class CollaborationManager {
  private socket: Socket | null = null;
  private documentId: string | null = null;
  private userId: string | null = null;
  private users: Map<string, CollaborationUser> = new Map();
  private onUserUpdate?: (users: CollaborationUser[]) => void;
  private onDocumentUpdate?: (state: DocumentState) => void;
  private onError?: (error: string) => void;
  private typingTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.socket = io(
      process.env.NEXT_PUBLIC_COLLABORATION_URL || "http://localhost:3002",
      {
        transports: ["websocket", "polling"],
        timeout: 20000,
        forceNew: true,
        withCredentials: true,
      }
    );
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Connected to collaboration server");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from collaboration server:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("Failed to connect to collaboration server:", error);
      if (this.onError) {
        this.onError(`Connection failed: ${error.message}`);
      }
    });

    this.socket.on(
      "user-joined",
      (data: { userId: string; socketId: string; timestamp: string }) => {
        this.addUser(data.userId, data.socketId);
      }
    );

    this.socket.on(
      "user-left",
      (data: { socketId: string; timestamp: string }) => {
        this.removeUser(data.socketId);
      }
    );

    this.socket.on(
      "cursor-update",
      (data: {
        userId: string;
        socketId: string;
        position: number;
        selection?: { start: number; end: number };
        username?: string;
        timestamp: string;
      }) => {
        this.updateUserCursor(
          data.socketId,
          data.position,
          data.selection,
          data.username
        );
      }
    );

    this.socket.on(
      "typing-start",
      (data: { userId: string; socketId: string }) => {
        this.setUserTyping(data.socketId, true);
      }
    );

    this.socket.on(
      "typing-stop",
      (data: { userId: string; socketId: string }) => {
        this.setUserTyping(data.socketId, false);
      }
    );

    this.socket.on(
      "document-state",
      (
        state: DocumentState & {
          currentUsers?: Array<{
            userId: string;
            socketId: string;
            username?: string;
            position?: number;
            selection?: { start: number; end: number };
            isTyping?: boolean;
          }>;
        }
      ) => {
        if (this.onDocumentUpdate) {
          this.onDocumentUpdate(state);
        }

        // Add existing users to the list
        if (state.currentUsers) {
          state.currentUsers.forEach(
            (userData: {
              userId: string;
              socketId: string;
              username?: string;
              position?: number;
              selection?: { start: number; end: number };
              isTyping?: boolean;
            }) => {
              const colors = [
                "#FF6B6B",
                "#4ECDC4",
                "#45B7D1",
                "#96CEB4",
                "#FFEAA7",
                "#DDA0DD",
                "#98D8C8",
                "#F7DC6F",
                "#BB8FCE",
                "#85C1E9",
              ];

              const user: CollaborationUser = {
                userId: userData.userId,
                socketId: userData.socketId,
                name:
                  userData.username || `User ${userData.userId.slice(0, 8)}`,
                color: colors[Math.floor(Math.random() * colors.length)],
                position: userData.position,
                selection: userData.selection,
                isTyping: userData.isTyping || false,
                username: userData.username,
              };

              this.users.set(userData.socketId, user);
            }
          );
          this.notifyUserUpdate();
        }
      }
    );

    this.socket.on("access-denied", (data: { message: string }) => {
      if (this.onError) {
        this.onError(data.message);
      }
    });

    this.socket.on("error", (data: { message: string }) => {
      if (this.onError) {
        this.onError(data.message);
      }
    });

    // Handle document updates from other users
    this.socket.on(
      "document-updated",
      (data: {
        userId: string;
        socketId: string;
        change: {
          newContent: string;
          version: number;
          timestamp: string;
        };
      }) => {
        console.log("Document updated by another user:", data);
        if (this.onDocumentUpdate) {
          this.onDocumentUpdate({
            content: data.change.newContent,
            version: data.change.version,
            lastEdited: data.change.timestamp,
          });
        }
      }
    );
  }

  public joinDocument(documentId: string, userId: string) {
    this.documentId = documentId;
    this.userId = userId;

    if (this.socket) {
      this.socket.emit("join-document", { documentId, userId });

      // Add the current user to their own users list immediately
      // This ensures their cursor will be visible to others
      const colors = [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E9",
      ];

      const currentUser: CollaborationUser = {
        userId,
        socketId: this.socket.id || "unknown",
        name: `User ${userId.slice(0, 8)}`,
        color: colors[Math.floor(Math.random() * colors.length)],
        isTyping: false,
      };

      this.users.set(this.socket.id || "unknown", currentUser);
      this.notifyUserUpdate();
    }
  }

  public leaveDocument() {
    if (this.socket && this.documentId) {
      this.socket.emit("leave-document", { documentId: this.documentId });
      this.documentId = null;
      this.userId = null;
      this.users.clear();
    }
  }

  public updateCursor(
    position: number,
    selection?: { start: number; end: number },
    username?: string
  ) {
    if (this.socket && this.documentId && this.userId) {
      this.socket.emit("cursor-update", {
        documentId: this.documentId,
        userId: this.userId,
        position,
        selection,
        username,
      });
    }
  }

  public startTyping() {
    if (this.socket && this.documentId && this.userId) {
      this.socket.emit("typing-start", {
        documentId: this.documentId,
        userId: this.userId,
      });

      // Clear existing timeout
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }

      // Set timeout to stop typing indicator
      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 2000);
    }
  }

  public sendTypingIndicator() {
    this.startTyping();
  }

  public stopTyping() {
    if (this.socket && this.documentId && this.userId) {
      this.socket.emit("typing-stop", {
        documentId: this.documentId,
        userId: this.userId,
      });

      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
      }
    }
  }

  public sendDocumentChange(newContent: string) {
    if (this.socket && this.documentId && this.userId) {
      this.socket.emit("document-change", {
        documentId: this.documentId,
        userId: this.userId,
        change: {
          newContent,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  private addUser(userId: string, socketId: string) {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
    ];

    const user: CollaborationUser = {
      userId,
      socketId,
      name: `User ${userId.slice(0, 8)}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      isTyping: false,
    };

    this.users.set(socketId, user);
    this.notifyUserUpdate();
  }

  private removeUser(socketId: string) {
    this.users.delete(socketId);
    this.notifyUserUpdate();
  }

  private updateUserCursor(
    socketId: string,
    position: number,
    selection?: { start: number; end: number },
    username?: string
  ) {
    const user = this.users.get(socketId);
    if (user) {
      user.position = position;
      user.selection = selection;
      if (username) {
        user.username = username;
      }
      this.notifyUserUpdate();
    }
  }

  private setUserTyping(socketId: string, isTyping: boolean) {
    const user = this.users.get(socketId);
    if (user) {
      user.isTyping = isTyping;
      this.notifyUserUpdate();
    }
  }

  private notifyUserUpdate() {
    if (this.onUserUpdate) {
      this.onUserUpdate(Array.from(this.users.values()));
    }
  }

  public setUserUpdateCallback(callback: (users: CollaborationUser[]) => void) {
    this.onUserUpdate = callback;
  }

  public setDocumentUpdateCallback(callback: (state: DocumentState) => void) {
    this.onDocumentUpdate = callback;
  }

  public setErrorCallback(callback: (error: string) => void) {
    this.onError = callback;
  }

  public getDocumentId(): string | null {
    return this.documentId;
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  public getUsers(): CollaborationUser[] {
    return Array.from(this.users.values());
  }
}

// React hook for collaboration
export function useCollaboration() {
  const [collaborationManager] = useState(() => new CollaborationManager());

  useEffect(() => {
    return () => {
      collaborationManager.disconnect();
    };
  }, [collaborationManager]);

  return collaborationManager;
}
