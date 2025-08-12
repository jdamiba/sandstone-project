# Document Editing Application

A modern, real-time collaborative document editing platform built with Next.js, featuring Google Docs-style collaboration, intelligent text diffing, and full-text search capabilities.

## 🚀 Features

- **Real-time Collaboration**: Google Docs-style cursor tracking and live editing
- **Intelligent Text Diffing**: Minimal change detection for efficient updates
- **Full-text Search**: PostgreSQL-powered search with ranking and filters
- **Authentication**: Secure user management with Clerk
- **Public/Private Documents**: Flexible document sharing and permissions
- **Performance Optimized**: Efficient text processing and database queries
- **Comprehensive Testing**: Unit tests, integration tests, and performance benchmarks

## 🏗️ Architecture

### Frontend

- **Next.js 15** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time collaboration

### Backend

- **Next.js API Routes** for RESTful endpoints
- **PostgreSQL** with Neon for database
- **Clerk** for authentication and user management
- **Socket.IO Server** for real-time collaboration

### Key Components

- **Document Editor**: Rich text editing with collaboration
- **Search Engine**: Full-text search with PostgreSQL tsvector
- **Text Diff Engine**: Intelligent change detection
- **Collaboration Manager**: Real-time cursor and content sync

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Clerk account for authentication
- Railway account (for collaboration server)

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd sandstone-v1
npm install
```

### 2. Environment Configuration

Create a `.env.local` file:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Collaboration Server
NEXT_PUBLIC_COLLABORATION_URL="http://localhost:3002"

# Development
NODE_ENV="development"
```

### 3. Database Setup

#### Option A: Using the provided script

```bash
npm run db:init
```

#### Option B: Manual setup

1. Create a PostgreSQL database
2. Run the SQL schema from `database-schema.sql`
3. Execute the initialization script:

```bash
npx tsx scripts/init-database.ts
```

### 4. Collaboration Server

Deploy the collaboration server to Railway:

```bash
# Deploy to Railway
railway login
railway link
railway up
```

Or run locally:

```bash
cd server
npm install
npm start
```

### 5. Start Development

```bash
# Start the main application
npm run dev

# Start collaboration server (in another terminal)
cd server && npm start
```

## 🎯 Usage Examples

### Creating a Document

```typescript
// Create a new document
const response = await fetch("/api/documents", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "My Document",
    content: "Initial content",
    description: "A sample document",
    tags: ["sample", "test"],
    is_public: true,
  }),
});

const { document } = await response.json();
```

### Real-time Collaboration

```typescript
// Join document collaboration
const collaboration = useCollaboration();
collaboration.joinDocument(documentId, userId);

// Send cursor updates
collaboration.updateCursor(position, selection, username);

// Send content changes
collaboration.sendDocumentChange(newContent);
```

### Applying Text Changes

```typescript
// Apply minimal text changes (single change)
const changes = generateChangeRequests(oldText, newText);

for (const change of changes) {
  await fetch(`/api/documents/${documentId}/changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      textToReplace: change.textToReplace,
      newText: change.newText,
    }),
  });
}

// Apply multiple changes in one request (new feature)
await fetch(`/api/documents/${documentId}/changes`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    changes: [
      {
        textToReplace: "Hello",
        newText: "Hi",
      },
      {
        textToReplace: "world",
        newText: "universe",
      },
      {
        textToReplace: "old",
        newText: "new",
      },
    ],
  }),
});
```

### Full-text Search

```typescript
// Search documents
const searchResults = await fetch("/api/search?q=search+term&public=true");

// Search by tags
const tagResults = await fetch("/api/search?tags=sample,test");
```

## 🔧 API Design Rationale

### RESTful Endpoints

The API follows REST principles with clear resource-based URLs:

```
GET    /api/documents          # List documents
POST   /api/documents          # Create document
GET    /api/documents/:id      # Get document
PUT    /api/documents/:id      # Update document
DELETE /api/documents/:id      # Delete document
POST   /api/documents/:id/changes  # Apply text changes
GET    /api/search             # Search documents
```

### Change Request API

Instead of replacing entire document content, the API uses a change request system that supports both single and multiple changes:

**Single Change:**

```json
{
  "textToReplace": "old text",
  "newText": "new text"
}
```

**Multiple Changes:**

```json
{
  "changes": [
    {
      "textToReplace": "Hello",
      "newText": "Hi"
    },
    {
      "textToReplace": "world",
      "newText": "universe"
    }
  ]
}
```

**Benefits:**

- **Efficiency**: Only changed text is transmitted
- **Batch Processing**: Apply multiple changes in one request
- **Conflict Resolution**: Easier to merge concurrent changes
- **Audit Trail**: Track specific changes over time
- **Performance**: Reduced bandwidth and processing
- **Backward Compatibility**: Existing single-change requests still work

### Authentication Strategy

Uses Clerk for authentication with session-based tokens:

```bash
# Include session token in requests
curl -H "Cookie: __session=YOUR_TOKEN" /api/documents
```

**Benefits:**

- **Security**: JWT-based tokens with expiration
- **User Management**: Built-in user profiles and permissions
- **Webhooks**: Automatic user sync via webhooks
- **Multi-platform**: Works across web, mobile, and desktop

## ⚡ Performance Considerations

### Text Diffing Algorithm

The application uses an intelligent diffing algorithm that:

1. **Finds minimal changes**: Identifies the smallest text differences
2. **Word-level optimization**: Groups changes by words when possible
3. **Character-level fallback**: Handles complex changes at character level
4. **Performance benchmarks**: Processes 10MB files in <200ms

```typescript
// Example: Efficient change detection
const changes = generateChangeRequests(
  "I love reading books",
  "I love reading emails"
);
// Returns: [{ textToReplace: "books", newText: "emails", position: 13 }]
```

### Database Optimization

- **Full-text search**: PostgreSQL tsvector for fast text search
- **Indexed queries**: Proper indexes on frequently queried columns
- **Connection pooling**: Efficient database connection management
- **Query optimization**: Minimal database round trips

### Real-time Collaboration

- **Debounced updates**: 500ms delay to reduce server load
- **Cursor optimization**: Updates only when typing stops
- **Connection management**: Automatic reconnection and error handling
- **Memory management**: Efficient user tracking and cleanup

### Caching Strategy

- **Browser caching**: Static assets cached appropriately
- **API response caching**: Cache frequently accessed documents
- **Search result caching**: Cache search results for common queries

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="Text Diff"
npm test -- --testNamePattern="Collaboration"

# Performance benchmarks
npm run test:performance

# Coverage report
npm run test:coverage
```

### Test Coverage

- **Unit Tests**: Core logic and utilities
- **Integration Tests**: API endpoints and database operations
- **Performance Tests**: Load testing and benchmarks
- **Collaboration Tests**: Real-time features

## 🚀 Deployment

### Vercel Deployment

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Environment Variables**: Set all required environment variables
3. **Build Settings**: Vercel automatically detects Next.js
4. **Deploy**: Push to main branch triggers deployment

### Railway Deployment (Collaboration Server)

```bash
# Deploy collaboration server
cd server
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3002
```

### Database Migration

```bash
# Run database migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

## 📊 Monitoring and Analytics

### Performance Monitoring

- **Response times**: Track API endpoint performance
- **Error rates**: Monitor application errors
- **User activity**: Track document views and edits
- **Collaboration metrics**: Monitor real-time usage

### Analytics Endpoints

```typescript
// Track document views
await fetch("/api/analytics/view", {
  method: "POST",
  body: JSON.stringify({
    documentId: "doc-id",
    userId: "user-id",
    actionType: "view",
    metadata: { referrer: "search" },
  }),
});
```

## 🔒 Security

### Authentication & Authorization

- **Session-based auth**: Secure token management
- **Permission checks**: Document-level access control
- **Input validation**: Sanitize all user inputs
- **SQL injection prevention**: Parameterized queries

### Data Protection

- **Encryption**: Sensitive data encrypted at rest
- **HTTPS**: All communications encrypted
- **CORS**: Proper cross-origin resource sharing
- **Rate limiting**: Prevent abuse and DDoS

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes**: Follow the coding standards
4. **Run tests**: Ensure all tests pass
5. **Submit PR**: Create a pull request with description

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Conventional Commits**: Standardized commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

1. **Collaboration server connection fails**

   - Check if Railway deployment is running
   - Verify `NEXT_PUBLIC_COLLABORATION_URL` environment variable

2. **Database connection errors**

   - Verify `DATABASE_URL` is correct
   - Check if database is accessible
   - Run database initialization script

3. **Authentication issues**
   - Verify Clerk configuration
   - Check webhook endpoints
   - Ensure session tokens are valid

### Getting Help

- **Documentation**: Check the [docs](docs/) folder
- **Issues**: Create a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: Contact the maintainers

## 🎉 Acknowledgments

- **Clerk** for authentication services
- **Neon** for PostgreSQL hosting
- **Railway** for collaboration server hosting
- **Vercel** for frontend hosting
- **Socket.IO** for real-time communication
- **Next.js** for the amazing framework

---

Built with ❤️ for collaborative document editing
