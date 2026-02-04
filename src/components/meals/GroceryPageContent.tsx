"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import GroceryList from "./GroceryList";
import { getWeekStart } from "@/lib/week-utils";

type Dish = {
  id: string;
  name: string;
  photoUrl: string;
  ingredients: string[];
};

type MealPlanResponse = {
  plan: {
    id: string;
    weekStart: string;
    weeklyStaples: string[];
    plannedDays: {
      id: string;
      date: string;
      meals: {
        id: string;
        mealType: string;
        notes: string | null;
        dishes: {
          id: string;
          dishId: string | null;
          dishName: string;
          isFreeForm: boolean;
          dish: Dish | null;
        }[];
      }[];
    }[];
  } | null;
};

// Helper to format date as YYYY-MM-DD
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function GroceryPageContent() {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = next week, -1 = current week

  // Calculate week start based on offset
  const targetWeekStart = useMemo(() => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today);
    const target = new Date(thisWeekStart);
    // offset 0 = next week, offset -1 = this week
    target.setDate(target.getDate() + 7 + weekOffset * 7);
    return target;
  }, [weekOffset]);

  // Week end date
  const weekEnd = useMemo(() => {
    const end = new Date(targetWeekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [targetWeekStart]);

  // Week range text
  const weekRangeText = useMemo(() => {
    const startMonth = targetWeekStart.toLocaleDateString(undefined, { month: "short" });
    const endMonth = weekEnd.toLocaleDateString(undefined, { month: "short" });
    const startDay = targetWeekStart.getDate();
    const endDay = weekEnd.getDate();
    const year = weekEnd.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }, [targetWeekStart, weekEnd]);

  // Fetch meal plan for the target week
  const fetchMealPlan = useCallback(async () => {
    setLoading(true);
    try {
      const weekStr = toDateString(targetWeekStart);
      const response = await fetch(`/api/meal-plans-v2?week=${weekStr}`);
      const data: MealPlanResponse = await response.json();

      if (response.ok && data.plan) {
        // Extract unique dishes with ingredients
        const dishMap = new Map<string, Dish>();

        data.plan.plannedDays.forEach((day) => {
          day.meals.forEach((meal) => {
            meal.dishes.forEach((mealDish) => {
              if (mealDish.dish && mealDish.dishId) {
                // Only add if we have the full dish object with ingredients
                if (!dishMap.has(mealDish.dishId)) {
                  dishMap.set(mealDish.dishId, mealDish.dish);
                }
              }
            });
          });
        });

        setDishes(Array.from(dishMap.values()));
      } else {
        setDishes([]);
      }
    } catch (err) {
      console.error("Failed to fetch meal plan:", err);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, [targetWeekStart]);

  useEffect(() => {
    fetchMealPlan();
  }, [fetchMealPlan]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("pageTitle")}</h1>
        <p className="mt-2 text-gray-600">{t("pageDesc")}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Link
          href="/meals"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          {t("mealPlan")}
        </Link>
        <Link
          href="/meals/vote"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          {t("vote")}
        </Link>
        <Link
          href="/meals/plan"
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          {t("planNextWeek")}
        </Link>
        <button
          className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium"
        >
          {t("groceryList")}
        </button>
      </div>

      {/* Week selector */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <div className="font-semibold text-gray-900">{weekRangeText}</div>
            <div className="text-sm text-gray-500">
              {weekOffset === 0
                ? t("nextWeek")
                : weekOffset === -1
                ? t("thisWeek")
                : weekOffset > 0
                ? t("weeksAhead", { count: weekOffset })
                : t("weeksAgo", { count: Math.abs(weekOffset) })}
            </div>
          </div>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          <span className="ml-3 text-gray-500">{tCommon("loading")}</span>
        </div>
      ) : dishes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <p className="text-gray-500 mb-4">{t("noIngredientsYet")}</p>
          <Link
            href="/meals/plan"
            className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            {t("planNextWeek")}
          </Link>
        </div>
      ) : (
        <GroceryList dishes={dishes} showHeader={false} />
      )}
    </div>
  );
}
