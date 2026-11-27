import type { Attachment } from '../types'
import { newId } from './dataSource'

/**
 * จัดการไฟล์แนบ (Optional ทั้งหมด)
 * ตอนนี้: ย่อรูปให้เล็กที่สุด (ดู compressImage) แล้วแปลงเป็น Data URL
 * ภายหลัง: ขอ SAS URL จาก API → PUT ไฟล์ขึ้น Azure Blob Storage → เก็บ blob URL ใน `url`
 */

const MAX_PDF_BYTES = 2 * 1024 * 1024

/**
 * การย่อรูป — เล็กที่สุดเท่าที่ยังอ่านเลขไมล์/ทะเบียน/รอยบนตัวรถได้ชัด
 * - ด้านยาวสูงสุด 1024px (เริ่มต้น) ย่อลงได้ถึง 720px ถ้ายังใหญ่เกินเป้า
 * - ใช้ WebP ถ้าเบราว์เซอร์รองรับ (เล็กกว่า JPEG ~25–35%) ไม่รองรับ (เช่น Safari รุ่นเก่า) ใช้ JPEG
 * - ลดคุณภาพทีละขั้นจนขนาด ≤ เป้า ไม่ต่ำกว่าคุณภาพขั้นต่ำ
 * - การวาดใหม่ลง canvas ตัดข้อมูล EXIF (รวมพิกัด GPS ในรูป) ทิ้งด้วย
 */
const IMAGE_MAX_DIM = 1024
const IMAGE_MIN_DIM = 720
const IMAGE_TARGET_BYTES = 120 * 1024
const QUALITY_STEPS = [0.72, 0.62, 0.52, 0.45]

function readAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
    reader.readAsDataURL(blob)
  })
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

let webpSupported: boolean | undefined
/** รูปแบบที่ลองเข้ารหัส — WebP มักเล็กกว่า แต่บางรูป JPEG เล็กกว่า จึงลองทั้งคู่แล้วเลือกไฟล์ที่เล็กสุด */
async function outputTypes(): Promise<string[]> {
  if (webpSupported === undefined) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webpSupported = (await toBlob(c, 'image/webp', 0.5))?.type === 'image/webp'
  }
  return webpSupported ? ['image/webp', 'image/jpeg'] : ['image/jpeg']
}

async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('เปิดไฟล์รูปนี้ไม่ได้ กรุณาถ่ายใหม่ หรือเลือกไฟล์ JPG/PNG')
  }
  const types = await outputTypes()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  let best: Blob | null = null
  try {
    for (let dim = IMAGE_MAX_DIM; dim >= IMAGE_MIN_DIM; dim = Math.max(IMAGE_MIN_DIM, Math.round(dim * 0.85))) {
      const scale = Math.min(1, dim / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      ctx.fillStyle = '#fff' // พื้นหลังขาวแทนส่วนโปร่งใส (JPEG ไม่รองรับความโปร่งใส)
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const q of QUALITY_STEPS) {
        let smallest: Blob | null = null
        for (const type of types) {
          const blob = await toBlob(canvas, type, q)
          if (blob && (!smallest || blob.size < smallest.size)) smallest = blob
        }
        if (!smallest) continue
        if (!best || smallest.size < best.size) best = smallest
        if (smallest.size <= IMAGE_TARGET_BYTES) return smallest
      }
      // รูปเล็กกว่าขนาดขั้นต่ำอยู่แล้ว หรือย่อถึงขั้นต่ำแล้ว → หยุด
      if (scale === 1 || dim === IMAGE_MIN_DIM) break
    }
  } finally {
    bitmap.close()
  }
  return best ?? file
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }
const renameExt = (name: string, type: string) => (EXT[type] ? `${name.replace(/\.[^.]+$/, '') || 'photo'}.${EXT[type]}` : name)

export const fileService = {
  async upload(file: File): Promise<Attachment> {
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    if (!isImage && !isPdf) throw new Error('รองรับเฉพาะไฟล์รูปภาพหรือ PDF')
    if (isPdf && file.size > MAX_PDF_BYTES) throw new Error('ไฟล์ PDF ต้องไม่เกิน 2 MB ในโหมดทดสอบ')

    // TODO(Azure): แทนที่ส่วนนี้ด้วยการอัปโหลดขึ้น Blob Storage ผ่าน SAS URL
    // รูปทุกไฟล์ถูกย่อก่อนเก็บ/อัปโหลดเสมอ (PDF เก็บตามเดิม จำกัดขนาด 2 MB)
    const blob: Blob = isImage ? await compressImage(file) : file
    const url = await readAsDataURL(blob)
    return {
      id: newId('file'),
      name: isImage ? renameExt(file.name, blob.type) : file.name,
      type: blob.type || file.type,
      size: blob.size,
      url,
      uploadedAt: new Date().toISOString(),
    }
  },

  isImage(a: Attachment): boolean {
    return a.type.startsWith('image/')
  },
}
