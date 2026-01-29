// Seeded random number generator (mulberry32)
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Create a seed from date string and kidId
function createSeed(dateStr: string, kidId: string): number {
  let hash = 0;
  const combined = dateStr + kidId;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export type MathProblem = {
  a: number;
  b: number;
  answer: number;
};

export type DailyMathProblems = {
  addition: MathProblem;
  subtraction: MathProblem;
};

/**
 * Generate deterministic math problems for a given date and kid.
 * Addition: 1-digit + 2-digits (e.g., 5 + 23)
 * Subtraction: 2-digits - 1-digit (e.g., 45 - 7)
 */
export function generateDailyMathProblems(
  dateStr: string,
  kidId: string
): DailyMathProblems {
  const seed = createSeed(dateStr, kidId);
  const random = mulberry32(seed);

  // Addition: 1-digit (1-9) + 2-digits (10-99)
  const addA = Math.floor(random() * 9) + 1; // 1-9
  const addB = Math.floor(random() * 90) + 10; // 10-99

  // Subtraction: 2-digits (10-99) - 1-digit (1-9), ensuring result >= 0
  const subA = Math.floor(random() * 90) + 10; // 10-99
  const maxSubB = Math.min(9, subA - 1); // 1-9, but not more than subA-1
  const subB = Math.floor(random() * maxSubB) + 1; // 1 to min(9, subA-1)

  return {
    addition: { a: addA, b: addB, answer: addA + addB },
    subtraction: { a: subA, b: subB, answer: subA - subB },
  };
}

/**
 * Get today's date string in the given timezone.
 */
export function getLocalDateString(
  date: Date,
  timezone: string = "America/Los_Angeles"
): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone }); // "YYYY-MM-DD"
}
