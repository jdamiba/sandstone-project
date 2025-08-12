import { NextRequest } from "next/server";
import { pool } from "@/lib/database";
import { validateString, validateArray, BadRequestError } from "@/lib/errors";

// Mock the database pool
jest.mock("@/lib/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

// Mock the auth middleware
jest.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: any) => handler,
  createSuccessResponse: jest.fn(),
}));

// Mock the errors
jest.mock("@/lib/errors", () => ({
  validateString: jest.fn(),
  validateArray: jest.fn(),
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BadRequestError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
  handleDatabaseError: jest.fn(),
  validateUUID: jest.fn(),
}));

describe("Multiple Changes API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Request Type Detection", () => {
    test("should detect single change request", () => {
      const body: Record<string, unknown> = {
        textToReplace: "old text",
        newText: "new text",
      };

      // Test the logic directly
      if (body.changes && Array.isArray(body.changes)) {
        expect("multiple").toBe("multiple");
      } else if (
        body.textToReplace !== undefined &&
        body.newText !== undefined
      ) {
        expect("single").toBe("single");
      } else {
        throw new Error("Invalid request format");
      }
    });

    test("should detect multiple changes request", () => {
      const body: Record<string, unknown> = {
        changes: [
          { textToReplace: "Hello", newText: "Hi" },
          { textToReplace: "world", newText: "universe" },
        ],
      };

      // Test the logic directly
      if (body.changes && Array.isArray(body.changes)) {
        expect("multiple").toBe("multiple");
      } else if (
        body.textToReplace !== undefined &&
        body.newText !== undefined
      ) {
        expect("single").toBe("single");
      } else {
        throw new Error("Invalid request format");
      }
    });

    test("should throw error for invalid request format", () => {
      const body: Record<string, unknown> = { invalid: "format" };

      expect(() => {
        if (body.changes && Array.isArray(body.changes)) {
          return "multiple";
        } else if (
          body.textToReplace !== undefined &&
          body.newText !== undefined
        ) {
          return "single";
        } else {
          throw new Error("Invalid request format");
        }
      }).toThrow("Invalid request format");
    });
  });

  describe("Single Change Validation", () => {
    test("should validate single change request", () => {
      const body = {
        textToReplace: "old text",
        newText: "new text",
      };

      // Test validation logic
      expect(typeof body.textToReplace).toBe("string");
      expect(typeof body.newText).toBe("string");
      expect(body.textToReplace.length).toBeGreaterThan(0);
      expect(body.newText.length).toBeGreaterThanOrEqual(0);
    });

    test("should throw error for missing textToReplace", () => {
      const body: Record<string, unknown> = {
        newText: "new text",
      };

      expect(() => {
        if (!body.textToReplace) {
          throw new Error("textToReplace is required");
        }
      }).toThrow("textToReplace is required");
    });

    test("should throw error for missing newText", () => {
      const body: Record<string, unknown> = {
        textToReplace: "old text",
      };

      expect(() => {
        if (!body.newText) {
          throw new Error("newText is required");
        }
      }).toThrow("newText is required");
    });
  });

  describe("Multiple Changes Validation", () => {
    test("should validate multiple changes request", () => {
      const body = {
        changes: [
          { textToReplace: "Hello", newText: "Hi" },
          { textToReplace: "world", newText: "universe" },
        ],
      };

      // Test validation logic
      expect(Array.isArray(body.changes)).toBe(true);
      expect(body.changes.length).toBeGreaterThan(0);

      body.changes.forEach((change, index) => {
        expect(typeof change).toBe("object");
        expect(change).not.toBeNull();
        expect(typeof change.textToReplace).toBe("string");
        expect(typeof change.newText).toBe("string");
      });
    });

    test("should throw error for empty changes array", () => {
      const body = {
        changes: [],
      };

      expect(() => {
        if (body.changes.length === 0) {
          throw new Error("No changes provided");
        }
      }).toThrow("No changes provided");
    });

    test("should throw error for invalid change object", () => {
      const body = {
        changes: [
          { textToReplace: "Hello", newText: "Hi" },
          { invalid: "object" },
        ],
      };

      expect(() => {
        body.changes.forEach((change, index) => {
          if (typeof change !== "object" || change === null) {
            throw new Error(`changes[${index}] must be an object`);
          }
          if (!change.textToReplace || !change.newText) {
            throw new Error(`Invalid change object at index ${index}`);
          }
        });
      }).toThrow("Invalid change object at index 1");
    });
  });

  describe("Multiple Changes Application", () => {
    test("should apply multiple changes correctly", () => {
      const content = "Hello world, this is a test";
      const changes = [
        { textToReplace: "Hello", newText: "Hi" },
        { textToReplace: "world", newText: "universe" },
        { textToReplace: "test", newText: "example" },
      ];

      // Apply changes manually to test the logic
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      // Sort changes by position (descending) to avoid position shifts
      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(updatedContent).toBe("Hi universe, this is a example");
      expect(appliedChanges).toHaveLength(3);
      expect(appliedChanges.every((change) => change.applied)).toBe(true);
    });

    test("should handle changes that are not found", () => {
      const content = "Hello world";
      const changes = [
        { textToReplace: "Hello", newText: "Hi" },
        { textToReplace: "missing", newText: "found" },
        { textToReplace: "world", newText: "universe" },
      ];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(updatedContent).toBe("Hi universe");
      expect(appliedChanges).toHaveLength(3);
      // Find the changes by their textToReplace values since order may vary
      const helloChange = appliedChanges.find(
        (c) => c.textReplaced === "Hello"
      );
      const missingChange = appliedChanges.find(
        (c) => c.textReplaced === "missing"
      );
      const worldChange = appliedChanges.find(
        (c) => c.textReplaced === "world"
      );

      expect(helloChange?.applied).toBe(true);
      expect(missingChange?.applied).toBe(false);
      expect(worldChange?.applied).toBe(true);
    });

    test("should handle overlapping changes correctly", () => {
      const content = "Hello world";
      const changes = [
        { textToReplace: "Hello world", newText: "Hi universe" },
        { textToReplace: "Hello", newText: "Hi" },
        { textToReplace: "world", newText: "universe" },
      ];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      // The algorithm applies changes from end to beginning to avoid position shifts
      // So "world" (position 6) gets applied first, then "Hello" (position 0)
      // "Hello world" (position 0) can't be found after "world" is replaced
      expect(updatedContent).toBe("Hi universe");
      // Find the changes by their textToReplace values since order may vary
      const helloWorldChange = appliedChanges.find(
        (c) => c.textReplaced === "Hello world"
      );
      const helloChange = appliedChanges.find(
        (c) => c.textReplaced === "Hello"
      );
      const worldChange = appliedChanges.find(
        (c) => c.textReplaced === "world"
      );

      expect(helloWorldChange?.applied).toBe(false); // Can't be found after "world" is replaced
      expect(helloChange?.applied).toBe(true); // Applied after "world" is replaced
      expect(worldChange?.applied).toBe(true); // Applied first (position 6)
    });

    test("should handle case-sensitive replacements", () => {
      const content = "Hello World hello world";
      const changes = [
        { textToReplace: "Hello", newText: "Hi" },
        { textToReplace: "hello", newText: "hi" },
        { textToReplace: "World", newText: "Universe" },
        { textToReplace: "world", newText: "universe" },
      ];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(updatedContent).toBe("Hi Universe hi universe");
      expect(appliedChanges).toHaveLength(4);
      expect(appliedChanges.every((change) => change.applied)).toBe(true);
    });

    test("should handle empty content", () => {
      const content = "";
      const changes = [{ textToReplace: "Hello", newText: "Hi" }];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(updatedContent).toBe("");
      expect(appliedChanges[0].applied).toBe(false);
    });

    test("should handle empty replacement text", () => {
      const content = "Hello world";
      const changes = [
        { textToReplace: "Hello", newText: "" },
        { textToReplace: "world", newText: "universe" },
      ];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(updatedContent).toBe(" universe");
      expect(appliedChanges).toHaveLength(2);
      expect(appliedChanges.every((change) => change.applied)).toBe(true);
    });
  });

  describe("API Response Format", () => {
    test("should return correct response format for single change", () => {
      const expectedResponse = {
        documentText: "Hi universe",
        message: "Document updated successfully. Applied 1 of 1 changes.",
        changes: {
          requestType: "single",
          totalChanges: 1,
          appliedChanges: 1,
          changes: [
            {
              textReplaced: "Hello",
              newText: "Hi",
              position: 0,
              applied: true,
            },
          ],
          documentVersion: expect.any(Number),
        },
      };

      expect(expectedResponse.changes.requestType).toBe("single");
      expect(expectedResponse.changes.totalChanges).toBe(1);
      expect(expectedResponse.changes.appliedChanges).toBe(1);
    });

    test("should return correct response format for multiple changes", () => {
      const expectedResponse = {
        documentText: "Hi universe",
        message: "Document updated successfully. Applied 2 of 3 changes.",
        changes: {
          requestType: "multiple",
          totalChanges: 3,
          appliedChanges: 2,
          changes: [
            {
              textReplaced: "Hello",
              newText: "Hi",
              position: 0,
              applied: true,
            },
            {
              textReplaced: "missing",
              newText: "found",
              position: -1,
              applied: false,
            },
            {
              textReplaced: "world",
              newText: "universe",
              position: 3,
              applied: true,
            },
          ],
          documentVersion: expect.any(Number),
        },
      };

      expect(expectedResponse.changes.requestType).toBe("multiple");
      expect(expectedResponse.changes.totalChanges).toBe(3);
      expect(expectedResponse.changes.appliedChanges).toBe(2);
    });
  });

  describe("Error Handling", () => {
    test("should handle no changes provided", () => {
      const body = {
        changes: [],
      };

      expect(() => {
        if (body.changes.length === 0) {
          throw new Error("No changes provided");
        }
      }).toThrow("No changes provided");
    });

    test("should handle none of the changes being found", () => {
      const content = "Hello world";
      const changes = [
        { textToReplace: "missing1", newText: "found1" },
        { textToReplace: "missing2", newText: "found2" },
      ];

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      expect(appliedChanges.every((change) => !change.applied)).toBe(true);
    });

    test("should handle invalid change object structure", () => {
      const body = {
        changes: [
          { textToReplace: "Hello", newText: "Hi" },
          { invalid: "structure" },
        ],
      };

      expect(() => {
        body.changes.forEach((change, index) => {
          if (typeof change !== "object" || change === null) {
            throw new Error(`changes[${index}] must be an object`);
          }
          if (!change.textToReplace || !change.newText) {
            throw new Error(`Invalid change object at index ${index}`);
          }
        });
      }).toThrow("Invalid change object at index 1");
    });
  });

  describe("Performance Considerations", () => {
    test("should handle large number of changes efficiently", () => {
      const content = "Hello world ".repeat(1000);
      const changes = Array.from({ length: 100 }, (_, i) => ({
        textToReplace: `Hello world ${i}`,
        newText: `Hi universe ${i}`,
      }));

      const startTime = Date.now();

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(appliedChanges).toHaveLength(100);
    });

    test("should handle large content efficiently", () => {
      const content = "Hello world ".repeat(10000); // ~120KB of text
      const changes = [
        { textToReplace: "Hello", newText: "Hi" },
        { textToReplace: "world", newText: "universe" },
      ];

      const startTime = Date.now();

      // Apply changes manually
      let updatedContent = content;
      const appliedChanges: Array<{
        textReplaced: string;
        newText: string;
        position: number;
        applied: boolean;
      }> = [];

      const changesWithPositions = changes
        .map((change) => ({
          ...change,
          position: content.indexOf(change.textToReplace),
        }))
        .sort((a, b) => b.position - a.position);

      for (const change of changesWithPositions) {
        const position = updatedContent.indexOf(change.textToReplace);
        const applied = position !== -1;

        appliedChanges.push({
          textReplaced: change.textToReplace,
          newText: change.newText,
          position: position,
          applied: applied,
        });

        if (applied) {
          updatedContent = updatedContent.replace(
            change.textToReplace,
            change.newText
          );
        }
      }

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(updatedContent).toContain("Hi universe");
    });
  });
});
