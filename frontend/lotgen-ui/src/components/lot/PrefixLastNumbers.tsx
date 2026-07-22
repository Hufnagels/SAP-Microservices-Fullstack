import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n'

const API      = ''
const PREFIXES = ['DM1', 'SZ1', 'TM1', 'TM2'] as const

interface LastMap { [prefix: string]: string | null }

interface Props {
  token:      string | null
  refreshKey: number
}

export function PrefixLastNumbers({ token, refreshKey }: Props) {
  const { t } = useI18n()
  const [last, setLast] = useState<LastMap>({})

  useEffect(() => {
    if (!token) return
    fetch(`${API}/lot/last`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLast(data) })
      .catch(() => {})
  }, [token, refreshKey])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('lastBatch')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {PREFIXES.map(prefix => (
          <div key={prefix} className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-8 shrink-0">
              {prefix}
            </span>
            <span className="font-mono text-[11px] text-right truncate">
              {last[prefix] ?? <span className="text-muted-foreground italic">—</span>}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
