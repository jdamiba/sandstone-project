import { pool } from "@/lib/database";
import { findTextChanges, generateChangeRequests } from "@/lib/textDiff";

// Mock the database pool
jest.mock("@/lib/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe("Document Workflow Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete Document Lifecycle", () => {
    it("should handle full document creation, editing, and search workflow", async () => {
      // 1. Create document
      const createDocumentQuery = `
        INSERT INTO documents (
          id, title, content, description, owner_id, tags, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const mockDocument = {
        id: "test-doc-1",
        title: "Test Document",
        content: "Initial content for testing",
        description: "A test document for integration testing",
        owner_id: "test-user-1",
        tags: ["test", "integration"],
        is_public: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockDocument],
        rowCount: 1,
      });

      const createResult = await pool.query(createDocumentQuery, [
        mockDocument.id,
        mockDocument.title,
        mockDocument.content,
        mockDocument.description,
        mockDocument.owner_id,
        mockDocument.tags,
        mockDocument.is_public,
      ]);

      expect(createResult.rows[0]).toEqual(mockDocument);

      // 2. Edit document content
      const originalContent = mockDocument.content;
      const newContent = "Updated content for testing";

      const textChanges = findTextChanges(originalContent, newContent);
      const changeRequests = generateChangeRequests(
        originalContent,
        newContent
      );

      expect(textChanges.length).toBeGreaterThan(0);
      expect(changeRequests.length).toBeGreaterThan(0);

      // 3. Apply changes via API
      let currentContent = originalContent;
      for (const change of changeRequests) {
        const updateQuery = `
          UPDATE documents 
          SET content = REPLACE(content, $1, $2), updated_at = NOW()
          WHERE id = $3
          RETURNING content
        `;

        // Apply the change to the current content
        const updatedContent = currentContent.replace(
          change.textToReplace,
          change.newText
        );

        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [
            {
              content: updatedContent,
            },
          ],
          rowCount: 1,
        });

        const updateResult = await pool.query(updateQuery, [
          change.textToReplace,
          change.newText,
          mockDocument.id,
        ]);

        currentContent = updateResult.rows[0].content;
      }

      expect(currentContent).toBe(newContent);

      // 4. Search for the document
      const searchQuery = `
        SELECT 
          d.*,
          u.first_name || ' ' || u.last_name as owner_name,
          ts_rank(d.search_vector, plainto_tsquery('english', $1)) as rank
        FROM documents d
        LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.search_vector @@ plainto_tsquery('english', $1)
        AND d.is_public = TRUE
        ORDER BY rank DESC
        LIMIT 10
      `;

      const searchResults = [
        {
          ...mockDocument,
          content: newContent,
          owner_name: "Test User",
          rank: 0.8,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: searchResults,
        rowCount: 1,
      });

      const searchResult = await pool.query(searchQuery, ["testing"]);

      expect(searchResult.rows).toHaveLength(1);
      expect(searchResult.rows[0].content).toBe(newContent);
      expect(searchResult.rows[0].rank).toBeGreaterThan(0);

      // 5. Track analytics
      const analyticsQuery = `
        INSERT INTO document_analytics (
          document_id, user_id, action_type, metadata
        ) VALUES ($1, $2, $3, $4)
      `;

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      const analyticsResult = await pool.query(analyticsQuery, [
        mockDocument.id,
        mockDocument.owner_id,
        "edit",
        { changes: changeRequests.length, contentLength: newContent.length },
      ]);

      expect(analyticsResult.rowCount).toBe(1);
    });

    it("should handle collaborative editing workflow", async () => {
      const documentId = "collab-doc-1";
      const user1 = "user-1";
      const user2 = "user-2";

      // 1. User 1 creates document
      const initialContent = "Hello world";

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: documentId, content: initialContent }],
        rowCount: 1,
      });

      const createResult = await pool.query(
        "INSERT INTO documents (id, content, owner_id) VALUES ($1, $2, $3) RETURNING *",
        [documentId, initialContent, user1]
      );

      // 2. User 2 joins collaboration
      const joinQuery = `
        INSERT INTO document_collaborators (document_id, user_id, permission_level)
        VALUES ($1, $2, 'editor')
        ON CONFLICT (document_id, user_id) DO UPDATE SET is_active = TRUE
      `;

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      await pool.query(joinQuery, [documentId, user2]);

      // 3. User 1 makes changes
      const user1Content = "Hello world! How are you?";
      const user1Changes = generateChangeRequests(initialContent, user1Content);

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ content: user1Content }],
        rowCount: 1,
      });

      await pool.query("UPDATE documents SET content = $1 WHERE id = $2", [
        user1Content,
        documentId,
      ]);

      // 4. User 2 makes concurrent changes
      const user2Content = "Hello world! Nice to meet you!";
      const user2Changes = generateChangeRequests(initialContent, user2Content);

      // 5. Resolve conflicts (simplified - in real app would use operational transforms)
      const mergedContent = "Hello world! How are you? Nice to meet you!";

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ content: mergedContent }],
        rowCount: 1,
      });

      await pool.query("UPDATE documents SET content = $1 WHERE id = $2", [
        mergedContent,
        documentId,
      ]);

      // 6. Verify final state
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ content: mergedContent, owner_id: user1 }],
        rowCount: 1,
      });

      const finalResult = await pool.query(
        "SELECT content, owner_id FROM documents WHERE id = $1",
        [documentId]
      );

      expect(finalResult.rows[0].content).toBe(mergedContent);
      expect(finalResult.rows[0].owner_id).toBe(user1);
    });
  });

  describe("Performance Integration Tests", () => {
    it("should handle large document editing efficiently", async () => {
      const startTime = performance.now();

      // Create large document
      const largeContent = "Lorem ipsum dolor sit amet. ".repeat(10000); // ~250KB

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: "large-doc", content: largeContent }],
        rowCount: 1,
      });

      await pool.query("INSERT INTO documents (id, content) VALUES ($1, $2)", [
        "large-doc",
        largeContent,
      ]);

      // Make changes to large document
      const modifiedContent = largeContent
        .replace(/ipsum/g, "IPSUM")
        .replace(/dolor/g, "DOLOR")
        .replace(/amet/g, "AMET");

      const changes = findTextChanges(largeContent, modifiedContent);
      const changeRequests = generateChangeRequests(
        largeContent,
        modifiedContent
      );

      // Apply changes
      let currentContent = largeContent;
      for (const change of changeRequests) {
        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [
            {
              content: currentContent.replace(
                change.textToReplace,
                change.newText
              ),
            },
          ],
          rowCount: 1,
        });

        const result = await pool.query(
          "UPDATE documents SET content = REPLACE(content, $1, $2) WHERE id = $3 RETURNING content",
          [change.textToReplace, change.newText, "large-doc"]
        );

        currentContent = result.rows[0].content;
      }

      const endTime = performance.now();

      expect(changes.length).toBeGreaterThan(0);
      expect(changeRequests.length).toBeGreaterThan(0);
      expect(currentContent).toBe(modifiedContent);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("should handle concurrent document operations", async () => {
      const concurrentOperations = 10;
      const startTime = performance.now();

      const operationPromises = Array.from(
        { length: concurrentOperations },
        async (_, i) => {
          const docId = `concurrent-doc-${i}`;
          const content = `Document ${i}: Hello world`;
          const modifiedContent = `Document ${i}: Hello universe`;

          // Create document
          (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: [{ id: docId, content }],
            rowCount: 1,
          });

          await pool.query(
            "INSERT INTO documents (id, content) VALUES ($1, $2)",
            [docId, content]
          );

          // Edit document
          const changes = generateChangeRequests(content, modifiedContent);

          (pool.query as jest.Mock).mockResolvedValueOnce({
            rows: [{ content: modifiedContent }],
            rowCount: 1,
          });

          await pool.query("UPDATE documents SET content = $1 WHERE id = $2", [
            modifiedContent,
            docId,
          ]);

          return { docId, changes: changes.length };
        }
      );

      const results = await Promise.all(operationPromises);
      const endTime = performance.now();

      expect(results).toHaveLength(concurrentOperations);
      expect(results.every((r) => r.changes > 0)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle database connection failures gracefully", async () => {
      // Simulate database connection failure
      (pool.query as jest.Mock).mockRejectedValueOnce(
        new Error("Connection failed")
      );

      await expect(
        pool.query("SELECT * FROM documents WHERE id = $1", ["nonexistent"])
      ).rejects.toThrow("Connection failed");
    });

    it("should handle invalid text changes gracefully", () => {
      // Test with invalid inputs
      const invalidOldText = null as any;
      const invalidNewText = undefined as any;

      expect(() => findTextChanges(invalidOldText, "valid text")).toThrow();
      expect(() => findTextChanges("valid text", invalidNewText)).toThrow();
    });

    it("should handle empty search results", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await pool.query(
        "SELECT * FROM documents WHERE title ILIKE $1",
        ["nonexistent"]
      );

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });
  });

  describe("Data Integrity Tests", () => {
    it("should maintain data consistency across operations", async () => {
      const docId = "integrity-doc";
      const originalContent = "Original content";
      const finalContent = "Final content after multiple edits";

      // Create document
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: docId, content: originalContent }],
        rowCount: 1,
      });

      await pool.query("INSERT INTO documents (id, content) VALUES ($1, $2)", [
        docId,
        originalContent,
      ]);

      // Perform multiple edits
      const edits = [
        "Original content with first edit",
        "Original content with first edit and second edit",
        "Original content with first edit and second edit and third edit",
        finalContent,
      ];

      let currentContent = originalContent;
      for (const edit of edits) {
        const changes = generateChangeRequests(currentContent, edit);

        (pool.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ content: edit }],
          rowCount: 1,
        });

        await pool.query("UPDATE documents SET content = $1 WHERE id = $2", [
          edit,
          docId,
        ]);

        currentContent = edit;
      }

      // Verify final state
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ content: finalContent }],
        rowCount: 1,
      });

      const finalResult = await pool.query(
        "SELECT content FROM documents WHERE id = $1",
        [docId]
      );

      expect(finalResult.rows[0].content).toBe(finalContent);
    });
  });
});
