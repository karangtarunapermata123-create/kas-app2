import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Absensi Realtime ──────────────────────────────────────────────────────────
// Singleton — langsung subscribe saat module di-load, tidak butuh auth callback.
// Supabase realtime bisa subscribe sebelum ada session; data tetap aman via RLS.

let _absensiChannelStarted = false
let _absensiChannel: RealtimeChannel | null = null
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null
const RECONNECT_DELAY_MS = 3000

let _routineChannelStarted = false
let _routineChannel: RealtimeChannel | null = null

export function startRoutineRealtime() {
  if (_routineChannelStarted) return
  _routineChannelStarted = true

  console.log('[Realtime] starting routine-global channel...')

  _routineChannel = supabase
    .channel('routine-global')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_checklists' }, (payload) => {
      console.log('[Realtime] routine_checklists changed:', payload.eventType)
      const bookId = (payload.new as any)?.book_id ?? (payload.old as any)?.book_id
      if (bookId) window.dispatchEvent(new CustomEvent('kas:routine:changed', { detail: { bookId } }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_members' }, (payload) => {
      console.log('[Realtime] routine_members changed:', payload.eventType)
      const bookId = (payload.new as any)?.book_id ?? (payload.old as any)?.book_id
      if (bookId) window.dispatchEvent(new CustomEvent('kas:routine:changed', { detail: { bookId } }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_categories' }, (payload) => {
      console.log('[Realtime] routine_categories changed:', payload.eventType)
      const bookId = (payload.new as any)?.book_id ?? (payload.old as any)?.book_id
      if (bookId) window.dispatchEvent(new CustomEvent('kas:routine:changed', { detail: { bookId } }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_sessions' }, (payload) => {
      console.log('[Realtime] routine_sessions changed:', payload.eventType)
      const bookId = (payload.new as any)?.book_id ?? (payload.old as any)?.book_id
      if (bookId) window.dispatchEvent(new CustomEvent('kas:routine:changed', { detail: { bookId } }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_frequency' }, (payload) => {
      console.log('[Realtime] routine_frequency changed:', payload.eventType)
      const bookId = (payload.new as any)?.book_id ?? (payload.old as any)?.book_id
      if (bookId) window.dispatchEvent(new CustomEvent('kas:routine:changed', { detail: { bookId } }))
    })

  _routineChannel.subscribe((status, err) => {
    console.log('[Realtime] routine-global status:', status, err ?? '')
  })
}

export function startAbsensiRealtime() {
  if (_absensiChannelStarted) {
    // If channel exists and is not in error state, skip
    if (_absensiChannel && _absensiChannel.state !== 'closed' && _absensiChannel.state !== 'errored') {
      return
    }
    // If channel is errored/closed, reset flag so we can restart
    _absensiChannelStarted = false
  }
  if (_absensiChannelStarted) return
  _absensiChannelStarted = true

  console.log('[Realtime] starting absensi-global channel...')

  _absensiChannel = supabase
    .channel('absensi-global')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, (payload) => {
      console.log('[Realtime] attendance_records changed:', payload.eventType)
      window.dispatchEvent(new CustomEvent('absensi:attendance_changed'))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_sessions' }, (payload) => {
      console.log('[Realtime] activity_sessions changed:', payload.eventType)
      const aid = (payload.new as any)?.activity_id ?? (payload.old as any)?.activity_id
      window.dispatchEvent(new CustomEvent('absensi:sessions_changed', { detail: { activityId: aid } }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload) => {
      console.log('[Realtime] activities changed:', payload.eventType)
      window.dispatchEvent(new CustomEvent('absensi:activities_changed'))
    })

  _absensiChannel.subscribe((status, err) => {
    console.log('[Realtime] absensi-global status:', status, err ?? '')
    
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] Successfully subscribed to absensi changes')
      if (_reconnectTimer) {
        clearTimeout(_reconnectTimer)
        _reconnectTimer = null
      }
    }
    
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.warn('[Realtime] Connection issue, will retry in', RECONNECT_DELAY_MS, 'ms')
      _reconnectTimer = setTimeout(() => {
        console.log('[Realtime] Attempting reconnection...')
        _absensiChannelStarted = false
        startAbsensiRealtime()
      }, RECONNECT_DELAY_MS)
    }
  })
}

// Auto-start saat module di-load
startAbsensiRealtime()
startRoutineRealtime()

/**
 * Resize dan compress gambar sebelum upload
 * @param file File gambar yang akan diresize
 * @param maxWidth Lebar maksimal (default: 1200px)
 * @param maxHeight Tinggi maksimal (default: 1200px)
 * @param quality Kualitas kompresi 0-1 (default: 0.8)
 * @returns File yang sudah diresize
 */
async function resizeImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'))
              return
            }
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(resizedFile)
          },
          file.type,
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

/**
 * Upload file lampiran transaksi ke Supabase Storage
 * @param file File yang akan diupload
 * @param transactionId ID transaksi
 * @returns URL publik file yang diupload
 */
export async function uploadTransactionAttachment(
  file: File,
  transactionId: string
): Promise<string> {
  let fileToUpload = file

  // Resize gambar jika file adalah gambar
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await resizeImage(file, 1200, 1200, 0.8)
      console.log(`Image resized: ${file.size} bytes -> ${fileToUpload.size} bytes`)
    } catch (error) {
      console.error('Failed to resize image, uploading original:', error)
      // Jika gagal resize, upload file original
      fileToUpload = file
    }
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${transactionId}-${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('transaction-attachments')
    .upload(filePath, fileToUpload, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const { data } = supabase.storage
    .from('transaction-attachments')
    .getPublicUrl(filePath)

  return data.publicUrl
}

/**
 * Hapus file lampiran transaksi dari Supabase Storage
 * @param fileUrl URL file yang akan dihapus
 */
export async function deleteTransactionAttachment(fileUrl: string): Promise<void> {
  try {
    // Extract file path from URL
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split('/transaction-attachments/')
    if (pathParts.length < 2) return

    const filePath = pathParts[1]

    const { error } = await supabase.storage
      .from('transaction-attachments')
      .remove([filePath])

    if (error) {
      console.error('Error deleting file:', error)
    }
  } catch (error) {
    console.error('Error parsing file URL:', error)
  }
}

