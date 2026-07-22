// ── Timing ──

export const AUTO_CLOSE_MS = 30000
export const TIME_TRAVEL_TIMEOUT_MS = 30000
export const REFRESH_INTERVAL = 30000
export const POST_BOOK_RAPID_INTERVAL = 1000
export const POST_BOOK_RAPID_DURATION = 15000
export const OPTIMISTIC_IN_USE_DURATION = 15000
export const MIN_UPTIME_FOR_RELOAD = 5 * 60000
export const SCREEN_DIM_TIMEOUT_MS = 10 * 60 * 1000
export const SCREEN_OFF_TIMEOUT_MS = 10 * 60 * 1000
export const SCREEN_DIM_OPACITY = 0.6
export const SCREEN_OFF_START_HOUR = 18
export const SCREEN_OFF_END_HOUR = 7
export const DEPLOYMENT_VERSION_POLL_INTERVAL_MS = 15 * 1000

// ── Meet participants polling ──

export const MEET_EARLY_POLL_INTERVAL = 15000       // 15s for first 5 min
export const MEET_NORMAL_POLL_INTERVAL = 30000      // 30s after that
export const MEET_EARLY_PHASE_DURATION = 5 * 60000  // 5 minutes

// ── Business logic ──

export const WORK_DAY_START_HOUR = 8

// ── Google API (client-side) ──

export const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/meetings.space.readonly'
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
export const TOKEN_KEY = 'gcal_token'
export const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000
export const DEFAULT_API_KEY = 'AIzaSyDP9bt-G0tgBNWGIoxYMV7vNxx-lT3I4JM'
export const DEFAULT_CLIENT_ID = '961612899421-hkrid21kugiikch6lul2kuqo004ekj6p.apps.googleusercontent.com'
