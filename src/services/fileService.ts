import type { Attachment } from '../types'
import { newId } from './dataSource'

/**
 * จัดการไฟล์แนบ (Optional ทั้งหมด)
 * ตอนนี้: แปลงเป็น Data URL (ย่อรูปให้เล็กลงเพื่อประหยัดพื้นที่ localStorage)
 * ภายหลัง: ขอ SAS URL จาก API → PUT ไฟล์ขึ้น Azure Blob Storage → เก็บ blob URL ใน `url`
 */

const MAX_PDF_BYTES = 2 * 1024 * 1024
const MAX_IMAGE_DIM = 1024

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(blob)
  })
}

async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return readAsDataURL(file)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

export const fileService = {
  async upload(file: File): Promise<Attachment> {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) throw new Error('รองรับเฉพาะไฟล์รูปภาพหรือ PDF')
    if (isPdf && file.size > MAX_PDF_BYTES) throw new Error('ไฟล์ PDF ต้องไม่เกิน 2 MB ในโหมดทดสอบ')

    // TODO(Azure): แทนที่ส่วนนี้ด้วยการอัปโหลดขึ้น Blob Storage ผ่าน SAS URL
    const url = isImage ? await compressImage(file) : await readAsDataURL(file)
    return {
      id: newId('file'),
      name: file.name,
      type: isImage ? 'image/jpeg' : file.type,
      size: Math.round((url.length * 3) / 4),
      url,
      uploadedAt: new Date().toISOString(),
    }
  },

  isImage(a: Attachment): boolean {
    return a.type.startsWith('image/')
  },
}
