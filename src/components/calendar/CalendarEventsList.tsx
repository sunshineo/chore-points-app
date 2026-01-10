"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

interface Props {
  events: CalendarEvent[];
  selectedDate: Date;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
  loading: boolean;
}

export default function CalendarEventsList({
  events,
  selectedDate,
  onEdit,
  onDelete,
  loading,
}: Props) {
  const t = useTranslations("calendar");

  // Filter and sort events for the current month
  const monthEvents = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    return events
      .filter((event) => {
        const eventDate = new Date(
          event.start.date || event.start.dateTime || ""
        );
        return (
          eventDate.getFullYear() === year && eventDate.getMonth() === month
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.start.date || a.start.dateTime || "");
        const dateB = new Date(b.start.date || b.start.dateTime || "");
        return dateA.getTime() - dateB.getTime();
      });
  }, [events, selectedDate]);

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.date) {
      // All-day event
      return t("allDay");
    }

    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = event.end.dateTime ? new Date(event.end.dateTime) : null;

      const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
      };

      if (end) {
        return `${start.toLocaleTimeString([], timeFormat)} - ${end.toLocaleTimeString([], timeFormat)}`;
      }
      return start.toLocaleTimeString([], timeFormat);
    }

    return "";
  };

  const formatEventDate = (event: CalendarEvent) => {
    const date = new Date(event.start.date || event.start.dateTime || "");
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{t("upcomingEvents")}</h3>
      </div>

      {monthEvents.length === 0 ? (
        <div className="p-6 text-center text-gray-500">{t("noEvents")}</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {monthEvents.map((event) => (
            <div
              key={event.id}
              className="p-4 hover:bg-gray-50 transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">
                      {formatEventDate(event)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatEventTime(event)}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 truncate">
                    {event.summary}
                  </h4>
                  {event.description && (
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {event.description}
                    </p>
                  )}
                  {event.location && (
                    <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {event.location}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => onEdit(event)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title={t("edit")}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(event.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title={t("delete")}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      title={t("openInGoogleCalendar")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
