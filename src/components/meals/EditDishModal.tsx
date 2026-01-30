"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import IngredientsInput from "./IngredientsInput";

type Dish = {
  id: string;
  name: string;
  photoUrl: string;
  ingredients: string[];
};

type EditDishModalProps = {
  dish: Dish;
  onClose: () => void;
  onSave: (updatedDish: Dish) => void;
};

export default function EditDishModal({ dish, onClose, onSave }: EditDishModalProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");

  const [name, setName] = useState(dish.name);
  const [ingredients, setIngredients] = useState<string[]>(dish.ingredients || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const response = await fetch(`/api/dishes/${dish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ingredients }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update dish");
      }

      const data = await response.json();
      onSave(data.dish);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t("editDish")}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dish Photo (read-only) */}
            <div className="flex items-center gap-4">
              <img
                src={dish.photoUrl}
                alt={dish.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("dishName")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>

            {/* Ingredients */}
            <IngredientsInput
              value={ingredients}
              onChange={setIngredients}
            />

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? tCommon("saving") : tCommon("save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
