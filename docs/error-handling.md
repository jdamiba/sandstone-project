# Error Handling System

This document describes the comprehensive error handling system implemented across all API endpoints in the document editing application.

## Overview

The error handling system provides:

- **Consistent error responses** with standardized JSON structure
- **Appropriate HTTP status codes** (4xx for client errors, 5xx for server errors)
- **Centralized error management** with reusable error classes and handlers
- **Comprehensive validation** with detailed error messages
- **Database error mapping** for PostgreSQL-specific error codes

## Error Response Structure

All error responses follow this consistent JSON structure:

```json
{
  "error": "Human-readable error message",
  "code": 400,
  "details": {
    "field": "Additional error context"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Response Fields

- **`error`** (string): Human-readable error message
- **`code`** (number): HTTP status code
- **`details`** (object, optional): Additional error context or validation details
- **`timestamp`** (string): ISO 8601 timestamp when the error occurred

## Error Classes

### Client Errors (4xx)

| Class                  | Status Code | Description                                   |
| ---------------------- | ----------- | --------------------------------------------- |
| `BadRequestError`      | 400         | Invalid request format or parameters          |
| `UnauthorizedError`    | 401         | Authentication required or failed             |
| `ForbiddenError`       | 403         | Access denied due to insufficient permissions |
| `NotFoundError`        | 404         | Requested resource not found                  |
| `ConflictError`        | 409         | Resource conflict (e.g., duplicate entry)     |
| `ValidationError`      | 422         | Request validation failed                     |
| `TooManyRequestsError` | 429         | Rate limit exceeded                           |

### Server Errors (5xx)

| Class                     | Status Code | Description                     |
| ------------------------- | ----------- | ------------------------------- |
| `InternalServerError`     | 500         | Unexpected server error         |
| `ServiceUnavailableError` | 503         | Service temporarily unavailable |

## Usage Examples

### Creating Custom Errors

```typescript
import { BadRequestError, ValidationError, NotFoundError } from "@/lib/errors";

// Basic error
throw new BadRequestError("Invalid input");

// Error with additional details
throw new ValidationError("Validation failed", {
  field: "email",
  reason: "Invalid format",
});

// Resource not found
throw new NotFoundError("Document not found");
```

### Validation Functions

```typescript
import {
  validateString,
  validateUUID,
  validateArray,
  validateBoolean,
} from "@/lib/errors";

// String validation
validateString(value, "fieldName", 1, 255); // min: 1, max: 255

// UUID validation
validateUUID(id, "documentId");

// Array validation
validateArray(tags, "tags", (tag, index) => {
  validateString(tag, `tags[${index}]`, 1, 50);
});

// Boolean validation
validateBoolean(isPublic, "isPublic");
```

### Database Error Handling

```typescript
import { handleDatabaseError } from "@/lib/errors";

try {
  const result = await pool.query(query, params);
  return result.rows[0];
} catch (error) {
  throw handleDatabaseError(error);
}
```

## Database Error Mapping

The system automatically maps PostgreSQL error codes to appropriate HTTP status codes:

| PostgreSQL Code           | HTTP Status | Error Type                | Description                      |
| ------------------------- | ----------- | ------------------------- | -------------------------------- |
| `23505`                   | 409         | `ConflictError`           | Unique constraint violation      |
| `23503`                   | 400         | `BadRequestError`         | Foreign key constraint violation |
| `23502`                   | 422         | `ValidationError`         | Not null constraint violation    |
| `23514`                   | 422         | `ValidationError`         | Check constraint violation       |
| `42P01`                   | 500         | `InternalServerError`     | Undefined table                  |
| `42P02`                   | 500         | `InternalServerError`     | Undefined column                 |
| `08000`, `08003`, `08006` | 503         | `ServiceUnavailableError` | Connection errors                |

## API Middleware Integration

The error handling system is integrated into API routes through middleware:

```typescript
import { withAuth, withErrorHandling } from "@/lib/api-middleware";

// Basic error handling
export const GET = withErrorHandling(async (req: NextRequest) => {
  // Your API logic here
  // Any thrown errors will be automatically formatted
});

// Authentication + error handling
export const POST = withAuth(async (req: NextRequest, context: any) => {
  // Your authenticated API logic here
});
```

## Validation Examples

### Document Creation Validation

```typescript
function validateCreateDocument(body: any): CreateDocumentRequest {
  validateString(body.title, "title", 1, 255);

  if (body.content !== undefined) {
    validateString(body.content, "content", 0, 1000000); // 1MB max
  }

  if (body.tags !== undefined) {
    validateArray(body.tags, "tags", (tag, index) => {
      validateString(tag, `tags[${index}]`, 1, 50);
    });
  }

  if (body.is_public !== undefined) {
    validateBoolean(body.is_public, "is_public");
  }

  return {
    title: body.title.trim(),
    content: body.content || "",
    tags: body.tags || [],
    is_public: body.is_public || false,
  };
}
```

### Change Request Validation

```typescript
function validateChangeRequest(body: any): ChangeRequest {
  validateString(body.textToReplace, "textToReplace", 0, 1000000);
  validateString(body.newText, "newText", 0, 1000000);

  return {
    textToReplace: body.textToReplace,
    newText: body.newText,
  };
}
```

## Error Response Examples

### 400 Bad Request

```json
{
  "error": "Title is required",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required",
  "code": 401,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied",
  "code": 403,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 404 Not Found

```json
{
  "error": "Document not found",
  "code": 404,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 422 Validation Error

```json
{
  "error": "Validation failed",
  "code": 422,
  "details": {
    "field": "email",
    "reason": "Invalid format"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 500 Internal Server Error

```json
{
  "error": "Database operation failed",
  "code": 500,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing

The error handling system includes comprehensive tests:

```bash
# Run error handling tests
npm test -- --testNamePattern="Error Handling System"

# Run all tests
npm test
```

### Test Coverage

- Error class instantiation and properties
- Error response formatting
- Validation function behavior
- Database error mapping
- Response structure consistency

## Best Practices

### 1. Use Specific Error Types

```typescript
// Good
throw new ValidationError("Invalid email format");

// Avoid
throw new Error("Invalid email format");
```

### 2. Include Relevant Details

```typescript
// Good
throw new ValidationError("Validation failed", {
  field: "email",
  value: email,
  reason: "Invalid format",
});

// Avoid
throw new ValidationError("Validation failed");
```

### 3. Handle Database Errors

```typescript
// Good
try {
  const result = await pool.query(query, params);
  return result.rows[0];
} catch (error) {
  throw handleDatabaseError(error);
}

// Avoid
try {
  const result = await pool.query(query, params);
  return result.rows[0];
} catch (error) {
  throw new Error("Database error");
}
```

### 4. Validate Input Early

```typescript
// Good
export const POST = withAuth(async (req: NextRequest, context: any) => {
  const body = await req.json();
  const validatedBody = validateCreateDocument(body);
  // Process validated data...
});

// Avoid
export const POST = withAuth(async (req: NextRequest, context: any) => {
  const body = await req.json();
  // Process data without validation...
});
```

## Integration with Frontend

The frontend can handle these error responses consistently:

```typescript
async function createDocument(data: CreateDocumentRequest) {
  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Handle specific error types
      switch (errorData.code) {
        case 400:
          showValidationError(errorData.error, errorData.details);
          break;
        case 401:
          redirectToLogin();
          break;
        case 403:
          showAccessDeniedError();
          break;
        case 404:
          showNotFoundError();
          break;
        default:
          showGenericError(errorData.error);
      }

      return;
    }

    return await response.json();
  } catch (error) {
    showNetworkError();
  }
}
```

## Monitoring and Logging

Error responses include timestamps for monitoring:

```typescript
// Log errors for monitoring
console.error("API Error:", {
  timestamp: errorResponse.timestamp,
  code: errorResponse.code,
  message: errorResponse.error,
  details: errorResponse.details,
  requestId: req.headers.get("x-request-id"),
});
```

This comprehensive error handling system ensures consistent, informative, and actionable error responses across all API endpoints.
