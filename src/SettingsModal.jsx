import { useState, useEffect } from 'react'

export default function SettingsModal({ onClose, onSave, gcal, onRefresh }) {
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(localStorage.getItem('gcal_room_id') || '')
  const [selectedRoomName, setSelectedRoomName] = useState(localStorage.getItem('gcal_room_name') || '')
  const [loadingRooms, setLoadingRooms] = useState(false)

  const loadRooms = async () => {
    setLoadingRooms(true)
    try {
      const items = await gcal.listRooms()
      setRooms(items)
    } catch (e) {
      console.error(e)
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
            <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Auth status */}
        <div className="space-y-3">
          <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Google Account</h3>
          {gcal.authed ? (
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-sm">✓ Signed in</span>
              <button onClick={gcal.signOut} className="text-slate-400 hover:text-white text-sm underline">Sign out</button>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Not signed in. Sign in from the main screen.</p>
          )}
        </div>

        {/* Room selection */}
        {gcal.authed && (
          <div className="space-y-3">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wide">Room / Calendar</h3>
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
