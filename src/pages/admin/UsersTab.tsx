import { FileSpreadsheet, Pencil, Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { errorMessage, useToast } from '../../components/Toast'
import { Badge, Button, ErrorText, Field, Input, Loading, Modal, Segmented, Select } from '../../components/ui'
import { useCurrentUser } from '../../context/AuthContext'
import { fmtDateTime, toDateKey } from '../../lib/date'
import { downloadCSV } from '../../lib/download'
import { initials } from '../../lib/format'
import { useQuery } from '../../lib/useQuery'
import { userService, type UserInput } from '../../services/userService'
import type { Role, User } from '../../types'
import { DeleteButton, ExportPreviewModal, MobileCard, MobileMeta, Table, Td, Toolbar } from './shared'

export function UsersTab() {
  const me = useCurrentUser()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const { data, loading } = useQuery(() => userService.list())

  if (loading || !data) return <Loading />

  const term = q.trim().toLowerCase()
  const users = data.filter((u) => !term || `${u.name} ${u.email} ${u.department}`.toLowerCase().includes(term))
  const exportFilename = `fleetgo-users-${toDateKey()}.csv`
  const exportHeaders = ['รหัสผู้ใช้', 'ชื่อ-นามสกุล', 'อีเมล', 'แผนก', 'โทรศัพท์', 'สิทธิ์', 'Entra ID', 'สร้างบัญชี', 'ล็อกอินล่าสุด']
  const exportRows = users.map((u) => [
    u.id,
    u.name,
    u.email,
    u.department,
    u.phone,
    u.role === 'admin' ? 'Fleet Admin' : 'พนักงาน',
    u.entraOid ?? '',
    fmtDateTime(u.createdAt),
    u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '',
  ])
  const confirmExport = () => downloadCSV(exportFilename, exportHeaders, exportRows)

  const setRole = async (u: User, role: Role) => {
    if (u.role === role) return
    try {
      await userService.setRole(u.id, role)
      toast(`${u.name} → ${role === 'admin' ? 'Fleet Admin' : 'พนักงาน'}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  return (
    <div>
      <Toolbar>
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ อีเมล แผนก" className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} onClick={() => setExportOpen(true)} disabled={!users.length}>
            Export Excel
          </Button>
          <Button icon={UserPlus} onClick={() => setEditing('new')}>
            เพิ่มรายชื่อ / แอดมิน
          </Button>
        </div>
      </Toolbar>
      <p className="mb-3 text-sm text-muted">
        พนักงานทั้งหมด {data.length} คน · Fleet Admin {data.filter((u) => u.role === 'admin').length} คน · พนักงานใหม่ที่ล็อกอิน Entra ครั้งแรกจะถูกเพิ่มอัตโนมัติด้วยสิทธิ์พนักงาน
      </p>

      <Table
        head={['ชื่อ', 'อีเมล', 'แผนก', 'โทรศัพท์', 'สิทธิ์ (กดสลับได้ทันที)', 'ล็อกอินล่าสุด', '']}
        empty={!users.length}
        mobile={users.map((u) => (
          <MobileCard key={u.id}>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{initials(u.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                  {u.name}
                  {u.id === me.id && <Badge>คุณ</Badge>}
                  {u.entraOid && <Badge tone="blue">Entra</Badge>}
                </p>
                <p className="truncate text-sm text-muted">{u.email}</p>
              </div>
            </div>
            <MobileMeta
              items={[
                ['แผนก', u.department],
                ['โทรศัพท์', u.phone ? <a href={`tel:${u.phone}`} className="text-accent">{u.phone}</a> : '—'],
                ['ล็อกอินล่าสุด', u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'ยังไม่เคย'],
              ]}
            />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
              <Segmented
                size="sm"
                value={u.role}
                onChange={(r) => void setRole(u, r)}
                options={[
                  { value: 'admin', label: 'Fleet Admin' },
                  { value: 'user', label: 'พนักงาน' },
                ]}
              />
              <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(u)}>แก้ไข</Button>{u.id !== me.id && <DeleteButton itemLabel={`${u.name} · ${u.email}`} title="ลบรายชื่อนี้?" detail="ผู้ใช้จะถูกลบออกจากระบบและออกจากระบบทุกอุปกรณ์ ประวัติการใช้รถเดิมยังเก็บไว้ ไม่สามารถกู้คืนได้" successMessage="ลบรายชื่อแล้ว" onConfirm={() => userService.remove(u.id, me.id)} />}</div>
            </div>
          </MobileCard>
        ))}
      >
        {users.map((u) => (
          <tr key={u.id}>
            <Td>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{initials(u.name)}</span>
                <span className="font-medium whitespace-nowrap">{u.name}</span>
                {u.id === me.id && <Badge>คุณ</Badge>}
                {u.entraOid && <Badge tone="blue">Entra</Badge>}
              </div>
            </Td>
            <Td className="text-muted">{u.email}</Td>
            <Td className="whitespace-nowrap">{u.department}</Td>
            <Td className="whitespace-nowrap">{u.phone || '—'}</Td>
            <Td>
              <Segmented
                size="sm"
                value={u.role}
                onChange={(r) => void setRole(u, r)}
                options={[
                  { value: 'admin', label: 'Fleet Admin' },
                  { value: 'user', label: 'พนักงาน' },
                ]}
              />
            </Td>
            <Td className="whitespace-nowrap text-muted">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : 'ยังไม่เคย'}</Td>
            <Td>
              <div className="flex items-center gap-1"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(u)}>แก้ไข</Button>{u.id !== me.id && <DeleteButton itemLabel={`${u.name} · ${u.email}`} title="ลบรายชื่อนี้?" detail="ผู้ใช้จะถูกลบออกจากระบบและออกจากระบบทุกอุปกรณ์ ประวัติการใช้รถเดิมยังเก็บไว้ ไม่สามารถกู้คืนได้" successMessage="ลบรายชื่อแล้ว" onConfirm={() => userService.remove(u.id, me.id)} />}</div>
            </Td>
          </tr>
        ))}
      </Table>

      <ExportPreviewModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filename={exportFilename}
        headers={exportHeaders}
        rows={exportRows}
        onConfirm={confirmExport}
      />
      {editing && <UserFormModal key={editing === 'new' ? 'new' : editing.id} user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function UserFormModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<UserInput>(
    user ? { name: user.name, email: user.email, department: user.department, phone: user.phone, role: user.role } : { name: '', email: '', department: '', phone: '', role: 'user' },
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof UserInput>(k: K, v: UserInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      if (user) await userService.update(user.id, form)
      else await userService.create(form)
      toast(user ? 'บันทึกข้อมูลแล้ว' : 'เพิ่มรายชื่อแล้ว')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? 'แก้ไขรายชื่อ' : 'เพิ่มรายชื่อ / แอดมิน'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={() => void save()} loading={busy}>บันทึก</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="ชื่อ-นามสกุล"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="อีเมลองค์กร" hint="ใช้จับคู่กับบัญชี Microsoft Entra ID ตอนล็อกอิน"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.co.th" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="แผนก"><Input value={form.department} onChange={(e) => set('department', e.target.value)} /></Field>
          <Field label="โทรศัพท์"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <Field label="สิทธิ์">
          <Select value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
            <option value="user">พนักงาน</option>
            <option value="admin">Fleet Admin</option>
          </Select>
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  )
}
