// Text diff utility for finding minimal text changes
export interface TextChange {
  textToReplace: string;
  newText: string;
  position: number;
}

export function findTextChanges(
  oldText: string,
  newText: string
): TextChange[] {
  const changes: TextChange[] = [];

  // If texts are identical, no changes needed
  if (oldText === newText) {
    return changes;
  }

  // Find the first different character from the start
  let startIndex = 0;
  const minLength = Math.min(oldText.length, newText.length);

  while (
    startIndex < minLength &&
    oldText[startIndex] === newText[startIndex]
  ) {
    startIndex++;
  }

  // Find the first different character from the end
  let endIndex = minLength;

  while (
    endIndex > startIndex &&
    oldText[endIndex - 1] === newText[endIndex - 1]
  ) {
    endIndex--;
  }

  // Extract the changed portions
  const oldChanged = oldText.substring(startIndex, endIndex);
  const newChanged = newText.substring(startIndex, endIndex);

  // If there are changes, add them
  if (oldChanged !== newChanged) {
    changes.push({
      textToReplace: oldChanged,
      newText: newChanged,
      position: startIndex,
    });
  }

  return changes;
}

// For debugging - let's add a test function
export function testDiff(oldText: string, newText: string) {
  console.log("Old text:", JSON.stringify(oldText));
  console.log("New text:", JSON.stringify(newText));

  const changes = generateChangeRequests(oldText, newText);
  console.log("Changes:", changes);

  // Simulate the replacement
  let result = oldText;
  for (const change of changes) {
    const before = result.substring(0, change.position);
    const after = result.substring(
      change.position + change.textToReplace.length
    );
    result = before + change.newText + after;
  }

  console.log("Result:", JSON.stringify(result));
  console.log("Expected:", JSON.stringify(newText));
  console.log("Match:", result === newText);

  return changes;
}

// Test cases for common editing scenarios
export function runTestCases() {
  console.log("=== Testing Word-Level Diff ===");

  const testCases = [
    {
      old: "I love reading books",
      new: "I love reading emails",
      expected: "books → emails",
    },
    {
      old: "Hello world",
      new: "Hello universe",
      expected: "world → universe",
    },
    {
      old: "The quick brown fox",
      new: "The quick red fox",
      expected: "brown → red",
    },
    {
      old: "This is a test",
      new: "This is a demo",
      expected: "test → demo",
    },
    {
      old: "Simple text",
      new: "Simple text with more words",
      expected: "text → text with more words",
    },
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.expected}`);
    testDiff(testCase.old, testCase.new);
  });
}

// Alternative: More sophisticated diff for multiple changes
export function findMultipleTextChanges(
  oldText: string,
  newText: string
): TextChange[] {
  const changes: TextChange[] = [];

  if (oldText === newText) {
    return changes;
  }

  // For now, use a simple approach that finds the largest common substring
  // and replaces around it. This is a simplified version.

  // Find the longest common substring
  const lcs = findLongestCommonSubstring(oldText, newText);

  if (lcs.length === 0) {
    // No common substring, replace everything
    changes.push({
      textToReplace: oldText,
      newText: newText,
      position: 0,
    });
    return changes;
  }

  // Find positions of the common substring in both texts
  const oldPos = oldText.indexOf(lcs);
  const newPos = newText.indexOf(lcs);

  // Handle text before the common substring
  const oldBefore = oldText.substring(0, oldPos);
  const newBefore = newText.substring(0, newPos);

  if (oldBefore !== newBefore) {
    changes.push({
      textToReplace: oldBefore,
      newText: newBefore,
      position: 0,
    });
  }

  // Handle text after the common substring
  const oldAfter = oldText.substring(oldPos + lcs.length);
  const newAfter = newText.substring(newPos + lcs.length);

  if (oldAfter !== newAfter) {
    changes.push({
      textToReplace: oldAfter,
      newText: newAfter,
      position: oldPos + lcs.length,
    });
  }

  return changes;
}

function findLongestCommonSubstring(str1: string, str2: string): string {
  const matrix: number[][] = [];
  let maxLength = 0;
  let endIndex = 0;

  // Initialize matrix
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= str2.length; j++) {
      matrix[i][j] = 0;
    }
  }

  // Fill matrix
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        if (matrix[i][j] > maxLength) {
          maxLength = matrix[i][j];
          endIndex = i;
        }
      }
    }
  }

  return str1.substring(endIndex - maxLength, endIndex);
}

// Main function to use - tries simple diff first, falls back to multiple changes
export function generateChangeRequests(
  oldText: string,
  newText: string
): TextChange[] {
  // If texts are identical, no changes needed
  if (oldText === newText) {
    return [];
  }

  // Try to find minimal changes using word-level diff
  const wordChanges = findWordLevelChanges(oldText, newText);
  if (wordChanges.length > 0) {
    return wordChanges;
  }

  // Fallback to character-level diff
  const charChanges = findTextChanges(oldText, newText);
  if (charChanges.length > 0) {
    return charChanges;
  }

  // Last resort: replace entire content
  return [
    {
      textToReplace: oldText,
      newText: newText,
      position: 0,
    },
  ];
}

// Word-level diff that handles common editing patterns
function findWordLevelChanges(oldText: string, newText: string): TextChange[] {
  const changes: TextChange[] = [];

  // Split into words while preserving whitespace
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Find the first different word
  let startIndex = 0;
  const minLength = Math.min(oldWords.length, newWords.length);

  while (
    startIndex < minLength &&
    oldWords[startIndex] === newWords[startIndex]
  ) {
    startIndex++;
  }

  // Find the last different word
  let endIndex = minLength;
  while (
    endIndex > startIndex &&
    oldWords[endIndex - 1] === newWords[endIndex - 1]
  ) {
    endIndex--;
  }

  // Extract the changed word sequences
  const oldChangedWords = oldWords.slice(startIndex, endIndex);
  const newChangedWords = newWords.slice(startIndex, endIndex);

  if (oldChangedWords.length > 0 || newChangedWords.length > 0) {
    // Calculate the position in the original text
    let position = 0;
    for (let i = 0; i < startIndex; i++) {
      position += oldWords[i].length;
    }

    const textToReplace = oldChangedWords.join("");
    const newText = newChangedWords.join("");

    changes.push({
      textToReplace,
      newText,
      position,
    });
  }

  return changes;
}
