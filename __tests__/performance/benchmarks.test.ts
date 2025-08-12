import { findTextChanges, generateChangeRequests } from "@/lib/textDiff";

describe("Performance Benchmarks", () => {
  describe("Text Diff Performance", () => {
    it("benchmark: large file diff performance (10MB)", () => {
      const startTime = performance.now();

      // Generate 10MB of text
      const largeText = "Lorem ipsum dolor sit amet. ".repeat(400000); // ~10MB
      const modifiedText = largeText
        .replace(/ipsum/g, "IPSUM")
        .replace(/dolor/g, "DOLOR")
        .replace(/amet/g, "AMET");

      const changes = findTextChanges(largeText, modifiedText);
      const endTime = performance.now();

      console.log(`Large file diff (10MB): ${endTime - startTime}ms`);
      console.log(`Changes found: ${changes.length}`);

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("benchmark: many small changes performance", () => {
      const startTime = performance.now();

      // Create text with many small changes
      let text = "";
      for (let i = 0; i < 10000; i++) {
        text += `Line ${i}: Hello world\n`;
      }

      let modifiedText = text;
      for (let i = 0; i < 1000; i++) {
        modifiedText = modifiedText.replace(
          `Line ${i}:`,
          `Line ${i}: Modified`
        );
      }

      const changes = findTextChanges(text, modifiedText);
      const endTime = performance.now();

      console.log(`Many small changes: ${endTime - startTime}ms`);
      console.log(`Changes found: ${changes.length}`);

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("benchmark: word-level changes performance", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const oldText = `Document ${i}: The quick brown fox jumps over the lazy dog`;
        const newText = `Document ${i}: The fast red fox leaps over the sleepy cat`;
        generateChangeRequests(oldText, newText);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(
        `Change request generation average: ${avgTime}ms per operation`
      );

      expect(avgTime).toBeLessThan(1); // Average time per operation should be less than 1ms
    });

    it("benchmark: change request generation performance", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const oldText = `Document ${i}: Hello world`;
        const newText = `Document ${i}: Hello universe`;
        generateChangeRequests(oldText, newText);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(
        `Change request generation average: ${avgTime}ms per operation`
      );

      expect(avgTime).toBeLessThan(2); // Average time should be less than 2ms
    });
  });

  describe("Memory Usage Benchmarks", () => {
    it("benchmark: memory usage with large documents", () => {
      const initialMemory = process.memoryUsage();

      // Process multiple large documents
      const documents = [];
      for (let i = 0; i < 10; i++) {
        const largeText = "Lorem ipsum dolor sit amet. ".repeat(10000); // ~250KB each
        const modifiedText = largeText.replace(/ipsum/g, "IPSUM");

        const changes = findTextChanges(largeText, modifiedText);
        documents.push({
          original: largeText,
          modified: modifiedText,
          changes,
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(
        `Memory increase for 10 large documents: ${
          memoryIncrease / 1024 / 1024
        }MB`
      );

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it("benchmark: garbage collection impact", () => {
      const initialMemory = process.memoryUsage();

      // Create and discard many large objects
      for (let i = 0; i < 100; i++) {
        const largeText = "Lorem ipsum dolor sit amet. ".repeat(1000);
        const changes = findTextChanges(
          largeText,
          largeText.replace(/ipsum/g, "IPSUM")
        );

        // Explicitly clear references
        if (i % 10 === 0) {
          global.gc?.(); // Force garbage collection if available
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(
        `Memory increase after GC: ${memoryIncrease / 1024 / 1024}MB`
      );

      // Memory should be stable after garbage collection
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe("Concurrent Operations Benchmarks", () => {
    it("benchmark: concurrent text diff operations", async () => {
      const concurrentOperations = 10;
      const operationsPerBatch = 100;

      const startTime = performance.now();

      const operationPromises = Array.from(
        { length: concurrentOperations },
        async (_, batchIndex) => {
          const batchStartTime = performance.now();

          for (let i = 0; i < operationsPerBatch; i++) {
            const oldText = `Batch ${batchIndex}, Op ${i}: Hello world`;
            const newText = `Batch ${batchIndex}, Op ${i}: Hello universe`;
            findTextChanges(oldText, newText);
          }

          const batchEndTime = performance.now();
          return batchEndTime - batchStartTime;
        }
      );

      const batchTimes = await Promise.all(operationPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgBatchTime =
        batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length;

      console.log(`Concurrent operations total time: ${totalTime}ms`);
      console.log(`Average batch time: ${avgBatchTime}ms`);

      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgBatchTime).toBeLessThan(1000); // Each batch should complete within 1 second
    });

    it("benchmark: mixed operation types performance", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const oldText = `Document ${i}: The quick brown fox jumps over the lazy dog`;
        const newText = `Document ${i}: The fast red fox leaps over the sleepy cat`;

        // Perform different types of operations
        const charChanges = findTextChanges(oldText, newText);
        const requests = generateChangeRequests(oldText, newText);

        // Verify results
        expect(charChanges.length).toBeGreaterThan(0);
        expect(requests.length).toBeGreaterThan(0);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Mixed operations average: ${avgTime}ms per operation`);

      expect(avgTime).toBeLessThan(10); // Average time should be less than 10ms
    });
  });

  describe("Edge Case Performance", () => {
    it("benchmark: very long words performance", () => {
      const startTime = performance.now();

      // Create text with very long words
      const longWord = "a".repeat(100000); // 100KB word
      const oldText = `Hello ${longWord} world`;
      const newText = `Hello ${longWord} universe`;

      const changes = findTextChanges(oldText, newText);
      const endTime = performance.now();

      console.log(`Very long words diff: ${endTime - startTime}ms`);

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("benchmark: repeated patterns performance", () => {
      const startTime = performance.now();

      // Create text with many repeated patterns
      const repeatedPattern = "Hello world ";
      const oldText = repeatedPattern.repeat(10000);
      const newText = oldText.replace(/world/g, "universe");

      const changes = findTextChanges(oldText, newText);
      const endTime = performance.now();

      console.log(`Repeated patterns diff: ${endTime - startTime}ms`);
      console.log(`Changes found: ${changes.length}`);

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("benchmark: unicode and emoji performance", () => {
      const startTime = performance.now();

      // Create text with unicode characters and emojis
      const unicodeText = "Hello 世界 👋 🌍 🚀 ".repeat(1000);
      const modifiedText = unicodeText
        .replace(/世界/g, "宇宙")
        .replace(/👋/g, "🤝")
        .replace(/🌍/g, "🌎");

      const changes = findTextChanges(unicodeText, modifiedText);
      const endTime = performance.now();

      console.log(`Unicode and emoji diff: ${endTime - startTime}ms`);

      expect(changes.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Load Testing", () => {
    it("benchmark: sustained load performance", () => {
      const iterations = 10000;
      const startTime = performance.now();
      let totalChanges = 0;

      for (let i = 0; i < iterations; i++) {
        const oldText = `Document ${i}: Hello world`;
        const newText = `Document ${i}: Hello universe`;

        const changes = findTextChanges(oldText, newText);
        totalChanges += changes.length;

        // Simulate some processing time
        if (i % 1000 === 0) {
          console.log(`Processed ${i} documents...`);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Sustained load total time: ${totalTime}ms`);
      console.log(`Average time per operation: ${avgTime}ms`);
      console.log(`Total changes found: ${totalChanges}`);

      expect(avgTime).toBeLessThan(1); // Average time should be less than 1ms
      expect(totalChanges).toBe(iterations); // Should find one change per document
    });
  });
});
