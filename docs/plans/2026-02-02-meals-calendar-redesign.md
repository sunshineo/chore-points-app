# Meals Tab Redesign: Calendar-Based Tracking & Planning

## Overview

Redesign the meals tab from dish-centric to day-centric, enabling:
- Daily meal recording (what did we eat?)
- Daily item tracking (fruits, dairy not tied to meals)
- Calendar view of meal history
- Bulk weekly planning with AI feedback on demand
- Voting integration to guide meal planning

## Core Concepts

### Shared Family Entries
- One entry per day per family (not individual tracking)
- Anyone in the family can log or edit meals
- Planned meals auto-convert to records when the day arrives

### Flexible Meal Structure
- Track any meals: breakfast, lunch, dinner, snacks
- Focus on dinner initially, expandable as needed
- Each meal can include dishes from library or free-form text

### Daily Items
- Track specific items consumed throughout the day
- Not tied to meals (fruits, milk, yogurt, etc.)
- Simple item list per day

## Data Model

### DailyMealLog
```
- id: string
- familyId: string
- date: Date (unique per family)
- meals: Meal[]
- dailyItems: string[] (e.g., ["Apples", "Whole milk"])
- notes: string (optional)
- createdAt: Date
- updatedAt: Date
```

### Meal
```
- id: string
- type: string (breakfast, lunch, dinner, snack, custom)
- dishes: MealDish[]
- notes: string (optional)
```

### MealDish
```
- dishId: string (nullable - null if free-form)
- dishName: string (from library or typed)
- freeForm: boolean
```

### WeeklyPlan
```
- id: string
- familyId: string
- weekStartDate: Date (Monday of the week)
- plannedDays: PlannedDay[]
- weeklyStaples: string[] (fruits, dairy for the week)
- aiRecommendation: string (nullable - only if requested)
- aiGeneratedAt: Date (nullable)
- createdAt: Date
- updatedAt: Date
```

### PlannedDay
```
- date: Date
- meals: Meal[] (same structure as DailyMealLog)
```

## User Interface

### Weekly Calendar View (Default)

The main meals tab landing page shows a 7-day calendar:

```
┌─────────────────────────────────────────────────┐
│  Meals          [Calendar] [Dishes] [Groceries] │
├─────────────────────────────────────────────────┤
│  ← Jan 27 - Feb 2, 2026 →          [Plan Week] │
├───────┬───────┬───────┬───────┬───────┬───────┬───────┤
│  Mon  │  Tue  │  Wed  │  Thu  │  Fri  │  Sat  │  Sun  │
│  27   │  28   │  29   │  30   │  31   │  1    │  2    │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│Dinner:│Dinner:│Dinner:│Dinner:│       │       │       │
│Stir   │Pasta  │Tacos  │Soup   │  +    │  +    │  +    │
│fry    │       │       │       │       │       │       │
│🍎🥛  │🍎🥛  │🍎    │🥛    │       │       │       │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

**Day Cell States:**
- Empty: Gray, muted, shows "+" to add
- Planned: Blue outline (future days with plan)
- Recorded: Solid fill (past days with logged meals)
- Today: Highlighted border

**Navigation:**
- Swipe or arrows to move between weeks
- "Today" button to jump to current week
- Tap any day to open Day Detail View

### Day Detail View

Full view when tapping a day:

```
┌─────────────────────────────────────────────────┐
│  ← Tuesday, Jan 28                    [Edit]    │
├─────────────────────────────────────────────────┤
│  MEALS                                          │
│  ┌─────────────────────────────────────────┐   │
│  │ 🍽 Dinner                                │   │
│  │   • Kung Pao Chicken (from library)     │   │
│  │   • Steamed rice                        │   │
│  │   Note: Kids loved it                   │   │
│  └─────────────────────────────────────────┘   │
│  [+ Add Meal]                                   │
│                                                 │
│  DAILY ITEMS                                    │
│  🍎 Apples  🥛 Whole milk  🍊 Oranges          │
│  [+ Add Item]                                   │
│                                                 │
│  NOTES                                          │
│  Grandma cooked today                           │
└─────────────────────────────────────────────────┘
```

### Bulk Planning View

Accessed via "Plan Week" button:

```
┌─────────────────────────────────────────────────┐
│  ← Plan: Feb 3-9, 2026                 [Save]   │
├─────────────────────────────────────────────────┤
│  MONDAY, FEB 3                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Dinner: [+ Add dishes]                  │   │
│  └─────────────────────────────────────────┘   │
│  [+ Add meal]                                   │
│                                                 │
│  TUESDAY, FEB 4                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Dinner: Kung Pao Chicken ⭐3            │   │
│  └─────────────────────────────────────────┘   │
│  [+ Add meal]                                   │
│                                                 │
│  ... (Wed-Sun) ...                              │
│                                                 │
│  WEEKLY STAPLES                                 │
│  🍎 Apples  🥛 Milk  🍌 Bananas  [+ Add]       │
│  (Assumed consumed daily)                       │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Get AI Feedback]                              │
└─────────────────────────────────────────────────┘
```

### Dish Picker

When adding a dish to a meal:

```
┌─────────────────────────────────────────────────┐
│  Select Dish                              [×]   │
├─────────────────────────────────────────────────┤
│  🔍 Search dishes...                            │
│                                                 │
│  FROM YOUR LIBRARY (sorted by votes)            │
│  ┌─────────────────────────────────────────┐   │
│  │ 🍗 Kung Pao Chicken           ⭐ 3 votes│   │
│  │    Mom, Dad, Lily                       │   │
│  ├─────────────────────────────────────────┤   │
│  │ 🍝 Spaghetti Bolognese        ⭐ 2 votes│   │
│  │    Dad, Lily                            │   │
│  ├─────────────────────────────────────────┤   │
│  │ 🌮 Tacos                      ⭐ 2 votes│   │
│  │    Mom, Lily                            │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [+ Type custom dish]                           │
└─────────────────────────────────────────────────┘
```

### AI Feedback Panel

Shown when "Get AI Feedback" is pressed:

```
┌─────────────────────────────────────────────────┐
│  AI Feedback for Feb 3-9            [Dismiss]   │
├─────────────────────────────────────────────────┤
│  📊 OVERALL                                     │
│  Good variety this week! A few suggestions:     │
│                                                 │
│  ⚖️ NUTRITIONAL BALANCE                        │
│  • Tuesday: Heavy on carbs, add a vegetable    │
│  • Friday: Great balance of protein & veggies  │
│                                                 │
│  🔄 VARIETY                                     │
│  • Chicken appears 3 times - try fish or pork  │
│    on Wednesday                                 │
│  • Good vegetable variety overall              │
│                                                 │
│  👶 KID-FRIENDLY                                │
│  • Thursday's curry may be spicy for kids      │
│  • Consider mild version or backup option      │
│                                                 │
│  ✅ POSITIVES                                   │
│  • Weekly staples provide good daily nutrition │
│  • Nice mix of cuisines                        │
└─────────────────────────────────────────────────┘
```

## Workflow

### Daily Recording

1. Open Meals tab → Weekly calendar view
2. Tap a day → Day Detail View
3. Add meals (pick from library or type free-form)
4. Add daily items (fruits, dairy, etc.)
5. Changes save automatically

### Weekly Planning

1. Open Meals tab → Tap "Plan Week"
2. See bulk planning view for next week
3. For each day, add meals:
   - Tap "Add dishes" → Dish picker shows library sorted by votes
   - Select dishes or type custom
4. Add weekly staples (fruits, dairy assumed daily)
5. Save plan
6. Optionally tap "Get AI Feedback" for recommendations
7. Adjust plan based on feedback if desired

### Auto-Convert

- When a planned day arrives, it becomes the day's log automatically
- No user action required
- Family can edit if actual meal differed from plan

### Voting Integration

- Existing dish voting stays unchanged
- Family votes on dishes throughout the week
- When planning, dish picker shows vote counts
- Planner uses popular dishes to satisfy family preferences

## Navigation Structure

```
Meals Tab
├── Calendar (default)
│   ├── Weekly view with day cells
│   ├── Day Detail (tap a day)
│   └── Plan Week (button)
├── Dishes
│   ├── Dish library (existing)
│   ├── Add/edit dishes
│   └── Vote on dishes
└── Groceries
    └── Generated from weekly plan (existing)
```

## Migration from Current System

### What Stays
- Dish library and all dishes
- Voting on dishes
- Grocery list generation

### What Changes
- Weekly meal plan → Day-based planning
- Plan structure changes from dish list to day-by-day meals

### Migration Path
1. Keep existing WeeklyMealPlan table temporarily
2. Add new DailyMealLog and WeeklyPlan tables
3. Migrate any active plans to new structure
4. Remove old table after verification

## API Endpoints

### Daily Meal Logs
- `GET /api/meals/daily?date=YYYY-MM-DD` - Get log for a day
- `GET /api/meals/daily?start=YYYY-MM-DD&end=YYYY-MM-DD` - Get range
- `POST /api/meals/daily` - Create/update day's log
- `DELETE /api/meals/daily/:id` - Delete a day's log

### Weekly Plans
- `GET /api/meals/plans?week=YYYY-MM-DD` - Get plan for a week
- `POST /api/meals/plans` - Create/update weekly plan
- `POST /api/meals/plans/:id/ai-feedback` - Request AI feedback
- `DELETE /api/meals/plans/:id` - Delete a plan

### Existing (unchanged)
- `/api/dishes` - Dish CRUD
- `/api/votes` - Voting
- `/api/meals/grocery-list` - Generate grocery list

## Technical Notes

### Auto-Convert Logic
- Run on app load or via cron job
- Check if today has a plan but no log
- Copy planned meals to DailyMealLog
- Mark as auto-converted (for potential "undo" or tracking)

### AI Feedback
- Only called when user presses button
- Sends: week's meals, weekly staples, dish ingredients
- Optionally include recent meal history for variety analysis
- Response stored on WeeklyPlan for re-viewing

### Calendar Performance
- Load current week by default
- Lazy-load adjacent weeks on navigation
- Cache recent weeks client-side

## Future Enhancements (Not in Scope)

- Individual meal tracking per person
- Nutritional data and calorie counting
- Recipe integration
- Meal prep scheduling
- Restaurant meal logging
