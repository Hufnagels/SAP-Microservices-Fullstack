import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BarcodePreview } from './BarcodePreview'
import { Printer, Zap } from 'lucide-react'
import { formatLotNumber } from '@/lib/lot'
import type { LotConfig } from '@/types'

interface Props {
  previewLot: string
  lotConfig:  LotConfig
  counter:    number
  quantity:   number
  onQuantityChange: (v: number)  => void
  onGenerate:       ()           => void
  onGeneratePrint:  ()           => void
}

export function PreviewCard({
  previewLot, lotConfig, counter, quantity,
  onQuantityChange, onGenerate, onGeneratePrint,
}: Props) {
  const rangeEnd = formatLotNumber(counter + quantity - 1, lotConfig)

  return (
    <Card>
      <CardHeader><CardTitle>Előnézet</CardTitle></CardHeader>
      <CardContent className="space-y-4">

        {/* Label mock */}
        <div className="rounded-md border bg-white p-4 flex flex-col items-center gap-3">
          <p className="font-mono text-2xl font-semibold tracking-widest text-zinc-900 select-all">
            {previewLot}
          </p>
          <BarcodePreview value={previewLot} className="max-w-full" />
        </div>

        <p className="text-center text-xs text-muted-foreground font-mono">
          Tartomány: {previewLot} – {rangeEnd}
        </p>

        {/* Controls */}
        <div className="flex items-end gap-3">
          <div className="w-28 shrink-0 space-y-1">
            <Label htmlFor="qty">Mennyiség</Label>
            <Input
              id="qty"
              type="number"
              min={1} max={500}
              value={quantity}
              onChange={e => onQuantityChange(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <Button
            variant="outline"
            className="flex-1"
            onClick={onGenerate}
          >
            <Zap className="h-4 w-4 mr-2" />
            Generálás
          </Button>

          <Button
            variant="amber"
            className="flex-1"
            onClick={onGeneratePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Generálás + Nyomtatás
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
