import { NextRequest } from "next/server";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
  formatErrorResponse,
  handleDatabaseError,
  validateString,
  validateUUID,
  validateArray,
  validateBoolean,
} from "@/lib/errors";

// Mock NextRequest
const createMockRequest = (
  url: string,
  method: string = "GET"
): NextRequest => {
  return {
    url,
    method,
    json: jest.fn(),
    text: jest.fn(),
  } as any;
};

describe("Error Handling System", () => {
  describe("Error Classes", () => {
    test("should create BadRequestError with correct status code", () => {
      const error = new BadRequestError("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(400);
      expect(error.message).toBe("Invalid input");
    });

    test("should create UnauthorizedError with correct status code", () => {
      const error = new UnauthorizedError("Authentication required");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(401);
      expect(error.message).toBe("Authentication required");
    });

    test("should create ForbiddenError with correct status code", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(403);
      expect(error.message).toBe("Access denied");
    });

    test("should create NotFoundError with correct status code", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(404);
      expect(error.message).toBe("Resource not found");
    });

    test("should create ValidationError with correct status code", () => {
      const error = new ValidationError("Validation failed");
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(422);
      expect(error.message).toBe("Validation failed");
    });

    test("should create ConflictError with correct status code", () => {
      const error = new ConflictError("Resource conflict");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(409);
      expect(error.message).toBe("Resource conflict");
    });

    test("should create InternalServerError with correct status code", () => {
      const error = new InternalServerError("Server error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(500);
      expect(error.message).toBe("Server error");
    });

    test("should create ServiceUnavailableError with correct status code", () => {
      const error = new ServiceUnavailableError("Service unavailable");
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(503);
      expect(error.message).toBe("Service unavailable");
    });
  });

  describe("formatErrorResponse", () => {
    test("should format AppError correctly", () => {
      const error = new BadRequestError("Invalid input", { field: "email" });
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: "Invalid input",
        code: 400,
        details: { field: "email" },
        timestamp: expect.any(String),
      });
    });

    test("should format generic Error correctly", () => {
      const error = new Error("Generic error");
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: "Generic error",
        code: 500,
        timestamp: expect.any(String),
      });
    });

    test("should handle error without message", () => {
      const error = new Error();
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        error: "An unexpected error occurred",
        code: 500,
        timestamp: expect.any(String),
      });
    });
  });

  describe("Validation Functions", () => {
    describe("validateString", () => {
      test("should validate required string", () => {
        expect(() => validateString("test", "field")).not.toThrow();
      });

      test("should throw ValidationError for undefined", () => {
        expect(() => validateString(undefined, "field")).toThrow(
          ValidationError
        );
        expect(() => validateString(undefined, "field")).toThrow(
          "field is required"
        );
      });

      test("should throw ValidationError for null", () => {
        expect(() => validateString(null, "field")).toThrow(ValidationError);
        expect(() => validateString(null, "field")).toThrow(
          "field is required"
        );
      });

      test("should throw ValidationError for empty string", () => {
        expect(() => validateString("", "field")).toThrow(ValidationError);
        expect(() => validateString("", "field")).toThrow("field is required");
      });

      test("should throw ValidationError for non-string", () => {
        expect(() => validateString(123, "field")).toThrow(ValidationError);
        expect(() => validateString(123, "field")).toThrow(
          "field must be a string"
        );
      });

      test("should validate minimum length", () => {
        expect(() => validateString("ab", "field", 3)).toThrow(ValidationError);
        expect(() => validateString("ab", "field", 3)).toThrow(
          "field must be at least 3 characters long"
        );
      });

      test("should validate maximum length", () => {
        expect(() => validateString("abcdef", "field", 1, 3)).toThrow(
          ValidationError
        );
        expect(() => validateString("abcdef", "field", 1, 3)).toThrow(
          "field must be no more than 3 characters long"
        );
      });
    });

    describe("validateUUID", () => {
      test("should validate valid UUID", () => {
        const validUUID = "123e4567-e89b-12d3-a456-426614174000";
        expect(() => validateUUID(validUUID, "field")).not.toThrow();
      });

      test("should throw ValidationError for invalid UUID", () => {
        const invalidUUID = "invalid-uuid";
        expect(() => validateUUID(invalidUUID, "field")).toThrow(
          ValidationError
        );
        expect(() => validateUUID(invalidUUID, "field")).toThrow(
          "field must be a valid UUID"
        );
      });

      test("should throw ValidationError for undefined", () => {
        expect(() => validateUUID(undefined, "field")).toThrow(ValidationError);
        expect(() => validateUUID(undefined, "field")).toThrow(
          "field is required"
        );
      });
    });

    describe("validateArray", () => {
      test("should validate array", () => {
        expect(() => validateArray([1, 2, 3], "field")).not.toThrow();
      });

      test("should throw ValidationError for non-array", () => {
        expect(() => validateArray("not-array", "field")).toThrow(
          ValidationError
        );
        expect(() => validateArray("not-array", "field")).toThrow(
          "field must be an array"
        );
      });

      test("should validate array items with validator", () => {
        const validator = jest.fn();
        validateArray([1, 2, 3], "field", validator);
        expect(validator).toHaveBeenCalledTimes(3);
        expect(validator).toHaveBeenCalledWith(1, 0);
        expect(validator).toHaveBeenCalledWith(2, 1);
        expect(validator).toHaveBeenCalledWith(3, 2);
      });

      test("should throw ValidationError for invalid array item", () => {
        const validator = jest.fn().mockImplementation(() => {
          throw new ValidationError("Invalid item");
        });

        expect(() => validateArray([1, 2, 3], "field", validator)).toThrow(
          ValidationError
        );
        expect(() => validateArray([1, 2, 3], "field", validator)).toThrow(
          "field[0]: Invalid item"
        );
      });
    });

    describe("validateBoolean", () => {
      test("should validate boolean", () => {
        expect(() => validateBoolean(true, "field")).not.toThrow();
        expect(() => validateBoolean(false, "field")).not.toThrow();
      });

      test("should throw ValidationError for non-boolean", () => {
        expect(() => validateBoolean("true", "field")).toThrow(ValidationError);
        expect(() => validateBoolean("true", "field")).toThrow(
          "field must be a boolean"
        );
      });
    });
  });

  describe("handleDatabaseError", () => {
    test("should handle unique violation", () => {
      const dbError = { code: "23505" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe("Resource already exists");
    });

    test("should handle foreign key violation", () => {
      const dbError = { code: "23503" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe("Referenced resource does not exist");
    });

    test("should handle not null violation", () => {
      const dbError = { code: "23502" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Required field is missing");
    });

    test("should handle check violation", () => {
      const dbError = { code: "23514" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe("Data validation failed");
    });

    test("should handle undefined table", () => {
      const dbError = { code: "42P01" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.message).toBe("Database schema error");
    });

    test("should handle connection exception", () => {
      const dbError = { code: "08000" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect(error.message).toBe("Database connection failed");
    });

    test("should handle unknown database error", () => {
      const dbError = { code: "UNKNOWN" };
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.message).toBe("Database operation failed");
    });

    test("should handle error without code", () => {
      const dbError = new Error("Database error");
      const error = handleDatabaseError(dbError);
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.message).toBe("Database operation failed");
    });
  });

  describe("Error Response Structure", () => {
    test("should have consistent error response structure", () => {
      const error = new BadRequestError("Test error", { detail: "test" });
      const response = formatErrorResponse(error);

      expect(response).toHaveProperty("error");
      expect(response).toHaveProperty("code");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("details");

      expect(typeof response.error).toBe("string");
      expect(typeof response.code).toBe("number");
      expect(typeof response.timestamp).toBe("string");
      expect(typeof response.details).toBe("object");
    });

    test("should include timestamp in ISO format", () => {
      const error = new BadRequestError("Test error");
      const response = formatErrorResponse(error);

      expect(response.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    test("should handle errors without details", () => {
      const error = new BadRequestError("Test error");
      const response = formatErrorResponse(error);

      expect(response.details).toBeUndefined();
    });
  });
});
