# Philips Hue Light Control Integration

## Overview

Add a centralized dashboard for parents to control Philips Hue smart lights from within GemSteps. This provides convenient light control without switching apps, and establishes the foundation for future gamification features (celebration effects, unlockable controls for kids, etc.).

## Requirements

| Aspect | Decision |
|--------|----------|
| **Scope** | Rooms (on/off/brightness) + Scenes |
| **Access** | Remote via Hue Cloud API (works from anywhere) |
| **Permissions** | Parents only (for now) |
| **UI** | Dashboard widget + full `/lights` page |

## Architecture

### Authentication Flow

1. Parent navigates to Settings → "Connect Philips Hue"
2. App redirects to Hue OAuth authorization page
3. User authorizes the app on Hue's site
4. Hue redirects back to `/api/hue/callback` with auth code
5. Backend exchanges code for access + refresh tokens
6. Tokens stored in database, linked to the Family (shared across parents)

### API Communication

- All Hue API calls route through the Next.js backend (tokens stay server-side)
- Use Hue Remote API v2: `https://api.meethue.com/route/api/...`
- Rooms, lights, and scenes fetched on-demand (not cached)
- No local bridge communication - everything goes through Hue cloud

### Token Management

- Hue access tokens expire after ~7 days
- Automatically refresh tokens when expired before making API calls
- If refresh fails, prompt user to reconnect

## Data Model

Add fields to the existing `Family` model in Prisma:

```prisma
model Family {
  // ... existing fields ...

  hueAccessToken    String?
  hueRefreshToken   String?
  hueTokenExpiry    DateTime?
  hueUsername       String?    // Hue API "username" returned after linking
}
```

No caching of rooms/scenes - fetch live from Hue API to stay in sync with changes made in the Hue app.

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/hue/auth` | GET | Initiate OAuth, redirect to Hue |
| `/api/hue/callback` | GET | Handle OAuth callback, store tokens |
| `/api/hue/status` | GET | Check if Hue is connected |
| `/api/hue/disconnect` | DELETE | Remove Hue connection |
| `/api/hue/rooms` | GET | Fetch all rooms with current state |
| `/api/hue/rooms/[id]` | PUT | Control a room (on/off, brightness) |
| `/api/hue/scenes` | GET | Fetch available scenes |
| `/api/hue/scenes/[id]/activate` | POST | Activate a scene |

All routes verify parent role before allowing access.

## UI Components

### Dashboard Widget (`LightsWidget.tsx`)

A compact card on the parent dashboard:

- **Disconnected state**: "Connect Philips Hue" button with brief description
- **Connected state**:
  - 3-4 favorite/most-used rooms with on/off toggles and brightness sliders
  - 2-3 quick scene buttons (e.g., "All Off", "Relax", "Bright")
  - "See all" link to full control page
- **Error state**: "Hue unavailable" with reconnect/retry options

### Full Control Page (`/lights`)

Accessed via "See all" from the dashboard widget.

**Rooms Section:**
- Grid of room cards
- Each card shows:
  - Room name + icon (from Hue room type)
  - On/off toggle switch
  - Brightness slider (0-100%)
  - Visual state indicator

**Scenes Section:**
- Grid of scene buttons
- Grouped by room (room-specific scenes) or "All Rooms" (global scenes)
- Tap to activate
- Visual feedback showing active scene

### Settings Integration

Add "Smart Home" section to the Settings page:

- Connection status indicator
- "Connect Philips Hue" button (when disconnected)
- Bridge name display (when connected)
- "Disconnect" button (when connected)

## Error Handling

### Connection Issues

- **Token expired (401)**: Auto-refresh token and retry once
- **Refresh failed**: Show "Reconnect Hue" prompt
- **Hue cloud unavailable**: Show "Hue unavailable" message with retry button

### State Synchronization

- Lights can change outside the app (Hue app, voice assistants, physical switches)
- Fetch fresh state when widget/page loads
- Provide manual refresh button for re-sync
- No real-time polling (conserves Hue API quota)

### Empty States

- **No rooms**: "No rooms found. Set up rooms in the Hue app first."
- **No scenes**: Hide scenes section, show room controls only
- **Not connected**: "Connect your Philips Hue to control lights" with setup button

### Rate Limiting

- Hue Remote API allows ~10 requests/second
- Debounce brightness slider (update on release, not during drag)
- Normal family use unlikely to hit limits

## Files to Create/Modify

### New Files

- `src/lib/hue.ts` - Hue API client utilities (auth, token refresh, API calls)
- `src/app/api/hue/auth/route.ts` - OAuth initiation
- `src/app/api/hue/callback/route.ts` - OAuth callback handler
- `src/app/api/hue/status/route.ts` - Connection status check
- `src/app/api/hue/disconnect/route.ts` - Remove connection
- `src/app/api/hue/rooms/route.ts` - List rooms
- `src/app/api/hue/rooms/[id]/route.ts` - Control room
- `src/app/api/hue/scenes/route.ts` - List scenes
- `src/app/api/hue/scenes/[id]/activate/route.ts` - Activate scene
- `src/components/lights/LightsWidget.tsx` - Dashboard widget
- `src/components/lights/LightsPageContent.tsx` - Full control page content
- `src/app/(parent)/lights/page.tsx` - Lights page

### Modified Files

- `prisma/schema.prisma` - Add Hue token fields to Family model
- `src/app/(parent)/settings/page.tsx` - Add Smart Home section
- `src/messages/en.json` - English translations
- `src/messages/zh.json` - Chinese translations
- Parent dashboard component - Add LightsWidget

## Future Considerations (Out of Scope)

These features are intentionally excluded from this initial implementation but could be added later:

- **Gamification**: Celebration effects when kids earn points/badges
- **Kid access**: Configurable light control permissions for kids
- **Unlockable scenes**: Kids spend points to run fun light scenes
- **Schedules**: Time-based light automation
- **Individual light control**: Control specific bulbs within rooms
- **Favorites**: Let users pin frequently-used rooms/scenes

## External Dependencies

- Philips Hue Developer Account (to register the app)
- Hue App credentials (Client ID, Client Secret)
- Environment variables: `HUE_CLIENT_ID`, `HUE_CLIENT_SECRET`, `HUE_REDIRECT_URI`
