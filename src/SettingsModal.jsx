import { useState, useEffect } from 'react'
import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

export default function SettingsModal({ onClose, onSave, gcal, onRefresh }) {
  useAutoClose(onClose)
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(localStorage.getItem('gcal_room_id') || '')
  const [selectedRoomName, setSelectedRoomName] = useState(localStorage.getItem('gcal_room_name') || '')
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [apiKey, setApiKey] = useState(localStorage.getItem('gcal_api_key_backend') || '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState(null) // null | 'checking' | 'valid' | 'invalid' | 'error'
  const [apiKeyError, setApiKeyError] = useState(null)
  const [roomsError, setRoomsError] = useState(null)

  const loadRooms = async () => {
    setLoadingRooms(true)
    setRoomsError(null)
    try {
      const items = await gcal.listRooms()
      setRooms(items)
    } catch (e) {
      console.error(e)
      setRoomsError(e.message || 'Failed to load rooms')
    }
    setLoadingRooms(false)
  }

  useEffect(() => {
    if (gcal.authed) loadRooms()
  }, [gcal.authed])

  const handleSelectRoom = (room) => {
    setSelectedRoom(room.id)
    setSelectedRoomName(room.summary)
  }

  const handleSaveRoom = () => {
    localStorage.setItem('gcal_room_id', selectedRoom)
    localStorage.setItem('gcal_room_name', selectedRoomName)
    onSave(selectedRoom, selectedRoomName)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
        <div className="flex justify-between items-center">
          <h2 className="text-white text-xl font-semibold">Settings</h2>
          <div className="flex items-center gap-3">
            {onRefresh && (
              <button onClick={() => { onRefresh(); onClose() }} className="text-slate-400 hover:text-white text-sm transition-colors">
                Refresh
              </button>
            )}
            <TimerCloseButton onClick={onClose} />
          </div>
        </div>

        {/* Auth status */}
        <div className="space-y-3">
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Google Account</h3>
          {gcal.isBackend ? (
            <div className="flex items-center justify-between">
              <span className="text-green-400 text-sm">✓ Service account (always connected)</span>
              <button
                onClick={() => {
                  localStorage.setItem('gcal_force_sso', '1')
                  window.location.reload()
                }}
                className="text-slate-400 hover:text-white text-sm underline"
              >
                Switch to Google SSO
              </button>
            </div>
          ) : gcal.authed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-sm">✓ Signed in</span>
                <button onClick={gcal.signOut} className="text-slate-400 hover:text-white text-sm underline">Sign out</button>
              </div>
              {localStorage.getItem('gcal_force_sso') === '1' && (
                <button
                  onClick={() => {
                    localStorage.removeItem('gcal_force_sso')
                    window.location.reload()
                  }}
                  className="text-slate-400 hover:text-white text-sm underline"
                >
                  Switch to Service Account
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">Not signed in. Sign in from the main screen.</p>
              {localStorage.getItem('gcal_force_sso') === '1' && (
                <button
                  onClick={() => {
                    localStorage.removeItem('gcal_force_sso')
                    window.location.reload()
                  }}
                  className="text-slate-400 hover:text-white text-sm underline flex-shrink-0 ml-3"
                >
                  Switch to Service Account
                </button>
              )}
            </div>
          )}
        </div>

        {/* API Key (service account mode) */}
        {gcal.isBackend && (
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">API Key</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setApiKeyStatus(null) }}
                  placeholder="Enter API key"
                  className={`w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 pr-16 border focus:outline-none placeholder-slate-500 ${
                    apiKeyStatus === 'valid' ? 'border-green-500' :
                    apiKeyStatus === 'invalid' ? 'border-red-500' :
                    apiKeyStatus === 'error' ? 'border-amber-500' :
                    'border-slate-600 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                disabled={apiKeyStatus === 'checking'}
                onClick={async () => {
                  if (apiKey) {
                    localStorage.setItem('gcal_api_key_backend', apiKey)
                  } else {
                    localStorage.removeItem('gcal_api_key_backend')
                  }
                  setApiKeyStatus('checking')
                  setApiKeyError(null)
                  try {
                    const res = await fetch('/api/rooms', {
                      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
                    })
                    if (res.ok) {
                      setApiKeyStatus('valid')
                      onRefresh?.()
                    } else if (res.status === 401) {
                      setApiKeyStatus('invalid')
                    } else {
                      // Key accepted (not 401) but server had another error
                      const data = await res.json().catch(() => ({}))
                      setApiKeyStatus('error')
                      setApiKeyError(data.error || `Server error (${res.status})`)
                      // Key itself is fine — keep it saved
                    }
                  } catch (e) {
                    setApiKeyStatus('error')
                    setApiKeyError(e.message || 'Could not reach server')
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {apiKeyStatus === 'checking' ? '...' : 'Save'}
              </button>
            </div>
            {apiKeyStatus === 'valid' && (
              <p className="text-green-400 text-xs">API key saved and verified.</p>
            )}
            {apiKeyStatus === 'invalid' && (
              <p className="text-red-400 text-xs">Invalid API key. Check the key and try again.</p>
            )}
            {apiKeyStatus === 'error' && (
              <div className="space-y-1">
                <p className="text-amber-400 text-xs">API key saved, but the server returned an error:</p>
                <p className="text-red-400 text-xs font-mono bg-slate-900/50 rounded px-2 py-1">{apiKeyError}</p>
              </div>
            )}
            {!apiKeyStatus && (
              <p className="text-slate-500 text-xs">Required to authenticate with the backend. Set once per kiosk.</p>
            )}
          </div>
        )}

        {/* Room selection */}
        {gcal.authed && (
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Room / Calendar</h3>
            {roomsError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm font-medium">Failed to load rooms</p>
                <p className="text-red-400/80 text-xs font-mono mt-1">{roomsError}</p>
              </div>
            )}
            {loadingRooms ? (
              <p className="text-slate-400 text-sm">Loading calendars...</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedRoom === room.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <div className="font-medium">{room.summary}</div>
                    {room.description && <div className="text-xs opacity-70 mt-0.5">{room.description}</div>}
                  </button>
                ))}
                {rooms.length === 0 && (
                  <p className="text-slate-400 text-sm">No calendars found. Make sure the room resource is shared with your account.</p>
                )}
              </div>
            )}
            {selectedRoom && (
              <button
                onClick={handleSaveRoom}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Use: {selectedRoomName}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
