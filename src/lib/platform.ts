/** กำลังรันอยู่ในแอป Android/iOS ที่แพ็กด้วย Capacitor หรือไม่ */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** ลิงก์ดาวน์โหลดไฟล์ติดตั้งแอป Android */
export const APK_URL = '/downloads/FleetGo.apk'
