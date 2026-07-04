import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Button from './Button'

type QRScannerProps = {
  open: boolean
  onClose: () => void
  onScan: (data: string) => void
}

const CONTAINER_ID = 'qr-reader-inline'

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isScanningRef = useRef(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!open) return

    mountedRef.current = true
    setError(null)

    // Langsung start — tidak perlu tunggu animasi modal
    const timer = setTimeout(() => {
      if (mountedRef.current) startScanner()
    }, 80) // minimal delay untuk pastikan DOM render

    return () => {
      clearTimeout(timer)
      mountedRef.current = false
      stopScanner()
    }
  }, [open])

  async function startScanner() {
    if (isScanningRef.current) return

    const el = document.getElementById(CONTAINER_ID)
    if (!el) return

    try {
      setError(null)
      const scanner = new Html5Qrcode(CONTAINER_ID)
      scannerRef.current = scanner
      isScanningRef.current = true

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => {} // abaikan frame errors
      )
    } catch (err: any) {
      isScanningRef.current = false
      // Fallback ke kamera depan
      try {
        const scanner = scannerRef.current ?? new Html5Qrcode(CONTAINER_ID)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            onScan(decodedText)
            stopScanner()
            onClose()
          },
          () => {}
        )
        isScanningRef.current = true
      } catch {
        const msg = err?.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Berikan izin kamera di pengaturan browser.'
          : err?.name === 'NotFoundError'
          ? 'Kamera tidak ditemukan di perangkat ini.'
          : 'Tidak dapat mengakses kamera.'
        setError(msg)
        scannerRef.current = null
      }
    }
  }

  async function stopScanner() {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
      isScanningRef.current = false
    }
  }

  function handleClose() {
    stopScanner()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <span className="text-white text-sm font-medium">Scan QR Code Absensi</span>
        <button
          type="button"
          onClick={handleClose}
          className="text-white/70 hover:text-white p-1"
          aria-label="Tutup scanner"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Kamera */}
      <div className="flex-1 relative overflow-hidden">
        {/* Kamera — Html5Qrcode render kotak scan-nya sendiri */}
        <div id={CONTAINER_ID} className="w-full h-full" />
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-black/80 flex flex-col items-center gap-3">
        {error ? (
          <div className="w-full rounded-lg bg-rose-900/60 border border-rose-700 px-4 py-3 text-sm text-rose-300 text-center">
            {error}
          </div>
        ) : (
          <p className="text-xs text-white/50 text-center">
            Arahkan kamera ke QR code yang ditampilkan admin
          </p>
        )}
        <Button variant="secondary" onClick={handleClose}>
          Tutup
        </Button>
      </div>
    </div>
  )
}
