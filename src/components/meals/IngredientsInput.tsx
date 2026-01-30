"use client";

import { useTranslations } from "next-intl";

type IngredientsInputProps = {
  value: string[];
  onChange: (ingredients: string[]) => void;
  disabled?: boolean;
};

export default function IngredientsInput({
  value,
  onChange,
  disabled,
}: IngredientsInputProps) {
  const t = useTranslations("meals");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    // Split by comma and trim whitespace
    const ingredients = text
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 0);
    onChange(ingredients);
  };

  // Convert array back to comma-separated string for display
  const displayValue = value.join(", ");

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t("ingredients")}
      </label>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={t("ingredientsPlaceholder")}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
      />
      <p className="mt-1 text-xs text-gray-500">{t("ingredientsHelp")}</p>
    </div>
  );
}
