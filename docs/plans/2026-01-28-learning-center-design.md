# Learning Center Design

## Overview

Expand the existing sight word feature into a "Learning Center" with two daily learning modules:

1. **Sight Words** (existing, unchanged) - 1 point
2. **Math** (new) - 1 point

Total: 2 points possible per day.

## Core Concepts

- Sequential flow: Sight word must be completed before math unlocks
- Math module has two problems: one addition + one subtraction
- Problems are randomly generated within specified ranges
- Unlimited retries on wrong answers (same problem until correct)
- Each module awards 1 point upon completion

## User Flow

1. Kid visits `/learn`
2. Sees progress indicator: `[ ] Sight Word → [ ] Math`
3. Completes sight word quiz (existing flow)
4. Progress updates: `[✓] Sight Word → [ ] Math`
5. Math module unlocks, shows addition problem first
6. Kid solves addition, then subtraction appears
7. After both correct: celebration, +1 point, progress shows `[✓] Sight Word → [✓] Math`
8. If kid returns later: "All done for today!" state

## Math Problem Generation

### Ranges

- **Addition**: Two numbers that sum to ≤ 99 (e.g., 34 + 25, 8 + 47)
- **Subtraction**: First number ≤ 100, second number ≤ first number, result ≥ 0 (e.g., 73 - 28, never 28 - 73)

### Deterministic Generation

Problems are generated using a seed derived from `date + kidId`. This ensures:
- Same kid sees same problems if they return later that day
- Different kids get different problems
- Problems change daily

### UI Presentation

- Text only: `34 + 25 = ?`
- Kid types answer in input field
- Wrong answer: shake animation, "Try again!", same problem
- Correct answer: confetti, advances to next problem (or completes)

## Data Model

### New Table: MathProgress

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| kidId | String | FK to User |
| date | DateTime | The day (normalized to midnight in user's timezone) |
| additionPassedAt | DateTime? | When addition was answered correctly |
| subtractionPassedAt | DateTime? | When subtraction was answered correctly |
| pointAwarded | Boolean | Whether the point was given |
| createdAt | DateTime | Record creation time |
| updatedAt | DateTime | Last update time |

**Constraints:**
- Unique: `kidId` + `date` (one record per kid per day)
- Point awarded when both `additionPassedAt` and `subtractionPassedAt` are set

## API Routes

### GET `/api/math/today`

Get today's math problems and completion status.

**Query params:**
- `timezone`: User's timezone for date calculation
- `kidId` (optional): For parent view-as mode

**Response:**
```json
{
  "addition": { "a": 34, "b": 25 },
  "subtraction": { "a": 73, "b": 28 },
  "additionComplete": false,
  "subtractionComplete": false,
  "pointAwarded": false
}
```

### POST `/api/math/submit`

Submit an answer for a math problem.

**Request body:**
```json
{
  "type": "addition",
  "answer": 59,
  "kidId": "optional-for-view-as",
  "timezone": "America/Los_Angeles"
}
```

**Response:**
```json
{
  "correct": true,
  "pointAwarded": false
}
```

Point is awarded (and `pointAwarded: true` returned) only when both problems are complete.

## Components

### New Components

| Component | Purpose |
|-----------|---------|
| `LearningCenter` | Wrapper that orchestrates sight word and math modules |
| `ProgressIndicator` | Visual step indicator: `[✓] Sight Word → [ ] Math` |
| `MathModule` | Handles the two-problem math flow |
| `MathCard` | Single problem display with input field |

### Modified Components

| Component | Change |
|-----------|--------|
| `LearnView` | Add `onComplete` callback prop |
| `NavBar` | Rename "Sight Words" to "Learn", link to `/learn` |
| `MobileNav` | Rename "Sight Words" to "Learn", link to `/learn` |

### Component Hierarchy

```
LearningCenter
├── ProgressIndicator
├── LearnView (sight words, existing)
│   └── onComplete → unlocks math
└── MathModule
    ├── MathCard (addition)
    ├── MathCard (subtraction)
    └── Celebration state
```

### Styling

- Sight word cards: blue-to-purple gradient (existing)
- Math cards: orange-to-yellow gradient (new)
- Locked math state: grayed out with lock icon
- Same card dimensions, input styles, and confetti effects

## Navigation Changes

- Rename menu item from "Sight Words" to "Learn"
- Update link to point to `/learn`
- Files to update:
  - `src/components/NavBar.tsx`
  - `src/components/MobileNav.tsx`

## Files to Create/Modify

### New Files

- `src/components/learn/LearningCenter.tsx`
- `src/components/learn/MathModule.tsx`
- `src/components/learn/MathCard.tsx`
- `src/components/learn/ProgressIndicator.tsx`
- `src/app/api/math/today/route.ts`
- `src/app/api/math/submit/route.ts`
- `src/lib/math-utils.ts` (problem generation logic)

### Modified Files

- `prisma/schema.prisma` - add MathProgress model
- `src/app/(kid)/learn/page.tsx` - use LearningCenter
- `src/app/(parent)/view-as/learn/page.tsx` - use LearningCenter
- `src/components/learn/LearnView.tsx` - add onComplete prop
- `src/components/NavBar.tsx` - rename menu item
- `src/components/MobileNav.tsx` - rename menu item
- `src/locales/en.json` - add math translations
- `src/locales/zh.json` - add math translations

## Localization Keys

```json
{
  "learn": {
    "title": "Learning Center",
    "progress": "Today's Progress",
    "sightWord": "Sight Word",
    "math": "Math",
    "mathLocked": "Complete sight word first",
    "addition": "Addition",
    "subtraction": "Subtraction",
    "typeMathAnswer": "Type your answer",
    "allDoneToday": "All done for today!",
    "mathComplete": "Math complete!"
  }
}
```

## Edge Cases

### Timezone Handling

- Use user's local timezone for "today" calculation (same as sight words)
- Store dates normalized to midnight in user's timezone

### View-As Mode

- Parents can view kid's learning center progress
- Parents can submit answers on behalf of kids (same as sight words)

### Returning User

- If kid completes sight word and leaves, math remains unlocked when they return
- If kid completes both, shows celebration "all done" state

### No Sight Words Configured

- If family has no sight words, show message and skip to math module
- Or: require at least one sight word to use learning center (simpler)
