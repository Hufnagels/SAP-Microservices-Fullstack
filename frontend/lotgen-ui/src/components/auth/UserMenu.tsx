import { useState } from 'react'
import { LogOut, Users } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { UsersModal } from './UsersModal'
import { useI18n } from '@/i18n'
import type { AuthUser } from '@/hooks/useAuth'

interface Props {
  user:     AuthUser
  token:    string
  onLogout: () => void
}

export function UserMenu({ user, token, onLogout }: Props) {
  const { t } = useI18n()
  const [usersOpen, setUsersOpen] = useState(false)
  const isAdmin = user.role === 'admin' || user.role === 'superadmin'

  const roleLabel = (role: string) => {
    switch (role) {
      case 'superadmin': return t('roleSuperadmin')
      case 'admin':      return t('roleAdmin')
      case 'operator':   return t('roleOperator')
      case 'viewer':     return t('roleViewer')
      case 'worker':     return t('roleWorker')
      default:           return role
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors focus:outline-none">
            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold uppercase select-none">
              {user.username[0]}
            </div>
            <div className="hidden sm:flex flex-col items-start leading-none">
              <span className="text-xs font-medium">{user.username}</span>
              <span className="text-[10px] text-muted-foreground">{roleLabel(user.role)}</span>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">{roleLabel(user.role)}</p>
          </DropdownMenuLabel>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setUsersOpen(true)}>
                <Users className="mr-2 h-4 w-4" />
                {t('users')}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isAdmin && (
        <UsersModal open={usersOpen} onClose={() => setUsersOpen(false)} token={token} />
      )}
    </>
  )
}
