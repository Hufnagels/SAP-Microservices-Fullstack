import { useEffect, useRef } from 'react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'
import type { PdfResult } from '@/lib/printPDF'

interface Props {
  result:    PdfResult | null
  itemCount: number
  onConfirm: () => void
  onCancel:  () => void
}

export function PdfPreviewModal({ result, itemCount, onConfirm, onCancel }: Props) {
  const open = !!result

  // Revoke blob URL on unmount or when result changes
  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== result?.previewUrl) {
      URL.revokeObjectURL(prevUrl.current)
    }
    prevUrl.current = result?.previewUrl ?? null
  }, [result?.previewUrl])

  const pages = result ? Math.ceil(itemCount / 24) : 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel() }}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle>
            PDF előnézet — {itemCount} cimke · {pages} oldal · Avery 3474 (A4, 3×8)
          </DialogTitle>
        </DialogHeader>

        {result && (
          <iframe
            src={result.previewUrl}
            className="w-full rounded border bg-gray-100"
            style={{ height: '60vh', minHeight: 400 }}
            title="PDF előnézet"
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1.5" />
            Mégse — generált számok törlése
          </Button>
          <Button onClick={onConfirm}>
            <Download className="h-4 w-4 mr-1.5" />
            PDF letöltés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
