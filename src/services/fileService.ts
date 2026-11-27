import type { Attachment } from '../types'
import { newId } from './dataSource'

/**
 * จัดการไฟล์แนบ (Optional ทั้งหมด)
 * ตอนนี้: ย่อรูปให้เล็กที่สุด + สร้างรูปเล็ก (thumbnail) แล้วแปลงเป็น Data URL
 * ภายหลัง: ขอ SAS URL จาก API → PUT ไฟล์ขึ้น Azure Blob Storage (รูปเต็ม + รูปเล็ก) → เก็บ blob URL ใน `url` / `thumbUrl`
 */

const MAX_PDF_BYTES = 2 * 1024 * 1024

/**
 * การย่อรูป — เล็กที่สุดเท่าที่ยังอ่านเลขไมล์/ทะเบียน/รอยบนตัวรถได้ชัด
 * - ด้านยาวสูงสุด 1024px (เริ่มต้น) ย่อลงได้ถึง 720px ถ้ายังใหญ่เกินเป้า
 * - ลองทั้ง WebP และ JPEG ทุกขั้นคุณภาพ แล้วเลือกไฟล์ที่เล็กกว่า (เบราว์เซอร์ที่ไม่รองรับ WebP ใช้ JPEG)
 * - ลดคุณภาพทีละขั้นจนขนาด ≤ เป้า ไม่ต่ำกว่าคุณภาพขั้นต่ำ
 * - การวาดใหม่ลง canvas ตัดข้อมูล EXIF (รวมพิกัด GPS ในรูป) ทิ้งด้วย
 */
const FULL = { maxDim: 1024, minDim: 720, target: 120 * 1024, qualities: [0.72, 0.62, 0.52, 0.45] }
/** รูปเล็กสำหรับหน้ารายการ/ช่องตัวอย่าง (โหลดรูปเต็มเฉพาะตอนกดเปิดดู) */
const THUMB = { maxDim: 400, minDim: 400, target: 24 * 1024, qualities: [0.6, 0.5] }

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

/** เข้ารหัสรูปให้เล็กที่สุดตามเงื่อนไข (ขนาดภาพ/เป้าขนาดไฟล์/ขั้นคุณภาพ) */
async function encodeSmallest(bitmap: ImageBitmap, opts: typeof FULL): Promise<Blob | null> {
  const types = await outputTypes()
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  let best: Blob | null = null
  for (let dim = opts.maxDim; ; dim = Math.max(opts.minDim, Math.round(dim * 0.85))) {
    const scale = Math.min(1, dim / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    ctx.fillStyle = '#fff' // พื้นหลังขาวแทนส่วนโปร่งใส (JPEG ไม่รองรับความโปร่งใส)
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const q of opts.qualities) {
      let smallest: Blob | null = null
      for (const type of types) {
        const blob = await toBlob(canvas, type, q)
        if (blob && (!smallest || blob.size < smallest.size)) smallest = blob
      }
      if (!smallest) continue
      if (!best || smallest.size < best.size) best = smallest
      if (smallest.size <= opts.target) return smallest
    }
    // รูปเล็กกว่าขนาดที่กำหนดอยู่แล้ว หรือย่อถึงขั้นต่ำแล้ว → หยุด
    if (scale === 1 || dim === opts.minDim) break
  }
  return best
}

async function compressImage(file: File): Promise<{ full: Blob; thumb: Blob | null }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('เปิดไฟล์รูปนี้ไม่ได้ กรุณาถ่ายใหม่ หรือเลือกไฟล์ JPG/PNG')
  }
  try {
    const full = (await encodeSmallest(bitmap, FULL)) ?? file
    // รูปที่เล็กอยู่แล้ว (≤ ขนาดรูปเล็ก) ไม่ต้องมีรูปเล็กแยก
    const thumb = Math.max(bitmap.width, bitmap.height) > THUMB.maxDim ? await encodeSmallest(bitmap, THUMB) : null
    return { full, thumb: thumb && thumb.size < full.size ? thumb : null }
  } finally {
    bitmap.close()
  }
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
    const { full, thumb } = isImage ? await compressImage(file) : { full: file as Blob, thumb: null }
    const url = await readAsDataURL(full)
    return {
      id: newId('file'),
      name: isImage ? renameExt(file.name, full.type) : file.name,
      type: full.type || file.type,
      size: full.size,
      url,
      ...(thumb ? { thumbUrl: await readAsDataURL(thumb) } : {}),
      uploadedAt: new Date().toISOString(),
    }
  },

  isImage(a: Attachment): boolean {
    return a.type.startsWith('image/')
  },

  /** URL สำหรับแสดงขนาดเล็ก (รายการ/ช่องตัวอย่าง) — ไฟล์เก่าที่ไม่มีรูปเล็กใช้รูปเต็มแทน */
  thumbOf(a: Pick<Attachment, 'url' | 'thumbUrl'>): string {
    return a.thumbUrl || a.url
  },
}
