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

export type Question = {
  index: number;
  type: "addition" | "subtraction" | "multiplication" | "division";
  a: number;
  b: number;
  answer: number;
  question: string; // e.g., "12 + 7"
};

export type MathSettings = {
  dailyQuestionCount: number;
  additionEnabled: boolean;
  subtractionEnabled: boolean;
  multiplicationEnabled: boolean;
  divisionEnabled: boolean;
  additionMinA: number;
  additionMaxA: number;
  additionMinB: number;
  additionMaxB: number;
  allowCarrying: boolean;
  subtractionMinA: number;
  subtractionMaxA: number;
  subtractionMinB: number;
  subtractionMaxB: number;
  allowBorrowing: boolean;
  multiplicationMinA: number;
  multiplicationMaxA: number;
  multiplicationMinB: number;
  multiplicationMaxB: number;
  divisionMinDividend: number;
  divisionMaxDividend: number;
  divisionMinDivisor: number;
  divisionMaxDivisor: number;
};

const defaultSettings: MathSettings = {
  dailyQuestionCount: 2,
  additionEnabled: true,
  subtractionEnabled: true,
  multiplicationEnabled: false,
  divisionEnabled: false,
  additionMinA: 1,
  additionMaxA: 9,
  additionMinB: 10,
  additionMaxB: 99,
  allowCarrying: true,
  subtractionMinA: 10,
  subtractionMaxA: 99,
  subtractionMinB: 1,
  subtractionMaxB: 9,
  allowBorrowing: true,
  multiplicationMinA: 1,
  multiplicationMaxA: 10,
  multiplicationMinB: 1,
  multiplicationMaxB: 10,
  divisionMinDividend: 1,
  divisionMaxDividend: 100,
  divisionMinDivisor: 1,
  divisionMaxDivisor: 10,
};

/**
 * Generate a random number in range [min, max] using provided random function
 */
function randomInRange(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Generate an addition question based on settings
 */
function generateAddition(random: () => number, settings: MathSettings): Question {
  let a: number, b: number;
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    a = randomInRange(random, settings.additionMinA, settings.additionMaxA);
    b = randomInRange(random, settings.additionMinB, settings.additionMaxB);

    // If carrying is disabled, ensure no digit sum exceeds 9
    if (!settings.allowCarrying) {
      const sum = a + b;
      // Check if any position requires carrying
      const onesCarry = (a % 10) + (b % 10) >= 10;
      const tensCarry = Math.floor(a / 10) + Math.floor(b / 10) + (onesCarry ? 1 : 0) >= 10;
      if (onesCarry || tensCarry) continue;
    }

    return {
      index: 0,
      type: "addition",
      a,
      b,
      answer: a + b,
      question: `${a} + ${b}`,
    };
  }

  // Fallback: just return any valid addition
  a = randomInRange(random, settings.additionMinA, settings.additionMaxA);
  b = randomInRange(random, settings.additionMinB, settings.additionMaxB);
  return {
    index: 0,
    type: "addition",
    a,
    b,
    answer: a + b,
    question: `${a} + ${b}`,
  };
}

/**
 * Generate a subtraction question based on settings
 */
function generateSubtraction(random: () => number, settings: MathSettings): Question {
  let a: number, b: number;
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    a = randomInRange(random, settings.subtractionMinA, settings.subtractionMaxA);
    b = randomInRange(random, settings.subtractionMinB, settings.subtractionMaxB);

    // Ensure a >= b (no negative results)
    if (a < b) continue;

    // If borrowing is disabled, ensure no digit requires borrowing
    if (!settings.allowBorrowing) {
      const aOnes = a % 10;
      const bOnes = b % 10;
      if (aOnes < bOnes) continue;
    }

    return {
      index: 0,
      type: "subtraction",
      a,
      b,
      answer: a - b,
      question: `${a} - ${b}`,
    };
  }

  // Fallback: ensure a > b with safe bounds
  a = randomInRange(random, Math.max(2, settings.subtractionMinA), Math.max(2, settings.subtractionMaxA));
  const maxB = Math.max(1, Math.min(a - 1, settings.subtractionMaxB));
  b = randomInRange(random, 1, maxB);
  return {
    index: 0,
    type: "subtraction",
    a,
    b,
    answer: a - b,
    question: `${a} - ${b}`,
  };
}

/**
 * Generate a multiplication question based on settings
 */
function generateMultiplication(random: () => number, settings: MathSettings): Question {
  const a = randomInRange(random, settings.multiplicationMinA, settings.multiplicationMaxA);
  const b = randomInRange(random, settings.multiplicationMinB, settings.multiplicationMaxB);

  return {
    index: 0,
    type: "multiplication",
    a,
    b,
    answer: a * b,
    question: `${a} × ${b}`,
  };
}

/**
 * Generate a division question based on settings
 * Always generates clean division (no remainder)
 */
function generateDivision(random: () => number, settings: MathSettings): Question {
  // Generate divisor first
  const divisor = randomInRange(random, settings.divisionMinDivisor, settings.divisionMaxDivisor);

  // Calculate valid quotient range
  const minQuotient = Math.ceil(settings.divisionMinDividend / divisor);
  const maxQuotient = Math.floor(settings.divisionMaxDividend / divisor);

  // Ensure valid range
  const quotient = maxQuotient >= minQuotient
    ? randomInRange(random, minQuotient, maxQuotient)
    : minQuotient;

  const dividend = quotient * divisor;

  return {
    index: 0,
    type: "division",
    a: dividend,
    b: divisor,
    answer: quotient,
    question: `${dividend} ÷ ${divisor}`,
  };
}

/**
 * Generate questions based on settings for a given date and kid
 */
export function generateQuestionsWithSettings(
  dateStr: string,
  kidId: string,
  settings: Partial<MathSettings> = {}
): Question[] {
  const mergedSettings = { ...defaultSettings, ...settings };
  const seed = createSeed(dateStr, kidId);
  const random = mulberry32(seed);

  // Determine enabled types
  const enabledTypes: ("addition" | "subtraction" | "multiplication" | "division")[] = [];
  if (mergedSettings.additionEnabled) enabledTypes.push("addition");
  if (mergedSettings.subtractionEnabled) enabledTypes.push("subtraction");
  if (mergedSettings.multiplicationEnabled) enabledTypes.push("multiplication");
  if (mergedSettings.divisionEnabled) enabledTypes.push("division");

  // If no types enabled, default to addition
  if (enabledTypes.length === 0) {
    enabledTypes.push("addition");
  }

  const questions: Question[] = [];

  for (let i = 0; i < mergedSettings.dailyQuestionCount; i++) {
    // Cycle through enabled types
    const type = enabledTypes[i % enabledTypes.length];

    let question: Question;
    switch (type) {
      case "addition":
        question = generateAddition(random, mergedSettings);
        break;
      case "subtraction":
        question = generateSubtraction(random, mergedSettings);
        break;
      case "multiplication":
        question = generateMultiplication(random, mergedSettings);
        break;
      case "division":
        question = generateDivision(random, mergedSettings);
        break;
    }

    question.index = i;
    questions.push(question);
  }

  return questions;
}

/**
 * Legacy: Generate deterministic math problems for a given date and kid.
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
