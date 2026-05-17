import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

