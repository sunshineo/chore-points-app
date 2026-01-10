"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface Props {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  events: CalendarEvent[];
  loading: boolean;
}

export default function CalendarMonthView({
  selectedDate,
  onDateChange,
  events,
  loading,
}: Props) {
  const t = useTranslations("calendar");

  const { days, firstDayOfWeek } = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const firstDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return { days, firstDayOfWeek };
  }, [selectedDate]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dateStr = event.start.date || event.start.dateTime?.split("T")[0];
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(event);
      }
    });
    return map;
  }, [events]);

  const goToPreviousMonth = () => {
    onDateChange(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    onDateChange(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return eventsByDate[dateStr] || [];
  };

  const weekDays = [
    t("sun"),
    t("mon"),
    t("tue"),
    t("wed"),
    t("thu"),
    t("fri"),
    t("sat"),
  ];

  const monthNames = [
    t("january"),
    t("february"),
    t("march"),
    t("april"),
    t("may"),
    t("june"),
    t("july"),
    t("august"),
    t("september"),
    t("october"),
    t("november"),
    t("december"),
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-200 rounded-lg transition"
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

        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h3>
          <button
            onClick={goToToday}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t("today")}
          </button>
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-200 rounded-lg transition"
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

      {/* Week days header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells for days before the first of the month */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 bg-gray-50"
          />
        ))}

        {/* Days of the month */}
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={day}
              className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 p-1 ${
                isToday(day) ? "bg-blue-50" : ""
              }`}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  isToday(day)
                    ? "w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full"
                    : "text-gray-700"
                }`}
              >
                {day}
              </div>
              {hasEvents && (
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate"
                      title={event.summary}
                    >
                      {event.summary}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} {t("more")}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
