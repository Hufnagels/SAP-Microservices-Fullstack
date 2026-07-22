import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BarcodePreview } from './BarcodePreview'
import { Printer, Zap } from 'lucide-react'
import { formatLotNumber } from '@/lib/lot'
import { useI18n } from '@/i18n'
import type { LotConfig, LabelSize } from '@/types'

interface Props {
  previewLot:  string
  lotConfig:   LotConfig
  labelSize:   LabelSize
  counter:     number
  quantity:    number
  onQuantityChange: (v: number) => void
  onGenerate:       ()          => void
  onGeneratePrint:  ()          => void
}

function computePreview(wMm: number, hMm: number) {
  const scale    = Math.min(400 / wMm, 480 / hMm, 4.5)
  const pxW      = Math.round(wMm * scale)
  const pxH      = Math.round(hMm * scale)
  const pad      = Math.round(Math.min(wMm, hMm) * scale * 0.07)
  const barH     = Math.round(pxH * 0.42)
  const fontSize = Math.max(10, Math.min(20, Math.round(pxW * 0.048)))
  return { pxW, pxH, pad, barH, fontSize }
}

export function PreviewCard({
  previewLot, lotConfig, labelSize, counter, quantity,
  onQuantityChange, onGenerate, onGeneratePrint,
}: Props) {
  const { t } = useI18n()
  const rangeEnd = formatLotNumber(counter + quantity - 1, lotConfig)
  const [wMm, hMm] = labelSize.split('x').map(Number)
  const { pxW, pxH, pad, barH, fontSize } = computePreview(wMm, hMm)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('preview')}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {wMm} × {hMm} mm
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Label mock */}
        <div className="flex justify-center">
          <div
            className="rounded border bg-white flex flex-col items-center justify-center shadow-sm"
            style={{ width: pxW, height: pxH, padding: pad, gap: Math.round(pad * 0.6) }}
          >
            <p
              className="font-mono font-semibold tracking-widest text-zinc-900 select-all whitespace-nowrap"
              style={{ fontSize }}
            >
              {previewLot}
            </p>
            <BarcodePreview
              value={previewLot}
              className="w-full"
              height={barH}
            />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground font-mono">
          {t('range')}: {previewLot} – {rangeEnd}
        </p>

        {/* Controls */}
        <div className="flex items-end gap-3">
          <div className="w-28 shrink-0 space-y-1">
            <Label htmlFor="qty">{t('quantity')}</Label>
            <Input
              id="qty"
              type="number"
              min={1} max={500}
              value={quantity}
              onChange={e => onQuantityChange(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <Button variant="outline" className="flex-1" onClick={onGenerate}>
            <Zap className="h-4 w-4 mr-2" />
            {t('generate')}
          </Button>

          <Button variant="amber" className="flex-1" onClick={onGeneratePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {t('generateAndPrint')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
