# Dish Library & Simplified Meal Logging

## Problem

Dish creation is currently embedded inline in the meal logging forms (both `LogDishForm` and `DayDetailModal`), making those forms overly complex. Users have to create dishes while logging what they ate, mixing two separate concerns.

## Design

### 1. New Dish Library Page (`/meals/dishes`)

A standalone parent-only page for managing the family's dish collection.

**Layout:**
- Grid of dish cards showing photo, name, and ingredient count
- "Add New Dish" button at the top
- Clicking a card opens the dish for editing

**Create/Edit Dish form (modal):**
- Name — text input (required)
- Photo — upload with preview (required for new, editable for existing)
- Ingredients — simple tag-style list using existing `IngredientsInput` component
- Save / Cancel / Delete (for existing dishes)

**Navigation:** Link/tab from the meals calendar page to `/meals/dishes`.

### 2. Simplified "Add Dish to Day" (DayDetailModal)

The DayDetailModal becomes a **dish picker** instead of a dish creator.

**Primary action — Search & select from library:**
- Searchable dropdown/list of existing dishes with photo thumbnails
- Filter by name
- Select to add to the meal

**Secondary action — Quick-create:**
- If no match found, show "Create new dish" option at bottom of search results
- Mini inline form: name + photo upload only
- Dish is created in the library and immediately added to the meal
- Ingredients can be added later from `/meals/dishes`

**Removed from this flow:**
- Inline ingredient input fields
- Free-form text entry (all entries become proper Dish records)

### 3. Legacy Cleanup

Remove the old parallel meal logging system:
- Delete `LogDishForm.tsx` — old modal combining dish creation + meal logging
- Delete `RecentMeals.tsx` — old list view replaced by calendar
- Delete `EditDishModal.tsx` — absorbed into new dishes page

## Files

| Action | File |
|--------|------|
| Create | `src/app/(parent)/meals/dishes/page.tsx` |
| Create | `src/components/meals/DishLibrary.tsx` |
| Modify | `src/components/meals/DayDetailModal.tsx` — simplify to picker + quick-create |
| Modify | Meals page — add navigation link to `/meals/dishes` |
| Delete | `src/components/meals/LogDishForm.tsx` |
| Delete | `src/components/meals/RecentMeals.tsx` |
| Delete | `src/components/meals/EditDishModal.tsx` |

## Data Model

No schema changes needed. The existing `Dish` model already has all required fields:
- `name`, `photoUrl`, `ingredients` (string array), `familyId`, `createdById`
