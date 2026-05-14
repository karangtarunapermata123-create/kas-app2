import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Modal from './Modal'
import Button from './Button'

type QRDisplayProps = {
  open: boolean
  onClose: () => void
  data: string
  title?: string
  description?: string
}

export default function QRDisplay({ open, onClose, data, title = 'QR Code Absensi', description }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).catch((err: Error) => {
        console.error('Error generating QR code:', err)
      })
    }
  }, [open, data])

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(data)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  async function handleDownload() {
    if (!canvasRef.current) return
    
    try {
      const url = canvasRef.current.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = 'qr-code-absensi.png'
      link.href = url
      link.click()
    } catch (err) {
      console.error('Error downloading QR code:', err)
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="grid gap-4">
        {description && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {description}
          </div>
        )}

        <div className="flex justify-center rounded-lg bg-white p-4">
          <canvas ref={canvasRef} className="max-w-full h-auto"></canvas>
        </div>

        <div className="text-xs text-center text-slate-500 dark:text-slate-400">
          Tampilkan QR code ini kepada anggota untuk melakukan absensi
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={handleCopyLink}>
            {copied ? '✓ Tersalin' : 'Salin Link'}
          </Button>
          <Button variant="secondary" onClick={handleDownload}>
            Download QR
          </Button>
        </div>

        <Button onClick={onClose}>
          Tutup
        </Button>
      </div>
    </Modal>
  )
}
