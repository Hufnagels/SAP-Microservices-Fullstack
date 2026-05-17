import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button }     from '@/components/ui/button'
import { Badge }      from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator }  from '@/components/ui/separator'
import { Printer, Code, Trash2, FileDown } from 'lucide-react'
import type { LotItem } from '@/types'
import { cn } from '@/lib/utils'
import { buildLotsPDF } from '@/lib/printPDF'
import type { PdfResult } from '@/lib/printPDF'
import { PdfPreviewModal } from './PdfPreviewModal'

interface Props {
  items:        LotItem[]
  onPrint:      (item: LotItem) => Promise<void>
  onPrintAll:   () => void
  onClear:      () => void
  onPdfCancel:  () => void
  onShowZpl:    (item: LotItem) => void
  printingId?:  string | null
}

export function HistoryPanel({
  items, onPrint, onPrintAll, onClear, onPdfCancel, onShowZpl, printingId,
}: Props) {
  const [pdfResult, setPdfResult] = useState<PdfResult | null>(null)

  const handlePdfOpen = () => {
    const result = buildLotsPDF(items)
    if (result) setPdfResult(result)
  }

  const handlePdfConfirm = () => {
    pdfResult?.download()
    pdfResult?.cleanup()
    setPdfResult(null)
  }

  const handlePdfCancel = () => {
    pdfResult?.cleanup()
    setPdfResult(null)
    onPdfCancel()
  }

  return (
    <Card className="flex flex-col min-h-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Generált számok</CardTitle>
          <div className="flex gap-2">
            {items.some(i => !i.printed) && (
              <Button variant="outline" size="sm" onClick={onPrintAll}>
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Összes nyomtat
              </Button>
            )}
            <Button
              variant="outline" size="sm"
              onClick={handlePdfOpen}
              disabled={!items.length}
              title="Avery 3474 — 3×8 = 24 cimke / A4"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={!items.length}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Törlés
            </Button>
          </div>
        </div>
      </CardHeader>

      <PdfPreviewModal
        result={pdfResult}
        itemCount={items.length}
        onConfirm={handlePdfConfirm}
        onCancel={handlePdfCancel}
      />

      <CardContent className="p-0 flex-1 min-h-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Még nincs generált szám — kattints a Generálás gombra
          </p>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="px-5 pb-3">
              {items.map((item, idx) => (
                <div key={item.id}>
                  <HistoryRow
                    item={item}
                    onPrint={() => onPrint(item)}
                    onShowZpl={() => onShowZpl(item)}
                    printing={printingId === item.id}
                  />
                  {idx < items.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryRow({
  item, onPrint, onShowZpl, printing,
}: {
  item:      LotItem
  onPrint:   () => void
  onShowZpl: () => void
  printing:  boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="font-mono text-sm font-medium flex-1 min-w-0 truncate">
        {item.lotNumber}
      </span>

      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        {item.labelSize} mm
      </span>

      <Badge variant={item.printed ? 'success' : 'muted'} className="shrink-0">
        {item.printed ? 'Nyomtatva' : 'Vár'}
      </Badge>

      <span className="text-[11px] text-muted-foreground font-mono shrink-0 w-[52px] text-right">
        {item.timestamp.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>

      <Button
        variant="ghost" size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onShowZpl}
        title="ZPL kód megtekintése"
      >
        <Code className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant={item.printed ? 'outline' : 'default'}
        size="sm"
        className="shrink-0 h-7 text-xs"
        onClick={onPrint}
        disabled={printing}
      >
        <Printer className={cn('h-3 w-3 mr-1', printing && 'animate-spin')} />
        {printing ? '...' : item.printed ? 'Újra' : 'Nyomtat'}
      </Button>
    </div>
  )
}
