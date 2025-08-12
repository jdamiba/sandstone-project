// Centralized error handling for the application

export interface ApiError {
  error: string;
  code: number;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public code: number;
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code || statusCode;
    this.details = details;
  }
}

// Client Errors (4xx)
export class BadRequestError extends AppError {
  constructor(
    message: string = "Bad Request",
    details?: Record<string, unknown>
  ) {
    super(message, 400, 400, details);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Unauthorized",
    details?: Record<string, unknown>
  ) {
    super(message, 401, 401, details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message: string = "Forbidden",
    details?: Record<string, unknown>
  ) {
    super(message, 403, 403, details);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = "Not Found",
    details?: Record<string, unknown>
  ) {
    super(message, 404, 404, details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict", details?: Record<string, unknown>) {
    super(message, 409, 409, details);
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = "Validation Error",
    details?: Record<string, unknown>
  ) {
    super(message, 422, 422, details);
    this.name = "ValidationError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = "Too Many Requests",
    details?: Record<string, unknown>
  ) {
    super(message, 429, 429, details);
    this.name = "TooManyRequestsError";
  }
}

// Server Errors (5xx)
export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal Server Error",
    details?: Record<string, unknown>
  ) {
    super(message, 500, 500, details);
    this.name = "InternalServerError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service Unavailable",
    details?: Record<string, unknown>
  ) {
    super(message, 503, 503, details);
    this.name = "ServiceUnavailableError";
  }
}

// Error response formatter
export function formatErrorResponse(error: AppError | Error): ApiError {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle generic errors
  return {
    error: error.message || "An unexpected error occurred",
    code: 500,
    timestamp: new Date().toISOString(),
  };
}

// Validation helpers
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === "") {
    throw new ValidationError(`${fieldName} is required`);
  }
}

export function validateString(
  value: unknown,
  fieldName: string,
  minLength?: number,
  maxLength?: number
): void {
  validateRequired(value, fieldName);

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (minLength !== undefined && value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters long`
    );
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be no more than ${maxLength} characters long`
    );
  }
}

export function validateUUID(value: unknown, fieldName: string): void {
  validateRequired(value, fieldName);

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
}

export function validateArray(
  value: unknown,
  fieldName: string,
  itemValidator?: (item: unknown, index: number) => void
): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (itemValidator) {
    value.forEach((item, index) => {
      try {
        itemValidator(item, index);
      } catch (error) {
        if (error instanceof AppError) {
          throw new ValidationError(`${fieldName}[${index}]: ${error.message}`);
        }
        throw error;
      }
    });
  }
}

export function validateBoolean(value: unknown, fieldName: string): void {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${fieldName} must be a boolean`);
  }
}

export function validateInteger(
  value: unknown,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new ValidationError(`${fieldName} must be a string or number`);
  }

  const num = parseInt(String(value));
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a valid integer`);
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`${fieldName} must be no more than ${max}`);
  }
}

// Database error handlers
export function handleDatabaseError(error: unknown): AppError {
  console.error("Database error:", error);

  // PostgreSQL specific error codes
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    switch (error.code) {
      case "23505": // unique_violation
        return new ConflictError("Resource already exists");
      case "23503": // foreign_key_violation
        return new BadRequestError("Referenced resource does not exist");
      case "23502": // not_null_violation
        return new ValidationError("Required field is missing");
      case "23514": // check_violation
        return new ValidationError("Data validation failed");
      case "42P01": // undefined_table
        return new InternalServerError("Database schema error");
      case "42P02": // undefined_column
        return new InternalServerError("Database schema error");
      case "08000": // connection_exception
      case "08003": // connection_does_not_exist
      case "08006": // connection_failure
        return new ServiceUnavailableError("Database connection failed");
      default:
        return new InternalServerError("Database operation failed");
    }
  }

  return new InternalServerError("Database operation failed");
}

// Authentication error handlers
export function handleAuthError(error: unknown): AppError {
  console.error("Authentication error:", error);

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    if (error.message.includes("token")) {
      return new UnauthorizedError("Invalid or expired token");
    }

    if (error.message.includes("permission")) {
      return new ForbiddenError("Insufficient permissions");
    }
  }

  return new UnauthorizedError("Authentication failed");
}

// Rate limiting error handler
export function handleRateLimitError(): AppError {
  return new TooManyRequestsError(
    "Rate limit exceeded. Please try again later."
  );
}

// Generic error handler for API routes
export function handleApiError(error: unknown): AppError {
  console.error("API error:", error);

  // If it's already an AppError, return it
  if (error instanceof AppError) {
    return error;
  }

  // Handle specific error types
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    "message" in error
  ) {
    const errorObj = error as { name: string; message: string };

    if (errorObj.name === "ValidationError") {
      return new ValidationError(errorObj.message);
    }

    if (errorObj.name === "TypeError" && errorObj.message.includes("fetch")) {
      return new ServiceUnavailableError("External service unavailable");
    }
  }

  // Default to internal server error
  return new InternalServerError("An unexpected error occurred");
}
