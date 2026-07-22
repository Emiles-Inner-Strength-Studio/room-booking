export function isPrivateEvent(event) {
  if (!event) return false
  const summary = event.summary?.trim().toLowerCase()
  return event.visibility === 'private' ||
    event.visibility === 'confidential' ||
    !summary ||
    summary === 'private event'
}

export function getEventDisplayTitle(event) {
  return isPrivateEvent(event) ? 'Private event' : event.summary
}
