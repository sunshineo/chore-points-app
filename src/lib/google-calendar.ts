import { prisma } from "@/lib/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  colorId?: string;
  status?: string;
  htmlLink?: string;
}

interface CreateEventInput {
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

/**
 * Get a valid access token for the user, refreshing if necessary
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  });

  if (!account) {
    throw new Error("No Google account found for user");
  }

  if (!account.refresh_token) {
    throw new Error("No refresh token available");
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired =
    account.expires_at && account.expires_at * 1000 < Date.now() + 5 * 60 * 1000;

  if (!isExpired && account.access_token) {
    return account.access_token;
  }

  // Refresh the token
  const tokenData = await refreshAccessToken(account.refresh_token);

  // Update the account with new token
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokenData.access_token,
      expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    },
  });

  return tokenData.access_token;
}

/**
 * List all calendars the user has access to
 */
export async function listCalendars(
  accessToken: string
): Promise<GoogleCalendar[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * List events from a calendar
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: string;
  } = {}
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams();

  if (options.timeMin) params.append("timeMin", options.timeMin);
  if (options.timeMax) params.append("timeMax", options.timeMax);
  if (options.maxResults) params.append("maxResults", options.maxResults.toString());
  if (options.singleEvents !== undefined) params.append("singleEvents", options.singleEvents.toString());
  if (options.orderBy) params.append("orderBy", options.orderBy);

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list events: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Get a single event
 */
export async function getEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<GoogleCalendarEvent> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get event: ${error}`);
  }

  return response.json();
}

/**
 * Create a new event
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: CreateEventInput
): Promise<GoogleCalendarEvent> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create event: ${error}`);
  }

  return response.json();
}

/**
 * Update an existing event
 */
export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CreateEventInput>
): Promise<GoogleCalendarEvent> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update event: ${error}`);
  }

  return response.json();
}

/**
 * Delete an event
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    throw new Error(`Failed to delete event: ${error}`);
  }
}
