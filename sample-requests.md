# Sample API Requests for Document Editing Application

This document contains sample requests for testing all API endpoints in the document editing application.

## Base URL

```
http://localhost:3000
```

## Authentication

Most endpoints require authentication via Clerk. Include the session token in your requests.

## 1. User Management

### Get Current User

```bash
curl -X GET "http://localhost:3000/api/user" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Get User Profile

```bash
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

## 2. Document Management

### Create New Document

```bash
curl -X POST "http://localhost:3000/api/documents" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Sample Document",
    "content": "This is the initial content of the document.",
    "description": "A sample document for testing",
    "tags": ["sample", "test", "document"],
    "is_public": true,
    "allow_comments": true,
    "allow_suggestions": false,
    "require_approval": false
  }'
```

### Get All Documents

```bash
curl -X GET "http://localhost:3000/api/documents" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Get Documents (Public Only)

```bash
curl -X GET "http://localhost:3000/api/documents?public=true" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Get Single Document

```bash
curl -X GET "http://localhost:3000/api/documents/DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Update Document Metadata

```bash
curl -X PUT "http://localhost:3000/api/documents/DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Updated Document Title",
    "description": "Updated description",
    "tags": ["updated", "tags"],
    "is_public": false,
    "allow_comments": true,
    "allow_suggestions": true,
    "require_approval": true
  }'
```

### Delete Document

```bash
curl -X DELETE "http://localhost:3000/api/documents/DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

## 3. Document Content Changes

### Apply Single Text Change

```bash
curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "textToReplace": "old text",
    "newText": "new text"
  }'
```

### Apply Multiple Text Changes (New Feature)

```bash
curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "changes": [
      {
        "textToReplace": "Hello",
        "newText": "Hi"
      },
      {
        "textToReplace": "world",
        "newText": "universe"
      },
      {
        "textToReplace": "old",
        "newText": "new"
      }
    ]
  }'
```

### Multiple Text Changes Example (Sequential vs Batch)

```bash
# Sequential approach (multiple requests)
curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "textToReplace": "Hello",
    "newText": "Hi"
  }'

curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "textToReplace": "world",
    "newText": "universe"
  }'

# Batch approach (single request - more efficient)
curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
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
  }'
```

## 4. Search Functionality

### Search Documents

```bash
curl -X GET "http://localhost:3000/api/search?q=search+term" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Search with Filters

```bash
curl -X GET "http://localhost:3000/api/search?q=search+term&public=true&limit=10&offset=0" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Search by Tags

```bash
curl -X GET "http://localhost:3000/api/search?tags=sample,test" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

## 5. Collaboration

### Join Document Collaboration

```bash
curl -X POST "http://localhost:3000/api/collaboration/join" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "documentId": "DOCUMENT_ID",
    "userId": "USER_ID"
  }'
```

### Leave Document Collaboration

```bash
curl -X POST "http://localhost:3000/api/collaboration/leave" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "documentId": "DOCUMENT_ID"
  }'
```

## 6. Webhooks

### Clerk Webhook (User Events)

```bash
curl -X POST "http://localhost:3000/api/webhooks/clerk" \
  -H "Content-Type: application/json" \
  -H "svix-id: WEBHOOK_ID" \
  -H "svix-timestamp: TIMESTAMP" \
  -H "svix-signature: SIGNATURE" \
  -d '{
    "type": "user.created",
    "data": {
      "id": "user_123",
      "first_name": "John",
      "last_name": "Doe",
      "email_addresses": [
        {
          "email_address": "john@example.com",
          "id": "email_123"
        }
      ],
      "created_at": 1234567890
    }
  }'
```

## 7. Analytics

### Track Document View

```bash
curl -X POST "http://localhost:3000/api/analytics/view" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "documentId": "DOCUMENT_ID",
    "userId": "USER_ID",
    "actionType": "view",
    "metadata": {
      "referrer": "search",
      "sessionDuration": 300
    }
  }'
```

### Track Document Edit

```bash
curl -X POST "http://localhost:3000/api/analytics/edit" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "documentId": "DOCUMENT_ID",
    "userId": "USER_ID",
    "actionType": "edit",
    "metadata": {
      "changes": 5,
      "contentLength": 1500,
      "editDuration": 120
    }
  }'
```

## 8. Error Handling Examples

### Invalid Document ID

```bash
curl -X GET "http://localhost:3000/api/documents/invalid-id" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

### Unauthorized Access

```bash
curl -X PUT "http://localhost:3000/api/documents/DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Unauthorized Update"
  }'
```

### Invalid Change Request

```bash
curl -X POST "http://localhost:3000/api/documents/DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "textToReplace": "text that does not exist",
    "newText": "new text"
  }'
```

## 9. Complete Workflow Example

Here's a complete workflow example:

```bash
# 1. Create a new document
CREATE_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/documents" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Workflow Test Document",
    "content": "Initial content for testing the workflow.",
    "description": "A document to test the complete API workflow",
    "tags": ["workflow", "test"],
    "is_public": true
  }')

# Extract document ID from response
DOCUMENT_ID=$(echo $CREATE_RESPONSE | jq -r '.document.id')

echo "Created document with ID: $DOCUMENT_ID"

# 2. Get the document
curl -X GET "http://localhost:3000/api/documents/$DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"

# 3. Apply some changes
curl -X POST "http://localhost:3000/api/documents/$DOCUMENT_ID/changes" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "textToReplace": "Initial content",
    "newText": "Updated content"
  }'

# 4. Search for the document
curl -X GET "http://localhost:3000/api/search?q=workflow" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"

# 5. Update document metadata
curl -X PUT "http://localhost:3000/api/documents/$DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN" \
  -d '{
    "title": "Updated Workflow Test Document",
    "description": "Updated description after workflow test"
  }'

# 6. Delete the document
curl -X DELETE "http://localhost:3000/api/documents/$DOCUMENT_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=YOUR_SESSION_TOKEN"
```

## 10. Environment Variables

Make sure you have these environment variables set:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Collaboration Server
NEXT_PUBLIC_COLLABORATION_URL="http://localhost:3002"

# Webhook Secret
CLERK_WEBHOOK_SECRET="whsec_..."
```

## 11. Testing Tips

1. **Use jq for JSON parsing**: Install jq to easily parse JSON responses
2. **Save session tokens**: Store your session token in a variable for reuse
3. **Check response codes**: Always verify the HTTP status codes
4. **Use verbose mode**: Add `-v` flag to see full request/response details
5. **Test error cases**: Try invalid IDs, missing fields, etc.

## 12. Common Response Formats

### Success Response

```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "content": "Document content",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

### Search Response

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Document Title",
      "content": "Document content",
      "rank": 0.85
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```
