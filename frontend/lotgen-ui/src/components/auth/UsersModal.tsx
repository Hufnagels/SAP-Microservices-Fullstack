import { useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input  } from '@/components/ui/input'
import { Label  } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const AUTH_URL = 'http://localhost/auth'

const ROLES = ['superadmin', 'admin', 'operator', 'viewer', 'worker'] as const
type Role = typeof ROLES[number]

interface User {
  id:       number
  username: string
  name:     string
  email:    string
  role:     Role
  status:   string   // "active" | "inactive"
}

const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  operator:   'Operátor',
  viewer:     'Néző',
  worker:     'Dolgozó',
}

const ROLE_COLORS: Record<Role, string> = {
  superadmin: 'bg-red-100 text-red-700',
  admin:      'bg-amber-100 text-amber-700',
  operator:   'bg-blue-100 text-blue-700',
  viewer:     'bg-gray-100 text-gray-600',
  worker:     'bg-green-100 text-green-700',
}

interface Props {
  open:     boolean
  onClose:  () => void
  token:    string
}

const emptyForm = { username: '', password: '', name: '', email: '', role: 'viewer' as Role }

export function UsersModal({ open, onClose, token }: Props) {
  const [users,    setUsers]    = useState<User[]>([])
  const [loading,  setLoading]  = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${AUTH_URL}/users`, { headers })
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) fetchUsers() }, [open])

  const openCreate = () => {
    setEditUser(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setForm({ username: u.username, password: '', name: u.name, email: u.email, role: u.role })
    setError(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      let res: Response
      if (editUser) {
        const body: Record<string, string> = { name: form.name, email: form.email, role: form.role }
        if (form.password) body.password = form.password
        res = await fetch(`${AUTH_URL}/users/${editUser.id}`, {
          method: 'PUT', headers, body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`${AUTH_URL}/users`, {
          method: 'POST', headers,
          body: JSON.stringify({ username: form.username, password: form.password, name: form.name, email: form.email, role: form.role }),
        })
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.detail ?? 'Hiba történt')
        return
      }
      setShowForm(false)
      fetchUsers()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Töröljük: ${u.username}?`)) return
    await fetch(`${AUTH_URL}/users/${u.id}`, { method: 'DELETE', headers })
    fetchUsers()
  }

  const handleSetStatus = async (u: User, status: string) => {
    await fetch(`${AUTH_URL}/users/${u.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ status }),
    })
    fetchUsers()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Felhasználók kezelése</DialogTitle>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {!editUser && (
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label>Felhasználónév</Label>
                  <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="bg-white" />
                </div>
              )}
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>{editUser ? 'Új jelszó (hagyható üresen)' : 'Jelszó'}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="bg-white" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>Név</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-white" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-white" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label>Szerepkör</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Mégse</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editUser ? 'Mentés' : 'Létrehozás')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreate}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Új felhasználó
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="divide-y rounded-lg border overflow-hidden">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold uppercase shrink-0">
                      {u.username[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.name || u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.username}{u.email ? ` · ${u.email}` : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    <Select
                      value={u.status}
                      onValueChange={v => handleSetStatus(u, v)}
                    >
                      <SelectTrigger className={`h-6 text-xs px-2 w-24 rounded-full border-0 font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active" className="text-xs">Aktív</SelectItem>
                        <SelectItem value="inactive" className="text-xs">Inaktív</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Szerkesztés">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u)} title="Törlés" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
