-- Sandstone Document Editing Platform Database Schema
-- PostgreSQL Schema for collaborative document editing with search capabilities

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS AND AUTHENTICATION
-- =============================================

-- Users table (extends Clerk user data)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL, -- Clerk's user ID
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- User preferences
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);



-- User sessions for tracking active sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- DOCUMENTS AND CONTENT
-- =============================================

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT DEFAULT '',
    content_version INTEGER DEFAULT 1,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Document metadata
    description TEXT,
    tags TEXT[], -- Array of tags for categorization
    is_public BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Collaboration settings
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_suggestions BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Search optimization
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
    ) STORED
);

-- Document versions for change tracking
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure version numbers are sequential per document
    UNIQUE(document_id, version_number)
);



-- Document change operations (for operational transforms)
CREATE TABLE document_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL, -- 'insert', 'delete', 'replace'
    position INTEGER NOT NULL,
    length INTEGER DEFAULT 0,
    content TEXT,
    user_id UUID NOT NULL REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sequence_number BIGSERIAL
);

-- =============================================
-- COLLABORATION AND PERMISSIONS
-- =============================================

-- Document collaborators
CREATE TABLE document_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'owner', 'editor', 'viewer', 'commenter'
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure one collaboration record per user per document
    UNIQUE(document_id, user_id)
);

-- User presence (who's currently viewing/editing)
CREATE TABLE user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    cursor_position INTEGER,
    selection_start INTEGER,
    selection_end INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT TRUE,
    
    -- Ensure one presence record per user per document
    UNIQUE(user_id, document_id)
);

-- =============================================
-- COMMENTS AND FEEDBACK
-- =============================================

-- Comments on documents
CREATE TABLE document_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES document_comments(id) ON DELETE CASCADE, -- For threaded comments
    content TEXT NOT NULL,
    position_start INTEGER, -- Character position in document
    position_end INTEGER,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comment reactions
CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES document_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL, -- 'like', 'dislike', 'heart', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one reaction per user per comment
    UNIQUE(comment_id, user_id, reaction_type)
);

-- =============================================
-- SEARCH AND ANALYTICS
-- =============================================

-- Search history
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER,
    clicked_result_id UUID, -- Which result was clicked
    search_duration_ms INTEGER, -- How long the search took
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document analytics
CREATE TABLE document_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'view', 'edit', 'comment', 'share'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search analytics
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Additional search metadata like filters, time taken, etc.
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'comment', 'mention', 'collaboration_invite', 'document_shared'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON document_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old presence records
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
    DELETE FROM user_presence 
    WHERE last_activity < NOW() - INTERVAL '1 hour';
END;
$$ language 'plpgsql';

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for document collaborators with user info
CREATE VIEW document_collaborators_view AS
SELECT 
    dc.document_id,
    dc.user_id,
    dc.permission_level,
    u.email,
    u.first_name,
    u.last_name,
    u.avatar_url,
    dc.accepted_at,
    up.is_online,
    up.last_activity
FROM document_collaborators dc
JOIN users u ON dc.user_id = u.id
LEFT JOIN user_presence up ON dc.user_id = up.user_id AND dc.document_id = up.document_id
WHERE dc.is_active = TRUE;

-- View for document search results
CREATE VIEW document_search_view AS
SELECT 
    d.id,
    d.title,
    d.description,
    d.content,
    d.owner_id,
    u.first_name || ' ' || u.last_name as owner_name,
    d.created_at,
    d.updated_at,
    d.search_vector,
    ts_rank(d.search_vector, plainto_tsquery('english', 'search_term')) as rank
FROM documents d
JOIN users u ON d.owner_id = u.id
WHERE d.is_archived = FALSE;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- User session indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Document indexes
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_updated ON documents(updated_at);
CREATE INDEX idx_documents_public ON documents(is_public);
CREATE INDEX idx_documents_search ON documents USING gin(search_vector);
CREATE INDEX idx_documents_tags ON documents USING gin(tags);
CREATE INDEX idx_documents_owner_updated ON documents(owner_id, updated_at DESC);

-- Document operations indexes
CREATE INDEX idx_document_operations_doc ON document_operations(document_id, sequence_number);
CREATE INDEX idx_document_operations_user ON document_operations(user_id);
CREATE INDEX idx_document_operations_time ON document_operations(timestamp);
CREATE INDEX idx_operations_doc_sequence ON document_operations(document_id, sequence_number);

-- Document version indexes
CREATE INDEX idx_document_versions_doc ON document_versions(document_id, version_number DESC);

-- Collaboration indexes
CREATE INDEX idx_collaborators_doc ON document_collaborators(document_id);
CREATE INDEX idx_collaborators_user ON document_collaborators(user_id);
CREATE INDEX idx_collaborators_permission ON document_collaborators(permission_level);
CREATE INDEX idx_collaborators_doc_permission ON document_collaborators(document_id, permission_level);

-- Presence indexes
CREATE INDEX idx_presence_doc ON user_presence(document_id);
CREATE INDEX idx_presence_user ON user_presence(user_id);
CREATE INDEX idx_presence_activity ON user_presence(last_activity);

-- Comment indexes
CREATE INDEX idx_comments_doc ON document_comments(document_id);
CREATE INDEX idx_comments_user ON document_comments(user_id);
CREATE INDEX idx_comments_parent ON document_comments(parent_comment_id);
CREATE INDEX idx_comments_position ON document_comments(position_start, position_end);
CREATE INDEX idx_comments_doc_position ON document_comments(document_id, position_start, position_end);

-- Reaction indexes
CREATE INDEX idx_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_reactions_user ON comment_reactions(user_id);

-- Search history indexes
CREATE INDEX idx_search_history_user ON search_history(user_id);
CREATE INDEX idx_search_history_time ON search_history(created_at);

-- Analytics indexes
CREATE INDEX idx_analytics_doc ON document_analytics(document_id);
CREATE INDEX idx_analytics_user ON document_analytics(user_id);
CREATE INDEX idx_analytics_action ON document_analytics(action_type);
CREATE INDEX idx_analytics_time ON document_analytics(created_at);

-- Search analytics indexes
CREATE INDEX idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_time ON search_analytics(search_timestamp);
CREATE INDEX idx_search_analytics_query ON search_analytics USING gin(to_tsvector('english', search_query));

-- Notification indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_time ON notifications(created_at);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- =============================================
-- SAMPLE DATA (Optional)
-- =============================================

-- Insert sample user (replace with actual Clerk user ID)
-- INSERT INTO users (clerk_user_id, email, first_name, last_name) 
-- VALUES ('user_2abc123', 'john@example.com', 'John', 'Doe');

-- Insert sample document
-- INSERT INTO documents (title, content, owner_id, description) 
-- VALUES ('Getting Started Guide', 'Welcome to Sandstone...', 
--         (SELECT id FROM users WHERE email = 'john@example.com'), 
--         'A guide to using the platform');

-- =============================================
-- MIGRATION NOTES
-- =============================================

/*
Migration Strategy:
1. Create tables in order of dependencies
2. Add indexes after table creation for better performance
3. Create views after all tables are created
4. Add triggers last to avoid conflicts during data insertion

Performance Considerations:
- Use UUIDs for better distribution in distributed systems
- Implement proper indexing for search and collaboration queries
- Consider partitioning for large tables (documents, operations)
- Use connection pooling for better performance

Security Considerations:
- Implement row-level security (RLS) for multi-tenant scenarios
- Use parameterized queries to prevent SQL injection
- Encrypt sensitive data at rest
- Implement proper access controls at application level
*/
