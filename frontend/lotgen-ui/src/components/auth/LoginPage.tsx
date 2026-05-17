import { useState, FormEvent } from 'react'
import { Tag, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import type { useAuth } from '@/hooks/useAuth'

type Props = {
  onLogin: ReturnType<typeof useAuth>['login']
  error:   string | null
  busy:    boolean
}

export function LoginPage({ onLogin, error, busy }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onLogin(username, password)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / title */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-amber/10 flex items-center justify-center">
            <Tag className="h-6 w-6 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sarzs / LOT gereláló</h1>
          <p className="text-sm text-muted-foreground">Jelentkezz be a folytatáshoz</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <Label htmlFor="username">Felhasználónév</Label>
            <Input
              id="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={busy}
              className="bg-white"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Jelszó</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
              className="bg-white"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={busy || !username || !password}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bejelentkezés'}
          </Button>
        </form>
      </div>
    </div>
  )
}
