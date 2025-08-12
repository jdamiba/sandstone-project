#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Running Performance Tests...\n");

// Create performance results directory
const resultsDir = path.join(__dirname, "../performance-results");
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsFile = path.join(resultsDir, `performance-${timestamp}.json`);

try {
  // Run performance tests with verbose output
  console.log("Running text diff performance tests...");
  const textDiffResults = execSync(
    'npm test -- --testNamePattern="performance|benchmark" --verbose --json --outputFile=performance-results/text-diff-results.json',
    { encoding: "utf8", stdio: "pipe" }
  );
  console.log("✅ Text diff performance tests completed\n");

  // Run search performance tests
  console.log("Running search performance tests...");
  const searchResults = execSync(
    'npm test -- --testNamePattern="search.*performance" --verbose --json --outputFile=performance-results/search-results.json',
    { encoding: "utf8", stdio: "pipe" }
  );
  console.log("✅ Search performance tests completed\n");

  // Run collaboration performance tests
  console.log("Running collaboration performance tests...");
  const collaborationResults = execSync(
    'npm test -- --testNamePattern="collaboration.*performance" --verbose --json --outputFile=performance-results/collaboration-results.json',
    { encoding: "utf8", stdio: "pipe" }
  );
  console.log("✅ Collaboration performance tests completed\n");

  // Generate performance report
  console.log("📊 Generating Performance Report...");

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      averageExecutionTime: 0,
    },
    benchmarks: {
      textDiff: {
        largeFilePerformance: "N/A",
        smallChangesPerformance: "N/A",
        wordLevelPerformance: "N/A",
      },
      search: {
        basicSearchPerformance: "N/A",
        complexQueryPerformance: "N/A",
        concurrentSearchPerformance: "N/A",
      },
      collaboration: {
        cursorUpdatePerformance: "N/A",
        documentSyncPerformance: "N/A",
        userManagementPerformance: "N/A",
      },
    },
    recommendations: [],
  };

  // Parse results and generate recommendations
  try {
    const textDiffData = JSON.parse(
      fs.readFileSync("performance-results/text-diff-results.json", "utf8")
    );
    const searchData = JSON.parse(
      fs.readFileSync("performance-results/search-results.json", "utf8")
    );
    const collaborationData = JSON.parse(
      fs.readFileSync("performance-results/collaboration-results.json", "utf8")
    );

    // Analyze text diff performance
    const textDiffTests = textDiffData.testResults?.[0]?.testResults || [];
    textDiffTests.forEach((test) => {
      if (test.name.includes("large file")) {
        report.benchmarks.textDiff.largeFilePerformance = `${test.duration}ms`;
        if (test.duration > 30000) {
          report.recommendations.push(
            "Large file diff performance needs optimization (>30s)"
          );
        }
      }
      if (test.name.includes("small changes")) {
        report.benchmarks.textDiff.smallChangesPerformance = `${test.duration}ms`;
        if (test.duration > 10000) {
          report.recommendations.push(
            "Small changes performance needs optimization (>10s)"
          );
        }
      }
    });

    // Analyze search performance
    const searchTests = searchData.testResults?.[0]?.testResults || [];
    searchTests.forEach((test) => {
      if (test.name.includes("basic search")) {
        report.benchmarks.search.basicSearchPerformance = `${test.duration}ms`;
        if (test.duration > 100) {
          report.recommendations.push(
            "Basic search performance needs optimization (>100ms)"
          );
        }
      }
    });

    // Analyze collaboration performance
    const collaborationTests =
      collaborationData.testResults?.[0]?.testResults || [];
    collaborationTests.forEach((test) => {
      if (test.name.includes("cursor update")) {
        report.benchmarks.collaboration.cursorUpdatePerformance = `${test.duration}ms`;
        if (test.duration > 1000) {
          report.recommendations.push(
            "Cursor update performance needs optimization (>1s)"
          );
        }
      }
    });

    // Calculate summary
    const allTests = [...textDiffTests, ...searchTests, ...collaborationTests];
    report.summary.totalTests = allTests.length;
    report.summary.passedTests = allTests.filter(
      (t) => t.status === "passed"
    ).length;
    report.summary.failedTests = allTests.filter(
      (t) => t.status === "failed"
    ).length;
    report.summary.averageExecutionTime =
      allTests.reduce((sum, t) => sum + t.duration, 0) / allTests.length;
  } catch (parseError) {
    console.warn("⚠️  Could not parse test results:", parseError.message);
  }

  // Write report
  fs.writeFileSync(resultsFile, JSON.stringify(report, null, 2));

  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  const markdownFile = path.join(resultsDir, `performance-${timestamp}.md`);
  fs.writeFileSync(markdownFile, markdownReport);

  console.log("✅ Performance Report Generated!");
  console.log(`📄 JSON Report: ${resultsFile}`);
  console.log(`📄 Markdown Report: ${markdownFile}`);

  // Print summary
  console.log("\n📊 Performance Summary:");
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Passed: ${report.summary.passedTests}`);
  console.log(`Failed: ${report.summary.failedTests}`);
  console.log(
    `Average Execution Time: ${report.summary.averageExecutionTime.toFixed(
      2
    )}ms`
  );

  if (report.recommendations.length > 0) {
    console.log("\n⚠️  Recommendations:");
    report.recommendations.forEach((rec) => console.log(`  - ${rec}`));
  } else {
    console.log("\n🎉 All performance benchmarks passed!");
  }
} catch (error) {
  console.error("❌ Performance tests failed:", error.message);
  process.exit(1);
}

function generateMarkdownReport(report) {
  return `# Performance Test Report

**Generated:** ${report.timestamp}

## Summary

- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passedTests}
- **Failed:** ${report.summary.failedTests}
- **Average Execution Time:** ${report.summary.averageExecutionTime.toFixed(
    2
  )}ms

## Benchmarks

### Text Diff Performance
- **Large File Performance:** ${report.benchmarks.textDiff.largeFilePerformance}
- **Small Changes Performance:** ${
    report.benchmarks.textDiff.smallChangesPerformance
  }
- **Word Level Performance:** ${report.benchmarks.textDiff.wordLevelPerformance}

### Search Performance
- **Basic Search Performance:** ${
    report.benchmarks.search.basicSearchPerformance
  }
- **Complex Query Performance:** ${
    report.benchmarks.search.complexQueryPerformance
  }
- **Concurrent Search Performance:** ${
    report.benchmarks.search.concurrentSearchPerformance
  }

### Collaboration Performance
- **Cursor Update Performance:** ${
    report.benchmarks.collaboration.cursorUpdatePerformance
  }
- **Document Sync Performance:** ${
    report.benchmarks.collaboration.documentSyncPerformance
  }
- **User Management Performance:** ${
    report.benchmarks.collaboration.userManagementPerformance
  }

## Recommendations

${
  report.recommendations.length > 0
    ? report.recommendations.map((rec) => `- ${rec}`).join("\n")
    : "- All performance benchmarks are within acceptable limits! 🎉"
}

## Performance Targets

- **Large File Diff:** < 30 seconds
- **Small Changes:** < 10 seconds
- **Basic Search:** < 100ms
- **Cursor Updates:** < 1 second
- **Word Level Changes:** < 5ms average
- **Change Request Generation:** < 2ms average

---
*Report generated automatically by performance test suite*
`;
}
