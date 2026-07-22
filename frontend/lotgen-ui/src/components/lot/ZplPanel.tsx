import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import type { LotItem } from '@/types'
import { useI18n } from '@/i18n'

interface Props {
  item:    LotItem | null
  onClose: () => void
}

export function ZplPanel({ item, onClose }: Props) {
  const { t } = useI18n()

  if (!item) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(item.zpl).then(() => {
      toast.success(t('zplCopied'))
    }).catch(() => {
      toast.error(t('copyFailed'))
    })
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('zplCode')}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-1">{item.lotNumber}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {t('copy')}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-[11px] font-mono leading-relaxed bg-muted rounded-md p-4 overflow-x-auto text-muted-foreground whitespace-pre">
          {item.zpl}
        </pre>
      </CardContent>
    </Card>
  )
}
