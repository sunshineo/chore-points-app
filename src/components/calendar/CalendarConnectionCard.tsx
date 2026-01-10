"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface Calendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

interface CalendarSettings {
  id: string;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  isConnected: boolean;
}

interface Props {
  onConnect: (settings: CalendarSettings) => void;
  settings: CalendarSettings | null;
}

export default function CalendarConnectionCard({ onConnect }: Props) {
  const t = useTranslations("calendar");
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [error, setError] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");

  // Load available calendars
  useEffect(() => {
    async function loadCalendars() {
      setLoadingCalendars(true);
      setError("");
      try {
        const res = await fetch("/api/calendar/calendars");
        const data = await res.json();

        if (res.ok) {
          setCalendars(data.calendars || []);
          // Auto-select primary calendar if available
          const primary = data.calendars?.find((c: Calendar) => c.primary);
          if (primary) {
            setSelectedCalendarId(primary.id);
          }
        } else {
          setError(data.error || t("failedToLoadCalendars"));
        }
      } catch (err) {
        console.error("Failed to load calendars:", err);
        setError(t("failedToLoadCalendars"));
      } finally {
        setLoadingCalendars(false);
      }
    }
    loadCalendars();
  }, [t]);

  const handleConnect = async () => {
    if (!selectedCalendarId) return;

    setLoading(true);
    setError("");

    try {
      const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);

      const res = await fetch("/api/calendar/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCalendarId,
          selectedCalendarName: selectedCalendar?.summary,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onConnect(data.settings);
      } else {
        setError(data.error || t("failedToConnect"));
      }
    } catch (err) {
      console.error("Failed to connect calendar:", err);
      setError(t("failedToConnect"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t("connectCalendar")}
        </h3>
        <p className="text-sm text-gray-500">{t("connectDescription")}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {loadingCalendars ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      ) : calendars.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm mb-4">{t("noCalendarsFound")}</p>
          <p className="text-gray-400 text-xs">{t("signInWithGoogle")}</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("selectCalendar")}
            </label>
            <select
              value={selectedCalendarId}
              onChange={(e) => setSelectedCalendarId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t("chooseCalendar")}</option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                  {calendar.primary ? ` (${t("primary")})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConnect}
            disabled={!selectedCalendarId || loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t("connecting") : t("connect")}
          </button>
        </>
      )}
    </div>
  );
}
