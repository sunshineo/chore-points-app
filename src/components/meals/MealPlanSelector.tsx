"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

type Dish = {
  id: string;
  name: string;
  photoUrl: string;
  ingredients: string[];
};

type MealPlanSelectorProps = {
  onPlanSaved: (dishes: Dish[]) => void;
};

export default function MealPlanSelector({ onPlanSaved }: MealPlanSelectorProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();
  const isParent = session?.user?.role === "PARENT";

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishIds, setSelectedDishIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const fetchDishes = useCallback(async () => {
    try {
      const response = await fetch("/api/dishes");
      const data = await response.json();
      if (response.ok) {
        setDishes(data.dishes);
      }
    } catch (err) {
      console.error("Failed to fetch dishes:", err);
    }
  }, []);

  const fetchCurrentPlan = useCallback(async () => {
    try {
      const response = await fetch("/api/meal-plans");
      const data = await response.json();
      if (response.ok && data.plan) {
        const plannedDishIds = new Set<string>(
          data.plan.plannedMeals.map((pm: { dish: { id: string } }) => pm.dish.id)
        );
        setSelectedDishIds(plannedDishIds);
      }
    } catch (err) {
      console.error("Failed to fetch plan:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDishes();
    fetchCurrentPlan();
  }, [fetchDishes, fetchCurrentPlan]);

  const toggleDish = (dishId: string) => {
    if (!isParent) return;

    setSelectedDishIds((prev) => {
      const next = new Set(prev);
      if (next.has(dishId)) {
        next.delete(dishId);
      } else {
        next.add(dishId);
      }
      return next;
    });
  };

  const handleSavePlan = async () => {
    if (!isParent) return;

    setSaving(true);
    try {
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishIds: Array.from(selectedDishIds) }),
      });

      if (response.ok) {
        setSavedMessage(true);
        setTimeout(() => setSavedMessage(false), 2000);

        // Pass selected dishes to parent
        const selectedDishes = dishes.filter((d) => selectedDishIds.has(d.id));
        onPlanSaved(selectedDishes);
      }
    } catch (err) {
      console.error("Failed to save plan:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">{tCommon("loading")}</div>;
  }

  if (dishes.length === 0) {
    return null;
  }

  const selectedCount = selectedDishIds.size;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("planNextWeek")}</h2>
          <p className="text-sm text-gray-500">{t("planDesc")}</p>
        </div>
        {isParent && selectedCount > 0 && (
          <span className="text-sm text-orange-600 font-medium">
            {selectedCount} {t("selectedDishes")}
          </span>
        )}
      </div>

      {/* Dish Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {dishes.map((dish) => {
          const isSelected = selectedDishIds.has(dish.id);
          return (
            <button
              key={dish.id}
              type="button"
              onClick={() => toggleDish(dish.id)}
              disabled={!isParent}
              className={`relative rounded-lg overflow-hidden aspect-square ${
                isSelected
                  ? "ring-2 ring-orange-500 ring-offset-2"
                  : "hover:opacity-80"
              } ${!isParent ? "cursor-default" : ""}`}
            >
              <img
                src={dish.photoUrl}
                alt={dish.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">
                  {dish.name}
                </p>
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Save Button */}
      {isParent && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSavePlan}
            disabled={saving}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? tCommon("saving") : t("savePlan")}
          </button>
          {savedMessage && (
            <span className="text-green-600 text-sm">{t("planSaved")}</span>
          )}
        </div>
      )}
    </div>
  );
}
