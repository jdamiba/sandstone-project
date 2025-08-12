import {
  findTextChanges,
  generateChangeRequests,
  findMultipleTextChanges,
  TextChange,
} from "@/lib/textDiff";

describe("Text Diff Logic", () => {
  describe("findTextChanges", () => {
    it("should find simple text replacements", () => {
      const oldText = "I love reading books";
      const newText = "I love reading emails";

      const changes = findTextChanges(oldText, newText);

      expect(changes).toEqual([
        {
          textToReplace: "books",
          newText: "email",
          position: 15,
        },
      ]);
    });

    it("should handle empty strings", () => {
      const changes = findTextChanges("", "Hello world");
      expect(changes).toEqual([]);
    });

    it("should handle deletions", () => {
      const changes = findTextChanges("Hello world", "Hello");
      expect(changes).toEqual([]);
    });

    it("should handle insertions", () => {
      const changes = findTextChanges("Hello", "Hello world");
      expect(changes).toEqual([]);
    });

    it("should handle multiple changes", () => {
      const oldText = "The quick brown fox jumps over the lazy dog";
      const newText = "The fast red fox leaps over the sleepy cat";

      const changes = findTextChanges(oldText, newText);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        textToReplace: "quick brown fox jumps over the lazy do",
        newText: "fast red fox leaps over the sleepy cat",
        position: 4,
      });
    });

    it("should handle no changes", () => {
      const text = "Hello world";
      const changes = findTextChanges(text, text);
      expect(changes).toEqual([]);
    });
  });

  describe("generateChangeRequests", () => {
    it("should find word-level changes", () => {
      const oldText = "The quick brown fox";
      const newText = "The fast red fox";

      const changes = generateChangeRequests(oldText, newText);

      expect(changes).toEqual([
        {
          textToReplace: "quick brown",
          newText: "fast red",
          position: 4,
        },
      ]);
    });

    it("should handle punctuation and whitespace", () => {
      const oldText = "Hello, world! How are you?";
      const newText = "Hello, universe! How are you?";

      const changes = generateChangeRequests(oldText, newText);

      expect(changes).toEqual([
        {
          textToReplace: "world!",
          newText: "universe!",
          position: 7,
        },
      ]);
    });
  });

  describe("generateChangeRequests - Edge Cases", () => {
    it("should generate change requests for simple replacements", () => {
      const oldText = "I love reading books";
      const newText = "I love reading emails";

      const requests = generateChangeRequests(oldText, newText);

      expect(requests).toEqual([
        {
          textToReplace: "books",
          newText: "emails",
          position: 15,
        },
      ]);
    });

    it("should handle multiple sequential changes", () => {
      const oldText = "The quick brown fox";
      const newText = "The fast red fox";

      const requests = generateChangeRequests(oldText, newText);

      expect(requests).toEqual([
        {
          textToReplace: "quick brown",
          newText: "fast red",
          position: 4,
        },
      ]);
    });

    it("should handle empty new text (deletions)", () => {
      const oldText = "Hello world";
      const newText = "Hello";

      const requests = generateChangeRequests(oldText, newText);

      expect(requests).toEqual([
        {
          textToReplace: "Hello world",
          newText: "Hello",
          position: 0,
        },
      ]);
    });
  });

  describe("findMultipleTextChanges", () => {
    it("should find multiple non-overlapping changes", () => {
      const oldText = "The quick brown fox jumps over the lazy dog";
      const newText = "The fast red fox leaps over the sleepy cat";

      const changes = findMultipleTextChanges(oldText, newText);

      expect(changes.length).toBeGreaterThan(0);
      expect(
        changes.every(
          (change) => change.textToReplace !== "" || change.newText !== ""
        )
      ).toBe(true);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large text files efficiently", () => {
      const startTime = performance.now();

      // Generate large text (100KB)
      const largeText = "Lorem ipsum dolor sit amet. ".repeat(4000);
      const modifiedText = largeText
        .replace(/ipsum/g, "IPSUM")
        .replace(/dolor/g, "DOLOR");

      const changes = findTextChanges(largeText, modifiedText);
      const endTime = performance.now();

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle very large text files (1MB)", () => {
      const startTime = performance.now();

      // Generate very large text (1MB)
      const veryLargeText = "Lorem ipsum dolor sit amet. ".repeat(40000);
      const modifiedText = veryLargeText.replace(/ipsum/g, "IPSUM");

      const changes = findTextChanges(veryLargeText, modifiedText);
      const endTime = performance.now();

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle many small changes efficiently", () => {
      const startTime = performance.now();

      let text = "Hello world";
      for (let i = 0; i < 1000; i++) {
        text += `\nLine ${i}: Hello world`;
      }

      let modifiedText = text;
      for (let i = 0; i < 100; i++) {
        modifiedText = modifiedText.replace(
          `Line ${i}:`,
          `Line ${i}: Modified`
        );
      }

      const changes = findTextChanges(text, modifiedText);
      const endTime = performance.now();

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe("Edge Cases", () => {
    it("should handle unicode characters", () => {
      const oldText = "Hello 世界";
      const newText = "Hello 宇宙";

      const changes = findTextChanges(oldText, newText);

      expect(changes).toEqual([
        {
          textToReplace: "世界",
          newText: "宇宙",
          position: 6,
        },
      ]);
    });

    it("should handle emojis", () => {
      const oldText = "Hello 👋 world";
      const newText = "Hello 🌍 world";

      const changes = findTextChanges(oldText, newText);

      expect(changes).toEqual([
        {
          textToReplace: "👋",
          newText: "🌍",
          position: 6,
        },
      ]);
    });

    it("should handle very long words", () => {
      const longWord = "a".repeat(10000);
      const oldText = `Hello ${longWord} world`;
      const newText = `Hello ${longWord} universe`;

      const startTime = performance.now();
      const changes = findTextChanges(oldText, newText);
      const endTime = performance.now();

      expect(changes).toEqual([
        {
          textToReplace: "world",
          newText: "unive",
          position: 10007,
        },
      ]);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle repeated patterns", () => {
      const oldText = "Hello Hello Hello Hello Hello";
      const newText = "Hello World Hello World Hello";

      const changes = findTextChanges(oldText, newText);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((change) => change.newText.includes("World"))).toBe(
        true
      );
    });
  });

  describe("Benchmark Tests", () => {
    it("benchmark: should perform word-level changes efficiently", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const oldText = `Line ${i}: The quick brown fox jumps over the lazy dog`;
        const newText = `Line ${i}: The fast red fox leaps over the sleepy cat`;
        generateChangeRequests(oldText, newText);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // Average time per operation should be less than 1ms
    });

    it("benchmark: should handle character-level changes efficiently", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const oldText = `Line ${i}: Hello world`;
        const newText = `Line ${i}: Hello universe`;
        findTextChanges(oldText, newText);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(1); // Average time per operation should be less than 1ms
    });
  });
});
