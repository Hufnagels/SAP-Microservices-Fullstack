import { useEffect, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import type { PdfResult } from '@/lib/printPDF'
import { useI18n } from '@/i18n'

interface Props {
  result:       PdfResult | null
  itemCount:    number
  perPage:      number
  templateName: string
  onConfirm:    () => void
  onCancel:     () => void
}

export function PdfPreviewModal({ result, itemCount, perPage, templateName, onConfirm, onCancel }: Props) {
  const { t, tf } = useI18n()
  const open = !!result

  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== result?.previewUrl) {
      URL.revokeObjectURL(prevUrl.current)
    }
    prevUrl.current = result?.previewUrl ?? null
  }, [result?.previewUrl])

  const pages = result ? Math.ceil(itemCount / perPage) : 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel() }}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>
            {t('pdfPreview')} — {tf('pdfInfo', itemCount, pages)} · {templateName}
          </DialogTitle>
        </DialogHeader>

        {result && (
          <iframe
            src={result.previewUrl}
            className="w-full rounded border bg-gray-100"
            style={{ height: '60vh', minHeight: 400 }}
            title={t('pdfPreview')}
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1.5" />
            {t('cancelClearNumbers')}
          </Button>
          <Button onClick={onConfirm}>
            <Download className="h-4 w-4 mr-1.5" />
            {t('downloadPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
