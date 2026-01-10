"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  getDailyTotals,
  getDayIndicator,
  getDaysInMonth,
  getFirstDayOfMonth,
  toDateKey,
} from "@/lib/points-utils";

type PointEntry = {
  id: string;
  points: number;
  date: string;
  note?: string | null;
  photoUrl?: string | null;
  chore?: { title: string } | null;
};

type PointsCalendarProps = {
  entries: PointEntry[];
};

export default function PointsCalendar({ entries }: PointsCalendarProps) {
  const [today, setToday] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");

  const weekdays = t.raw("weekdays") as string[];
  const months = t.raw("months") as string[];

  useEffect(() => {
    setToday(new Date());
  }, []);

  const dailyTotals = getDailyTotals(entries);

  // Get entries for a specific date
  const getEntriesForDate = (dateKey: string): PointEntry[] => {
    return entries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return toDateKey(entryDate) === dateKey;
    });
  };

  // Get selected date entries
  const selectedDateEntries = selectedDate ? getEntriesForDate(selectedDate) : [];
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isToday = (date: Date): boolean => {
    if (!today) return false;
    return toDateKey(date) === toDateKey(today);
  };

  const isFuture = (date: Date): boolean => {
    if (!today) return false;
    return date > today;
  };

  if (!today) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label={t("previousMonth")}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h3 className="text-lg font-bold text-gray-800">
          {months[currentMonth]} {currentYear}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label={t("nextMonth")}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-xl">🔥</span>
          <span className="text-gray-600">{t("moreThan10")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl">💎</span>
          <span className="text-gray-600">{t("oneOrMore")}</span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day, index) => (
          <div
            key={index}
            className="text-center text-xs font-medium text-gray-500 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first of the month */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {daysInMonth.map((date) => {
          const dateKey = toDateKey(date);
          const points = dailyTotals.get(dateKey) || 0;
          const indicator = getDayIndicator(points);
          const todayClass = isToday(date);
          const futureDay = isFuture(date);
          const hasActivity = !futureDay && indicator !== "none";

          return (
            <button
              key={dateKey}
              onClick={() => hasActivity && setSelectedDate(dateKey)}
              disabled={!hasActivity}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${
                todayClass
                  ? "bg-blue-100 ring-2 ring-blue-400"
                  : futureDay
                  ? "bg-gray-50"
                  : indicator === "fire"
                  ? "bg-orange-100"
                  : indicator === "star"
                  ? "bg-cyan-100"
                  : "bg-gray-100"
              } ${hasActivity ? "cursor-pointer hover:ring-2 hover:ring-blue-300" : ""}`}
            >
              <span
                className={`text-sm font-medium ${
                  futureDay ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {date.getDate()}
              </span>
              {hasActivity && (
                <span className="text-lg leading-none">
                  {indicator === "fire" ? "🔥" : "💎"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day Activities Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedDateEntries.reduce((sum, e) => sum + e.points, 0)} {tCommon("points")}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Activities List */}
            <div className="p-4 space-y-3">
              {selectedDateEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No activities this day</p>
              ) : (
                selectedDateEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {/* Photo thumbnail if exists */}
                    {entry.photoUrl && (
                      <img
                        src={entry.photoUrl}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {entry.chore?.title || entry.note || "Activity"}
                        </p>
                        {entry.points > 0 && (
                          <span className="flex-shrink-0 text-sm font-semibold text-green-600">
                            +{entry.points} {tCommon("pts")}
                          </span>
                        )}
                      </div>
                      {entry.note && entry.chore && (
                        <p className="text-sm text-gray-600 mt-1">{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
