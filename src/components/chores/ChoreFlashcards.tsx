"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Chore = {
  id: string;
  title: string;
  icon: string | null;
  defaultPoints: number;
};

// Default icons for common chores (emoji-based, game-style)
const defaultIcons: Record<string, string> = {
  // Cleaning - RPG style
  "clean": "🧹",
  "vacuum": "🌀",
  "sweep": "🧹",
  "mop": "🪣",
  "dust": "✨",
  "tidy": "🧺",
  "wipe": "🧽",
  "scrub": "🫧",
  "polish": "💫",
  "sanitize": "🧴",
  // Dishes - Kitchen quest
  "dish": "🍽️",
  "dishes": "🍽️",
  "wash dishes": "🍽️",
  "load dishwasher": "🫧",
  "unload dishwasher": "🍽️",
  "dry dishes": "💨",
  "put away dishes": "🗄️",
  // Laundry - Fabric dungeon
  "laundry": "👕",
  "clothes": "👕",
  "fold": "👔",
  "wash clothes": "🧺",
  "hang": "🪝",
  "iron": "♨️",
  "sort laundry": "🎨",
  "put away clothes": "🗄️",
  // Clothing types - Wardrobe quest
  "pajama": "🩱",
  "pyjama": "🩱",
  "pj": "🩱",
  "nightwear": "🌙",
  "school clothes": "🎒",
  "uniform": "👔",
  "shirt": "👕",
  "pants": "👖",
  "jeans": "👖",
  "dress": "👗",
  "skirt": "👗",
  "jacket": "🧥",
  "coat": "🧥",
  "sweater": "🧶",
  "hoodie": "🧥",
  "socks": "🧦",
  "shoes": "👟",
  "sneakers": "👟",
  "boots": "👢",
  "sandals": "🩴",
  "hat": "🧢",
  "cap": "🧢",
  "scarf": "🧣",
  "gloves": "🧤",
  "tie": "👔",
  "underwear": "🩲",
  "swimsuit": "🩱",
  "sports": "🏃",
  "sportswear": "🎽",
  "jersey": "🎽",
  "ballet": "🩰",
  "dance": "🩰",
  // Bedroom - Rest zone
  "bed": "🛏️",
  "make bed": "🛏️",
  "bedroom": "🛏️",
  "pillow": "🛋️",
  "blanket": "🧣",
  "sheets": "🛏️",
  // Bathroom - Splash zone
  "bathroom": "🚿",
  "toilet": "🚽",
  "brush teeth": "🪥",
  "shower": "🚿",
  "bath": "🛁",
  "mirror": "🪞",
  "sink": "🚰",
  "towel": "🧻",
  // Kitchen - Cooking arena
  "cook": "👨‍🍳",
  "cooking": "👨‍🍳",
  "kitchen": "🍳",
  "bake": "🥐",
  "meal": "🍲",
  "breakfast": "🥞",
  "lunch": "🥪",
  "dinner": "🍝",
  "snack": "🍪",
  "table": "🪑",
  "set table": "🍴",
  "clear table": "✨",
  // Trash - Disposal mission
  "trash": "🗑️",
  "garbage": "🗑️",
  "take out trash": "🗑️",
  "recycling": "♻️",
  "compost": "🌿",
  "bin": "🗑️",
  // Pets - Animal companion quests
  "pet": "🐕",
  "dog": "🐕",
  "cat": "🐱",
  "feed pet": "🦴",
  "walk dog": "🦮",
  "fish": "🐠",
  "bird": "🐦",
  "hamster": "🐹",
  "rabbit": "🐰",
  "turtle": "🐢",
  "litter": "🪣",
  "cage": "🏠",
  "aquarium": "🐟",
  "brush pet": "🪮",
  // Garden/Outdoor - Nature realm
  "garden": "🌱",
  "water plants": "💧",
  "plants": "🪴",
  "yard": "🌿",
  "lawn": "🌿",
  "mow": "🚜",
  "rake": "🍂",
  "leaves": "🍁",
  "weed": "🌾",
  "flower": "🌸",
  "tree": "🌳",
  "shovel": "⛏️",
  "hose": "🚿",
  "sprinkler": "💦",
  "outdoor": "☀️",
  "patio": "🏖️",
  "deck": "🪵",
  "garage": "🏠",
  "driveway": "🛣️",
  "snow": "❄️",
  "shovel snow": "⛄",
  // Homework - Study quest
  "homework": "📚",
  "study": "📖",
  "read": "📖",
  "reading": "📖",
  "math": "🔢",
  "write": "✏️",
  "practice": "🎯",
  "piano": "🎹",
  "music": "🎵",
  "instrument": "🎸",
  "art": "🎨",
  "draw": "🖍️",
  "science": "🔬",
  "project": "📋",
  "computer": "💻",
  "typing": "⌨️",
  // Organization - Inventory management
  "organize": "📦",
  "sort": "🗂️",
  "arrange": "📐",
  "storage": "🗄️",
  "closet": "🚪",
  "drawer": "🗃️",
  "shelf": "📚",
  "toy": "🧸",
  "toys": "🎮",
  "game": "🎲",
  "book": "📗",
  "backpack": "🎒",
  "desk": "🖥️",
  // Shopping/Errands - Town quests
  "help": "🤝",
  "grocery": "🛒",
  "shopping": "🛍️",
  "car": "🚗",
  "wash car": "🚙",
  "mail": "📬",
  "package": "📦",
  "errand": "🏃",
  "phone": "📱",
  "message": "💬",
  // Special/Bonus - Power-ups
  "surprise": "🎁",
  "special": "⭐",
  "bonus": "🌟",
  "extra": "➕",
  "quick": "⚡",
  "big": "🏆",
  "super": "💪",
  "mega": "🔥",
  "challenge": "🎯",
  "mission": "🚀",
  // Food prep - Cooking skills
  "chop": "🔪",
  "prep": "🥗",
  "measure": "⚖️",
  "mix": "🥄",
  "pour": "🫗",
  "stir": "🥢",
  // Self-care - Health power-ups
  "teeth": "🦷",
  "hair": "💇",
  "face": "🧼",
  "hands": "🙌",
  "nails": "💅",
  "medicine": "💊",
  "vitamin": "💉",
  // Time-based - Daily quests
  "morning": "🌅",
  "evening": "🌆",
  "night": "🌙",
  "daily": "📅",
  "weekly": "🗓️",
  "routine": "🔄",
};

function getIconForChore(title: string, icon: string | null): string {
  // If custom icon is set, use it
  if (icon) return icon;

  // Try to match title with default icons
  const lowerTitle = title.toLowerCase();

  // Check for exact match first
  if (defaultIcons[lowerTitle]) {
    return defaultIcons[lowerTitle];
  }

  // Check if any key is contained in the title
  for (const [key, emoji] of Object.entries(defaultIcons)) {
    if (lowerTitle.includes(key)) {
      return emoji;
    }
  }

  // Default gem icon
  return "💎";
}

export default function ChoreFlashcards() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("chores");
  const tCommon = useTranslations("common");

  useEffect(() => {
    fetchChores();
  }, []);

  const fetchChores = async () => {
    try {
      const response = await fetch("/api/chores/available");
      const data = await response.json();
      if (response.ok) {
        setChores(data.chores);
      }
    } catch (error) {
      console.error("Failed to fetch chores:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-2xl p-6 animate-pulse h-40"
          />
        ))}
      </div>
    );
  }

  if (chores.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <p className="text-gray-500">{t("noChoresYet")}</p>
        <p className="text-sm text-gray-400 mt-1">
          {t("askParents")}
        </p>
      </div>
    );
  }

  // Color palette for flashcards
  const colors = [
    "from-pink-400 to-pink-500",
    "from-purple-400 to-purple-500",
    "from-indigo-400 to-indigo-500",
    "from-blue-400 to-blue-500",
    "from-cyan-400 to-cyan-500",
    "from-teal-400 to-teal-500",
    "from-green-400 to-green-500",
    "from-yellow-400 to-yellow-500",
    "from-orange-400 to-orange-500",
    "from-red-400 to-red-500",
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {chores.map((chore, index) => (
        <div
          key={chore.id}
          className={`bg-gradient-to-br ${colors[index % colors.length]} rounded-2xl p-5 text-white shadow-lg transform hover:scale-105 transition-transform cursor-default`}
        >
          <div className="flex flex-col items-center text-center min-h-[120px]">
            {/* Large Icon */}
            <span className="text-5xl mb-3" role="img" aria-label={chore.title}>
              {getIconForChore(chore.title, chore.icon)}
            </span>

            {/* Chore Title */}
            <h3 className="font-bold text-base leading-tight mb-2">
              {chore.title}
            </h3>

            {/* Points Badge */}
            <div className="mt-auto">
              <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
                +{chore.defaultPoints} {tCommon("points")}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
