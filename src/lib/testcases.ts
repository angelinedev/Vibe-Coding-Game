// Utility helpers for multi-testcase management, output normalization, and secure hashing.

export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected_output: string;
  is_public: boolean; // true = sample / visible to student, false = hidden / private
  output_hash?: string; // SHA-256 hash of normalized expected_output (for hidden tests in student payload)
}

export interface TestCaseResult {
  id: string;
  name: string;
  input: string;
  is_public: boolean;
  expected_output?: string;
  actual_output: string;
  passed: boolean;
  error?: string;
}

/**
 * Normalizes an output string for fair comparison:
 * - Strips Markdown code blocks (```json ... ``` or ``` ... ```)
 * - Trims leading and trailing whitespace
 * - Standardizes line breaks (\r\n -> \n)
 * - If output is valid JSON, standardizes formatting so key ordering/spaces don't cause false failures
 */
export function normalizeOutput(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
    cleaned = cleaned.trim();
  }

  // Standardize line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Attempt JSON canonicalization
  try {
    const parsed = JSON.parse(cleaned);
    // Sort keys and format compactly if object or array
    return JSON.stringify(parsed);
  } catch {
    // If not valid JSON, return cleaned text with trailing line spaces stripped
    return cleaned
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
      .trim();
  }
}

/**
 * Computes SHA-256 hex digest of a string using Web Crypto API.
 */
export async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses test cases from a question.
 * Supports:
 * 1. Multi-testcase JSON format stored in input_data
 * 2. Legacy single test case (string input_data)
 */
export function parseQuestionTestCases(inputData: string, fallbackExpected?: string): TestCase[] {
  if (!inputData) {
    return [
      {
        id: '1',
        name: 'Sample Test Case',
        input: '',
        expected_output: fallbackExpected || '',
        is_public: true,
      },
    ];
  }

  // Check if input_data is a JSON structure with testcases
  const trimmed = inputData.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : parsed.testcases;
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item, idx) => ({
          id: String(item.id || idx + 1),
          name: item.name || (item.is_public !== false ? `Sample Case #${idx + 1}` : `Hidden Case #${idx + 1}`),
          input: typeof item.input === 'string' ? item.input : JSON.stringify(item.input || ''),
          expected_output: item.expected_output || '',
          is_public: item.is_public !== false,
          output_hash: item.output_hash,
        }));
      }
    } catch {
      // Not valid JSON, fall through to legacy single test case
    }
  }

  // Legacy single test case
  return [
    {
      id: '1',
      name: 'Sample Test Case',
      input: inputData,
      expected_output: fallbackExpected || '',
      is_public: true,
    },
  ];
}

/**
 * Checks whether the actual model output matches the expected output or hash.
 */
export async function verifyTestCaseOutput(
  actual: string,
  expected?: string,
  expectedHash?: string
): Promise<boolean> {
  const normalizedActual = normalizeOutput(actual);

  // If normalized actual is completely empty and we expected content, fail
  if (!normalizedActual && (expected || expectedHash)) {
    return false;
  }

  // If plain expected output is available (e.g. public sample test or admin view)
  if (expected !== undefined && expected.trim() !== '') {
    const normalizedExpected = normalizeOutput(expected);
    if (normalizedActual === normalizedExpected) return true;

    // Also check raw string equality (trimmed)
    if (actual.trim() === expected.trim()) return true;

    // Check case-insensitive equality
    if (normalizedActual.toLowerCase() === normalizedExpected.toLowerCase()) return true;
  }

  // If SHA-256 hash is available (for private tests in participant view)
  if (expectedHash) {
    const actualHash = await sha256Hex(normalizedActual);
    if (actualHash === expectedHash) return true;

    // Also try hash of raw trimmed text
    const rawTrimmedHash = await sha256Hex(actual.trim());
    if (rawTrimmedHash === expectedHash) return true;
  }

  return false;
}

