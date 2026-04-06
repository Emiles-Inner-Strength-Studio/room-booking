import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { useAutoClose } from './useAutoClose'
import TimerCloseButton from './TimerCloseButton'

export default function QrModal({ url, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  useAutoClose(onClose)

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl)
  }, [url])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-slate-800 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-8 pt-8 pb-4 flex justify-between items-center">
          <h2 className="text-white text-2xl font-bold">Email Participants</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-3xl leading-none w-10 h-10 flex items-center justify-center">×</button>
        </div>
        <div className="px-8 pb-6 flex flex-col items-center gap-4">
          {dataUrl ? (
            <img src={dataUrl} alt="QR code" className="rounded-2xl" width={280} height={280} />
          ) : (
            <div className="w-[280px] h-[280px] bg-slate-700/50 rounded-2xl animate-pulse" />
          )}
          <p className="text-slate-400 text-base">Scan with your phone to send email</p>
        </div>
        <div className="px-8 pb-8">
          <TimerCloseButton onClick={onClose} />
        </div>
      </div>
    </div>
  )
}
