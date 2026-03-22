/**
 * mockData.js — dummy calendar data for local testing
 * Remove this file (and the import in useGoogleCalendar.js) when going live.
 */

export const MOCK_ROOM_NAME = 'Boardroom A'

// Generate events relative to now so the UI always looks realistic
export function getMockEvents() {
  const now = new Date()
  const today = (h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)

  return [
    {
      id: 'mock-1',
      summary: 'Morning Standup',
      start: { dateTime: today(9, 0).toISOString() },
      end:   { dateTime: today(9, 30).toISOString() },
    },
    {
      id: 'mock-2',
      summary: 'Product Review',
      start: { dateTime: today(10, 30).toISOString() },
      end:   { dateTime: today(12, 0).toISOString() },
    },
    {
      id: 'mock-3',
      summary: 'Lunch — Strategy Session',
      start: { dateTime: today(12, 30).toISOString() },
      end:   { dateTime: today(13, 30).toISOString() },
    },
    {
      id: 'mock-4',
      summary: 'Design Critique',
      start: { dateTime: today(14, 0).toISOString() },
      end:   { dateTime: today(15, 0).toISOString() },
    },
    {
      id: 'mock-5',
      summary: 'Investor Call',
      start: { dateTime: today(16, 0).toISOString() },
      end:   { dateTime: today(17, 0).toISOString() },
    },
  ]
}

export const MOCK_ROOMS = [
  { id: 'mock-room-a', summary: 'Boardroom A', description: 'Level 2 · 12 seats' },
  { id: 'mock-room-b', summary: 'Meeting Room B', description: 'Level 1 · 6 seats' },
  { id: 'mock-room-c', summary: 'Focus Pod', description: 'Level 3 · 2 seats' },
]
