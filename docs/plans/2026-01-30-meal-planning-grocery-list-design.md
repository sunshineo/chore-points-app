# Meal Planning & Grocery List Design

## Overview

Extend the meal voting feature to let the chef (parent) select dishes for the week's meal plan, then auto-generate a grocery list from the ingredients of selected dishes.

Also fix voting text from "This Week" to "Next Week".

## Data Model

### Dish (Updated)

Add `ingredients` field to existing Dish model:

| Field | Type | Description |
|-------|------|-------------|
| ingredients | String[] | List of ingredient names (e.g., ["beef", "broccoli", "soy sauce"]) |

### WeeklyPlan (New)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| familyId | String | FK to Family |
| weekStart | DateTime | Monday of the planned week |
| createdById | String | FK to User (the chef) |
| createdAt | DateTime | When plan was created |
| updatedAt | DateTime | Last update |

### PlannedMeal (New)

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| planId | String | FK to WeeklyPlan |
| dishId | String | FK to Dish |
| day | Enum? | Optional: MONDAY-SUNDAY (for future use) |
| mealType | Enum? | Optional: BREAKFAST, LUNCH, DINNER (for future use) |

## User Flow

### Logging a Dish

When logging a new dish, an optional "Ingredients" field appears below the photo upload. Chef types comma-separated ingredients (e.g., "beef, broccoli, soy sauce"). Stored as an array on the Dish for reuse.

Existing dishes can be edited to add ingredients.

### Results Page (Extended)

The `/meals/results` page gets two new sections below vote results:

1. **Plan This Week** - Grid of all dishes. Chef taps to select/deselect dishes for the plan. Selected dishes show a checkmark. "Save Plan" button persists the selection.

2. **Grocery List** - Appears after plan is saved. Shows deduplicated ingredients from all selected dishes. Each ingredient has a checkbox to mark "got it" while shopping. "Copy List" button copies ingredients as text.

### Text Updates

- Voting page: "Vote for This Week" → "Vote for Next Week"
- Results page: "This Week's Votes" → "Next Week's Votes"

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/dishes/[id]` | PATCH | Update dish (add/edit ingredients) |
| `/api/meal-plans` | GET | Get current week's plan with dishes |
| `/api/meal-plans` | POST | Create/update week's plan (list of dishIds) |

## Components

### New Components

| Component | Purpose |
|-----------|---------|
| `IngredientsInput` | Comma-separated text input for ingredients |
| `MealPlanSelector` | Dish grid with select/deselect for planning |
| `GroceryList` | Ingredient list with checkboxes and copy button |

### Modified Components

| Component | Change |
|-----------|--------|
| `LogDishForm` | Add IngredientsInput field |
| `VoteResults` | Add MealPlanSelector and GroceryList sections |
| `VotePageHeader` | "This Week" → "Next Week" |
| `ResultsPageHeader` | "This Week" → "Next Week" |

## Edge Cases

### Ingredients

- Empty ingredients allowed - dish won't contribute to grocery list
- Case-insensitive deduplication ("Beef" = "beef")
- Whitespace trimmed on save

### Weekly Plan

- One plan per family per week (upsert behavior)
- Plan persists - chef can modify throughout the week
- Week starts Monday (same as voting)

### Grocery List

- "Got it" checkmarks stored in localStorage (device-specific, not synced)
- Copy formats as plain text, one ingredient per line
- Empty state: "Add ingredients to your dishes to see a grocery list"

### Permissions

- Any family member can view plan and grocery list
- Only parents can create/edit the plan

## Files to Create

- `src/components/meals/IngredientsInput.tsx`
- `src/components/meals/MealPlanSelector.tsx`
- `src/components/meals/GroceryList.tsx`
- `src/app/api/meal-plans/route.ts`

## Files to Modify

- `prisma/schema.prisma` - Add ingredients to Dish, new WeeklyPlan/PlannedMeal models
- `src/components/meals/LogDishForm.tsx` - Add IngredientsInput
- `src/components/meals/VoteResults.tsx` - Add planning and grocery sections
- `src/components/meals/VotePageHeader.tsx` - Text update
- `src/components/meals/ResultsPageHeader.tsx` - Text update
- `src/locales/en.json` - New translation keys
- `src/locales/zh.json` - New translation keys
