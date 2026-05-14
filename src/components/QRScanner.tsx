import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import Modal from './Modal'
import Button from './Button'

type QRScannerProps = {
  open: boolean
  onClose: () => void
  onScan: (data: string) => void
}

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isScanning = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !isScanning.current) {
      const timer = setTimeout(() => {
        startScanning()
      }, 300)
      return () => clearTimeout(timer)
    }
    
    return () => {
      stopScanning()
    }
  }, [open])

  async function startScanning() {
    if (isScanning.current) return
    
    try {
      setError(null)
      if (!containerRef.current) {
        throw new Error('Container not found')
      }
      const scannerId = 'qr-reader-' + Date.now()
      containerRef.current.id = scannerId
      const scanner = new Html5Qrcode(scannerId)
      scannerRef.current = scanner
      isScanning.current = true

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          onScan(decodedText)
          stopScanning()
          onClose()
        },
        () => {
          // Error callback - ignore individual frame errors
        }
      )
      
      setScanning(true)
    } catch (err) {
      console.error('Error starting scanner:', err)
      setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.')
      isScanning.current = false
    }
  }

  async function stopScanning() {
    if (scannerRef.current && isScanning.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
      isScanning.current = false
      setScanning(false)
    }
  }

  function handleClose() {
    stopScanning()
    onClose()
  }

  return (
    <Modal open={open} title="Scan QR Code Absensi" onClose={handleClose}>
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}
        
        <div className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <div ref={containerRef} className="w-full"></div>
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-sm text-slate-500 dark:text-slate-400">Memulai kamera...</div>
            </div>
          )}
        </div>

        <div className="text-xs text-center text-slate-500 dark:text-slate-400">
          Arahkan kamera ke QR code yang ditampilkan admin
        </div>

        <Button variant="secondary" onClick={handleClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  )
}
