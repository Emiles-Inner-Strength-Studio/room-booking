import { useState, useEffect } from 'react'

export default function SettingsModal({ onClose, onSave, gcal }) {
  const [clientId, setClientId] = useState(localStorage.getItem('gcal_client_id') || '')
  const [apiKey, setApiKey] = useState(localStorage.getItem('gcal_api_key') || '')
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(localStorage.getItem('gcal_room_id') || '')
  const [selectedRoomName, setSelectedRoomName] = useState(localStorage.getItem('gcal_room_name') || '')
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [authing, setAuthing] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveCredentials = () => {
    localStorage.setItem('gcal_client_id', clientId.trim())
    localStorage.setItem('gcal_api_key', apiKey.trim())
    setSaved(true)
    setTimeout(() => window.location.reload(), 800)
  }

  const handleAuth = async () => {
    setAuthing(true)
    const ok = await gcal.signIn()
    setAuthing(false)
    if (ok) await loadRooms()
  }

  const loadRooms = async () => {
    setLoadingRooms(true)
    try {
      const items = await gcal.listRooms()
      // Filter to likely room resources (resourceType or name hints)
      setRooms(items)
    } catch (e) {
      console.error(e)
    }
    setLoadingRooms(false)
  }

  useEffect(() => {
    if (gcal.authed && rooms.length === 0) loadRooms()
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
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Credentials */}
        <div className="space-y-3">
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Google API Credentials</h3>
          <div>
            <label className="text-slate-300 text-sm mb-1 block">Client ID</label>
            <input
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
            />
          </div>
          <div>
            <label className="text-slate-300 text-sm mb-1 block">API Key</label>
            <input
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIza..."
            />
          </div>
          <button
            onClick={handleSaveCredentials}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {saved ? '✓ Saved — reloading...' : 'Save & Reload'}
          </button>
        </div>

        {/* Auth */}
        {gcal.ready && (
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Google Account</h3>
            {gcal.authed ? (
              <div className="flex items-center gap-3">
                <span className="text-green-400 text-sm">✓ Signed in</span>
                <button onClick={gcal.signOut} className="text-slate-400 hover:text-white text-sm underline">Sign out</button>
              </div>
            ) : (
              <button
                onClick={handleAuth}
                disabled={authing}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {authing ? 'Signing in...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        )}

        {/* Room selection */}
        {gcal.authed && (
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Room / Calendar</h3>
            {loadingRooms ? (
              <p className="text-slate-400 text-sm">Loading calendars...</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
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
