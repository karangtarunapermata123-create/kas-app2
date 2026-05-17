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
  const [containerId, setContainerId] = useState('')

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isScanningRef = useRef(false)
  const mountedRef = useRef(false)

  // Step 1: ketika modal dibuka → generate containerId
  useEffect(() => {
    if (open) {
      mountedRef.current = true
      const newId = `qr-reader-${Date.now()}`
      setContainerId(newId)
      setScanning(false)
      setError(null)
    } else {
      mountedRef.current = false
      stopScanner()
    }

    return () => {
      mountedRef.current = false
      stopScanner()
    }
  }, [open])

  // Step 2: ketika containerId sudah di-render di DOM → mulai kamera
  useEffect(() => {
    if (!open || !containerId) return

    const timer = setTimeout(async () => {
      if (!mountedRef.current) return

      // Pastikan element benar-benar ada di DOM
      const el = document.getElementById(containerId)
      if (!el) {
        console.warn('[QRScanner] Container element not found in DOM, retrying...', containerId)
        return
      }

      await startScanner(containerId)
    }, 500) // kasih waktu cukup untuk render + transisi modal

    return () => clearTimeout(timer)
  }, [open, containerId])

  // Minta permission kamera sebelum start scanner
  async function requestCamera(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      // Stop semua track agar tidak conflict dengan Html5Qrcode
      stream.getTracks().forEach(track => track.stop())
      return true
    } catch (err: any) {
      console.error('[QRScanner] Camera permission denied:', err)
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('Izin kamera ditolak. Silakan berikan izin kamera di pengaturan browser.')
      } else if (err?.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan di perangkat ini.')
      } else {
        setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.')
      }
      return false
    }
  }

  async function startScanner(elementId: string) {
    if (isScanningRef.current) return
    if (!mountedRef.current) return

    try {
      setError(null)
      setScanning(false)

      // 1. Minta izin kamera dulu
      setError('Mengakses kamera...')
      const hasPermission = await requestCamera()
      if (!hasPermission || !mountedRef.current) return

      // 2. Pastikan element masih ada
      const el = document.getElementById(elementId)
      if (!el) {
        setError('Container kamera tidak tersedia.')
        return
      }

      // 3. Buat scanner
      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner
      isScanningRef.current = true

      // 4. Coba dengan kamera belakang (environment), fallback ke depan (user)
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => {
          // ignore individual frame errors
        }
      )

      setScanning(true)
      setError(null)
    } catch (err: any) {
      console.error('[QRScanner] Error starting scanner:', err)

      // Coba fallback ke kamera depan jika environment gagal
      if (scannerRef.current && !isScanningRef.current) {
        try {
          await scannerRef.current.start(
            { facingMode: 'user' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              onScan(decodedText)
              stopScanner()
              onClose()
            },
            () => {}
          )
          setScanning(true)
          setError(null)
          return
        } catch (fallbackErr) {
          console.error('[QRScanner] Fallback camera also failed:', fallbackErr)
        }
      }

      setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.')
      isScanningRef.current = false
      setScanning(false)
    }
  }

  async function stopScanner() {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch (err) {
        console.warn('[QRScanner] Error stopping scanner:', err)
      }
      scannerRef.current = null
      isScanningRef.current = false
      setScanning(false)
    }
  }

  function handleClose() {
    stopScanner()
    onClose()
  }

  // Pastikan reference isScanningRef sinkron dengan state
  // (untuk prevent race condition)

  return (
    <Modal open={open} title="Scan QR Code Absensi" onClose={handleClose}>
      <div className="grid gap-4">
        {error && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
          <div id={containerId} className="w-full min-h-[200px]"></div>
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