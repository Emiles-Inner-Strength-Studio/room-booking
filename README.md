# Room Booking

iPad kiosk app for room booking, connected to Google Workspace Calendar resources.

## Features

- Live availability status (Available / In Use)
- Instant booking with duration picker — no auth required for guests
- Today's full schedule timeline
- Secret tap (top-right corner ×3) to open Settings
- Pure static — no backend required

## Setup

### 1. Google Cloud credentials

You need a Google Cloud project with:
- **Calendar API** enabled
- An **OAuth 2.0 Client ID** (Desktop app or Web app)
- An **API Key** (restricted to Calendar API)

### 2. Deploy

```bash
npm install
npm run build
# Serve the dist/ folder from any static host
```

Or run locally:
```bash
npm run dev
```

### 3. Configure on the iPad

1. Open the app in Safari (or kiosk browser)
2. Tap the top-right corner 3 times to open Settings
3. Enter your Client ID and API Key → Save & Reload
4. Sign in with Google (use the account that has access to the room resource)
5. Select the room calendar → Done

### 4. Share room resource with your Google account

In Google Workspace Admin or Calendar:
- Share the room resource calendar with your account (read/write)

## Stack

- React + Vite
- Tailwind CSS v4
- Google Calendar API (browser-side OAuth via GIS)
