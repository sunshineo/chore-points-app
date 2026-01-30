"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

type Dish = {
  id: string;
  name: string;
  photoUrl: string;
  ingredients: string[];
};

type GroceryListProps = {
  dishes: Dish[];
};

// Storage key for localStorage (device-specific checkmarks)
const STORAGE_KEY = "grocery-list-checked";

export default function GroceryList({ dishes }: GroceryListProps) {
  const t = useTranslations("meals");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Get all unique ingredients (case-insensitive deduplication)
  const getDeduplicatedIngredients = useCallback(() => {
    const seenLower = new Set<string>();
    const ingredients: string[] = [];

    dishes.forEach((dish) => {
      dish.ingredients.forEach((ingredient) => {
        const lower = ingredient.toLowerCase();
        if (!seenLower.has(lower)) {
          seenLower.add(lower);
          ingredients.push(ingredient);
        }
      });
    });

    return ingredients.sort((a, b) => a.localeCompare(b));
  }, [dishes]);

  const ingredients = getDeduplicatedIngredients();

  // Load checked items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setCheckedItems(new Set(parsed));
      }
    } catch (e) {
      console.error("Failed to load checked items:", e);
    }
  }, []);

  // Save checked items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(checkedItems)));
    } catch (e) {
      console.error("Failed to save checked items:", e);
    }
  }, [checkedItems]);

  const toggleItem = (ingredient: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      const lower = ingredient.toLowerCase();
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  };

  const clearAll = () => {
    setCheckedItems(new Set());
  };

  const copyToClipboard = async () => {
    const text = ingredients
      .filter((i) => !checkedItems.has(i.toLowerCase()))
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  if (ingredients.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-2">{t("groceryList")}</h2>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">{t("noIngredientsYet")}</p>
        </div>
      </div>
    );
  }

  const uncheckedCount = ingredients.filter(
    (i) => !checkedItems.has(i.toLowerCase())
  ).length;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("groceryList")}</h2>
          <p className="text-sm text-gray-500">{t("groceryDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
          >
            {copied ? t("listCopied") : t("copyList")}
          </button>
          {checkedItems.size > 0 && (
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              {t("clearAll")}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-500 mb-3">
          {uncheckedCount} / {ingredients.length}
        </div>
        <ul className="space-y-2">
          {ingredients.map((ingredient) => {
            const isChecked = checkedItems.has(ingredient.toLowerCase());
            return (
              <li key={ingredient}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleItem(ingredient)}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span
                    className={`${
                      isChecked ? "line-through text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {ingredient}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
