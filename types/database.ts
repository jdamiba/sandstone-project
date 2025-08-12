// Database Types for Sandstone Document Editing Platform
// These types match the PostgreSQL schema defined in database-schema.sql

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
  is_active: boolean;
  timezone: string;
  language: string;
  notification_preferences: Record<string, any>;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  expires_at: Date;
  is_active: boolean;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  content_version: number;
  owner_id: string;
  owner_name?: string; // Derived field from JOIN with users table
  description?: string;
  tags: string[];
  is_public: boolean;
  is_archived: boolean;
  allow_comments: boolean;
  allow_suggestions: boolean;
  require_approval: boolean;
  created_at: Date;
  updated_at: Date;
  last_edited_at: Date;
  search_vector?: string; // PostgreSQL tsvector
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  change_summary?: string;
  created_by: string;
  created_at: Date;
}

export interface DocumentOperation {
  id: string;
  document_id: string;
  operation_type: "insert" | "delete" | "replace";
  position: number;
  length: number;
  content?: string;
  user_id: string;
  timestamp: Date;
  sequence_number: number;
}

export interface DocumentCollaborator {
  id: string;
  document_id: string;
  user_id: string;
  permission_level: "owner" | "editor" | "viewer" | "commenter";
  invited_by?: string;
  invited_at: Date;
  accepted_at?: Date;
  is_active: boolean;
}

export interface UserPresence {
  id: string;
  user_id: string;
  document_id: string;
  cursor_position?: number;
  selection_start?: number;
  selection_end?: number;
  last_activity: Date;
  is_online: boolean;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  parent_comment_id?: string;
  content: string;
  position_start?: number;
  position_end?: number;
  is_resolved: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  reaction_type: "like" | "dislike" | "heart" | "thumbs_up" | "thumbs_down";
  created_at: Date;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, any>;
  results_count?: number;
  clicked_result_id?: string;
  search_duration_ms?: number;
  created_at: Date;
}

export interface DocumentAnalytics {
  id: string;
  document_id: string;
  user_id: string;
  action_type: "view" | "edit" | "comment" | "share" | "download" | "print";
  metadata: Record<string, any>;
  created_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | "comment"
    | "mention"
    | "collaboration_invite"
    | "document_shared"
    | "version_update";
  title: string;
  message: string;
  related_document_id?: string;
  related_user_id?: string;
  is_read: boolean;
  created_at: Date;
}

// View types for common queries
export interface DocumentCollaboratorView {
  document_id: string;
  user_id: string;
  permission_level: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  accepted_at?: Date;
  is_online?: boolean;
  last_activity?: Date;
}

export interface DocumentSearchView {
  id: string;
  title: string;
  description?: string;
  content: string;
  owner_id: string;
  owner_name: string;
  created_at: Date;
  updated_at: Date;
  search_vector?: string;
  rank?: number;
}

// API Request/Response types
export interface CreateDocumentRequest {
  title: string;
  content?: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
  allow_comments?: boolean;
  allow_suggestions?: boolean;
  require_approval?: boolean;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
  is_public?: boolean;
  allow_comments?: boolean;
  allow_suggestions?: boolean;
  require_approval?: boolean;
}

export interface DocumentChangeRequest {
  changes: Array<{
    type: "insert" | "delete" | "replace";
    position: number;
    length?: number;
    newText?: string;
  }>;
}

export interface SearchRequest {
  query: string;
  documents?: string[]; // Document IDs to search within
  filters?: {
    owner_id?: string;
    tags?: string[];
    is_public?: boolean;
    date_from?: Date;
    date_to?: Date;
  };
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  results: Array<{
    document: Document;
    snippets: Array<{
      text: string;
      position: number;
      highlight: string;
    }>;
    rank: number;
  }>;
  total_count: number;
  search_duration_ms: number;
}

export interface CollaborationInviteRequest {
  document_id: string;
  user_email: string;
  permission_level: "editor" | "viewer" | "commenter";
  message?: string;
}

// WebSocket event types for real-time collaboration
export interface WebSocketEvents {
  "document:join": {
    document_id: string;
    user_id: string;
  };
  "document:leave": {
    document_id: string;
    user_id: string;
  };
  "document:operation": {
    document_id: string;
    operation: DocumentOperation;
  };
  "document:presence": {
    document_id: string;
    presence: UserPresence;
  };
  "document:comment": {
    document_id: string;
    comment: DocumentComment;
  };
  "document:typing": {
    document_id: string;
    user_id: string;
    is_typing: boolean;
  };
}

// Utility types
export type PermissionLevel = "owner" | "editor" | "viewer" | "commenter";
export type OperationType = "insert" | "delete" | "replace";
export type ReactionType =
  | "like"
  | "dislike"
  | "heart"
  | "thumbs_up"
  | "thumbs_down";
export type NotificationType =
  | "comment"
  | "mention"
  | "collaboration_invite"
  | "document_shared"
  | "version_update";
export type AnalyticsActionType =
  | "view"
  | "edit"
  | "comment"
  | "share"
  | "download"
  | "print";

// Database connection and query types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  max_connections?: number;
  idle_timeout?: number;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseError {
  code: string;
  message: string;
  detail?: string;
  hint?: string;
  position?: string;
}
