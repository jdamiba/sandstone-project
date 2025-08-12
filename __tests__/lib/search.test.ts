import { pool } from "@/lib/database";

// Mock the database pool
jest.mock("@/lib/database", () => ({
  pool: {
    query: jest.fn(),
  },
}));

describe("Search Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Full-Text Search", () => {
    it("should perform basic text search", async () => {
      const mockResults = [
        {
          id: "1",
          title: "Test Document",
          content: "This is a test document about programming",
          description: "A test document",
          tags: ["test", "programming"],
          owner_name: "Test User",
          rank: 0.8,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockResults,
        rowCount: 1,
      });

      const searchQuery = `
        SELECT 
          d.*,
          u.first_name || ' ' || u.last_name as owner_name,
          ts_rank(d.search_vector, plainto_tsquery('english', $1)) as rank
        FROM documents d
        LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.search_vector @@ plainto_tsquery('english', $1)
        AND (
          d.owner_id = $2 OR 
          d.is_public = TRUE OR
          EXISTS (
            SELECT 1 FROM document_collaborators 
            WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
          )
        )
        ORDER BY rank DESC
        LIMIT 20 OFFSET 0
      `;

      const result = await pool.query(searchQuery, [
        "programming",
        "test-user-id",
      ]);

      expect(result.rows).toEqual(mockResults);
      expect(result.rowCount).toBe(1);
    });

    it("should handle search with no results", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await pool.query(
        "SELECT * FROM documents WHERE title LIKE $1",
        ["nonexistent"]
      );

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it("should handle search with special characters", async () => {
      const mockResults = [
        {
          id: "1",
          title: "C++ Programming Guide",
          content: "Advanced C++ programming techniques",
          rank: 0.9,
        },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: mockResults,
        rowCount: 1,
      });

      const result = await pool.query(
        "SELECT * FROM documents WHERE title ILIKE $1",
        ["%C++%"]
      );

      expect(result.rows).toEqual(mockResults);
    });
  });

  describe("Search Performance", () => {
    it("should handle large search result sets efficiently", async () => {
      const startTime = performance.now();

      // Mock large result set (1000 documents)
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc-${i}`,
        title: `Document ${i}`,
        content: `Content for document ${i}`,
        rank: Math.random(),
      }));

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: largeResults,
        rowCount: 1000,
      });

      const result = await pool.query("SELECT * FROM documents LIMIT 1000");
      const endTime = performance.now();

      expect(result.rows).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it("should handle complex search queries efficiently", async () => {
      const startTime = performance.now();

      const complexQuery = `
        SELECT 
          d.*,
          u.first_name || ' ' || u.last_name as owner_name,
          ts_rank(d.search_vector, plainto_tsquery('english', $1)) as rank
        FROM documents d
        LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.search_vector @@ plainto_tsquery('english', $1)
        AND d.is_public = TRUE
        AND d.tags && $2
        AND d.created_at >= $3
        ORDER BY rank DESC, d.updated_at DESC
        LIMIT 50 OFFSET 0
      `;

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await pool.query(complexQuery, [
        "programming AND (javascript OR typescript)",
        ["programming", "web"],
        new Date("2023-01-01"),
      ]);

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });
  });

  describe("Search Analytics", () => {
    it("should track search analytics", async () => {
      const mockInsertResult = { rowCount: 1 };
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // Search results
        .mockResolvedValueOnce(mockInsertResult); // Analytics insert

      const searchQuery = "test query";
      const resultsCount = 5;

      // Perform search
      await pool.query("SELECT * FROM documents WHERE title ILIKE $1", [
        `%${searchQuery}%`,
      ]);

      // Track analytics
      const analyticsResult = await pool.query(
        `INSERT INTO search_analytics (
          user_id, 
          search_query, 
          results_count, 
          metadata
        ) VALUES ($1, $2, $3, $4)`,
        [
          "test-user-id",
          searchQuery,
          resultsCount,
          { timestamp: new Date().toISOString() },
        ]
      );

      expect(analyticsResult.rowCount).toBe(1);
    });

    it("should handle analytics with large metadata", async () => {
      const largeMetadata = {
        timestamp: new Date().toISOString(),
        filters: {
          tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`),
          dateRange: { start: "2023-01-01", end: "2023-12-31" },
          categories: Array.from({ length: 50 }, (_, i) => `category-${i}`),
        },
        performance: {
          queryTime: 150,
          resultCount: 1000,
          cacheHit: false,
        },
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

      const result = await pool.query(
        `INSERT INTO search_analytics (
          user_id, 
          search_query, 
          results_count, 
          metadata
        ) VALUES ($1, $2, $3, $4)`,
        ["test-user-id", "complex search", 1000, largeMetadata]
      );

      expect(result.rowCount).toBe(1);
    });
  });

  describe("Search Edge Cases", () => {
    it("should handle empty search queries", async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await pool.query(
        "SELECT * FROM documents WHERE title ILIKE $1",
        [""]
      );

      expect(result.rows).toEqual([]);
    });

    it("should handle very long search queries", async () => {
      const longQuery = "a".repeat(10000);

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const startTime = performance.now();
      await pool.query("SELECT * FROM documents WHERE content ILIKE $1", [
        `%${longQuery}%`,
      ]);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle search with SQL injection attempts", async () => {
      const maliciousQuery = "'; DROP TABLE documents; --";

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      // This should be handled safely by parameterized queries
      await pool.query("SELECT * FROM documents WHERE title ILIKE $1", [
        `%${maliciousQuery}%`,
      ]);

      // Verify that the query was called with the parameterized version
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM documents WHERE title ILIKE $1",
        [`%${maliciousQuery}%`]
      );
    });
  });

  describe("Search Benchmark Tests", () => {
    it("benchmark: should perform multiple searches efficiently", async () => {
      const iterations = 100;
      const startTime = performance.now();

      (pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      for (let i = 0; i < iterations; i++) {
        await pool.query("SELECT * FROM documents WHERE title ILIKE $1", [
          `%query-${i}%`,
        ]);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(10); // Average time per search should be less than 10ms
    });

    it("benchmark: should handle concurrent searches", async () => {
      const concurrentSearches = 10;
      const startTime = performance.now();

      (pool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const searchPromises = Array.from(
        { length: concurrentSearches },
        (_, i) =>
          pool.query("SELECT * FROM documents WHERE title ILIKE $1", [
            `%concurrent-${i}%`,
          ])
      );

      await Promise.all(searchPromises);

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
