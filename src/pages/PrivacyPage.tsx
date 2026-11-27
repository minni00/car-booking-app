import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '../router'

/**
 * นโยบายความเป็นส่วนตัว (PDPA) — เขียนตามข้อมูลที่แอปเก็บจริง
 * ปรับชื่อองค์กร/ช่องทางติดต่อ/ระยะเวลาเก็บ ให้ตรงนโยบายองค์กร และให้ฝ่ายกฎหมาย/DPO ตรวจก่อนประกาศใช้
 */
const POLICY = {
  org: 'องค์กรผู้ใช้งานระบบ FleetGo MCS (นายจ้างของผู้ใช้งาน)',
  contact: 'ผู้ดูแลระบบ FleetGo MCS หรือเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) ขององค์กร',
  updated: '27 พฤศจิกายน 2569',
  version: '1.0',
}

const DATA: Array<[string, string]> = [
  ['ข้อมูลบัญชี', 'ชื่อ-นามสกุล อีเมลองค์กร แผนก เบอร์โทรศัพท์ สิทธิ์การใช้งาน (ผู้ใช้/แอดมิน) และรหัสบัญชี Microsoft ขององค์กร'],
  ['การจองและการใช้รถ', 'วันเวลาที่จอง วัตถุประสงค์ จำนวนผู้โดยสาร ผู้ขับขี่ ปลายทาง เวลาเริ่มใช้และคืนรถจริง เลขไมล์ จุดจอด จุดเก็บกุญแจ การเติมน้ำมันและสลิป การขอขยายเวลา'],
  ['รูปถ่าย', 'รูปหน้าปัดเลขไมล์ รูปรถ และรูปปัญหา/รอยบนตัวรถ — ระบบย่อรูปและลบข้อมูลแฝงในไฟล์ (รวมพิกัด GPS ในรูป) ก่อนบันทึก'],
  ['ตำแหน่ง', 'เฉพาะเมื่อผู้ใช้ปักหมุดหรือกด "ดึง GPS ตอนนี้" ตอนเริ่มใช้รถ/คืนรถ เท่านั้น ระบบไม่ติดตามตำแหน่งระหว่างขับขี่'],
  ['ใบสั่งจราจร', 'วันเวลา สถานที่ ข้อหา จำนวนเงิน หลักฐาน และผู้ขับขี่ที่ระบบจับคู่จากการจอง ณ เวลาที่เกิดเหตุ'],
  ['อุปกรณ์', 'ประเภทอุปกรณ์/ระบบปฏิบัติการ/เบราว์เซอร์ และเวลาใช้งานล่าสุด เพื่อให้ผู้ใช้สั่งออกจากระบบอุปกรณ์ที่ไม่ใช้แล้วได้'],
  ['อีเมลแจ้งเตือน', 'สำเนาอีเมลยืนยันการจองและการขยายเวลาที่ระบบส่งถึงผู้จอง/ผู้ขับขี่'],
]

const RETENTION: Array<[string, string]> = [
  ['การจอง การใช้รถ และรูปถ่าย', '2 ปี นับจากวันใช้รถ'],
  ['ใบสั่งจราจร', '2 ปี นับจากวันที่ชำระแล้ว'],
  ['ข้อมูลอุปกรณ์', '1 ปี นับจากใช้งานล่าสุด หรือเมื่อสั่งออกจากระบบ'],
  ['ข้อมูลบัญชี', 'ตลอดระยะเวลาเป็นพนักงาน และลบภายใน 90 วันหลังพ้นสภาพ (เว้นข้อมูลที่ต้องเก็บตามกฎหมาย)'],
]

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="text-[17px] font-semibold">
        <span className="num mr-2 text-muted">{n}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.75] text-ink/85">{children}</div>
    </section>
  )
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-[14px] font-medium text-ink">{k}</dt>
          <dd className="text-[14px] leading-[1.7] text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** หน้านโยบายความเป็นส่วนตัว — เปิดได้ทั้งก่อนและหลังเข้าสู่ระบบ (`standalone` = ยังไม่ล็อกอิน) */
export function PrivacyPage({ standalone }: { standalone?: boolean }) {
  return (
    <div className={standalone ? 'min-h-dvh bg-white px-4 pt-safe pb-safe sm:px-6' : ''}>
      <article className="mx-auto max-w-2xl py-6 md:py-10">
        <Link to={standalone ? '/' : '/profile'} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          {standalone ? 'กลับหน้าเข้าสู่ระบบ' : 'กลับหน้าโปรไฟล์'}
        </Link>
        <h1 className="text-[28px] leading-[1.25] font-semibold tracking-[-0.02em] md:text-[36px]">นโยบายความเป็นส่วนตัว</h1>
        <p className="mt-2 text-[14px] text-muted">
          ระบบจองรถองค์กร FleetGo MCS · ฉบับที่ <span className="num">{POLICY.version}</span> · ปรับปรุงล่าสุด {POLICY.updated}
        </p>
        <p className="mt-5 text-[15px] leading-[1.75] text-ink/85">
          นโยบายนี้อธิบายว่าระบบ FleetGo MCS เก็บข้อมูลส่วนบุคคลอะไร ใช้เพื่ออะไร เก็บนานเท่าไร และคุณมีสิทธิ์อะไรบ้าง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>

        <div className="mt-6">
          <Section n={1} title="ผู้ควบคุมข้อมูลส่วนบุคคล">
            <p>{POLICY.org} เป็นผู้ควบคุมข้อมูลส่วนบุคคลในระบบนี้</p>
          </Section>

          <Section n={2} title="ข้อมูลที่เก็บ">
            <Rows rows={DATA} />
          </Section>

          <Section n={3} title="วัตถุประสงค์ในการใช้ข้อมูล">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>จัดคิวและยืนยันการจองรถ แจ้งเตือนทางอีเมล และป้องกันการจองชนกัน</li>
              <li>บันทึกการใช้รถ เลขไมล์ ค่าน้ำมัน และสภาพรถก่อน-หลังใช้ เพื่อความรับผิดชอบต่อทรัพย์สินขององค์กร</li>
              <li>จับคู่ใบสั่งจราจรกับผู้ขับขี่ ณ เวลาที่เกิดเหตุ</li>
              <li>วางแผนซ่อมบำรุง ต่อ พ.ร.บ./ประกัน และวิเคราะห์การใช้รถเพื่อลดค่าใช้จ่าย</li>
              <li>รักษาความปลอดภัยของบัญชี เช่น ดูและสั่งออกจากระบบอุปกรณ์ที่ล็อกอินอยู่</li>
            </ul>
          </Section>

          <Section n={4} title="ฐานทางกฎหมาย">
            <p>
              การปฏิบัติตามสัญญาจ้างงาน (มาตรา 24(3)) และประโยชน์โดยชอบด้วยกฎหมายขององค์กรในการบริหารจัดการยานพาหนะและทรัพย์สิน (มาตรา 24(5)) รวมถึงการปฏิบัติตามกฎหมาย เช่น การดำเนินการเรื่องใบสั่งจราจร ระบบไม่ขอข้อมูลส่วนบุคคลที่มีความอ่อนไหว
            </p>
          </Section>

          <Section n={5} title="ผู้ที่เข้าถึงข้อมูล">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="font-medium text-ink">ตัวคุณ</span> — เห็นการจอง ประวัติ ใบสั่ง และอีเมลของตัวเอง</li>
              <li><span className="font-medium text-ink">ผู้ดูแลระบบ (แอดมิน)</span> — เห็นข้อมูลการใช้รถทั้งหมดเพื่อบริหารจัดการและส่งออกรายงาน</li>
              <li><span className="font-medium text-ink">ผู้ให้บริการคลาวด์</span> — Microsoft (Azure / Microsoft 365) ในฐานะผู้ประมวลผลข้อมูลตามคำสั่งขององค์กร</li>
              <li><span className="font-medium text-ink">หน่วยงานรัฐ</span> — เฉพาะเมื่อกฎหมายกำหนด เช่น เจ้าหน้าที่ตำรวจกรณีใบสั่ง</li>
            </ul>
            <p>องค์กรไม่ขายหรือเปิดเผยข้อมูลของคุณเพื่อการตลาด</p>
          </Section>

          <Section n={6} title="ระยะเวลาเก็บข้อมูล">
            <Rows rows={RETENTION} />
            <p className="text-[14px] text-muted">เมื่อครบกำหนด ระบบจะลบหรือทำให้ข้อมูลไม่สามารถระบุตัวบุคคลได้</p>
          </Section>

          <Section n={7} title="สิทธิ์ของคุณ">
            <p>คุณมีสิทธิ์ขอเข้าถึงและขอสำเนาข้อมูล ขอแก้ไขให้ถูกต้อง ขอลบหรือระงับการใช้ คัดค้านการประมวลผล ขอโอนย้ายข้อมูล และร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.) ทั้งนี้ อาจมีข้อจำกัดเมื่อข้อมูลจำเป็นต่อการปฏิบัติตามกฎหมายหรือสัญญาจ้าง</p>
          </Section>

          <Section n={8} title="การรักษาความปลอดภัย">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>เข้าสู่ระบบด้วยบัญชี Microsoft ขององค์กร และรับส่งข้อมูลผ่าน HTTPS</li>
              <li>จำกัดสิทธิ์การเข้าถึงตามบทบาท (ผู้ใช้/แอดมิน)</li>
              <li>ย่อรูปและลบข้อมูลแฝงในไฟล์รูป (รวมพิกัด GPS) ก่อนบันทึก</li>
              <li>สั่งออกจากระบบอุปกรณ์ที่สูญหายหรือไม่ใช้แล้วได้จากหน้าโปรไฟล์</li>
            </ul>
          </Section>

          <Section n={9} title="ติดต่อ">
            <p>หากต้องการใช้สิทธิ์หรือมีคำถามเกี่ยวกับข้อมูลส่วนบุคคล ติดต่อ{POLICY.contact}</p>
          </Section>
        </div>
      </article>
    </div>
  )
}
