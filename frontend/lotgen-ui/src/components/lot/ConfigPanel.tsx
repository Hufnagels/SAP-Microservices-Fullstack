import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { RotateCcw } from 'lucide-react'
import type { LotConfig, PrinterConfig, DateFormat, Separator as SepType, LabelSize } from '@/types'
import { LABEL_SIZES } from '@/types'

interface Props {
  lotConfig:            LotConfig
  printerConfig:        PrinterConfig
  counter:              number
  onLotConfigChange:    (p: Partial<LotConfig>)     => void
  onPrinterConfigChange:(p: Partial<PrinterConfig>) => void
  onCounterChange:      (v: number) => void
  onCounterReset:       () => void
}

export function ConfigPanel({
  lotConfig, printerConfig, counter,
  onLotConfigChange, onPrinterConfigChange,
  onCounterChange, onCounterReset,
}: Props) {
  return (
    <aside className="flex flex-col gap-3 w-[240px] shrink-0">

      {/* ── Format ── */}
      <Card>
        <CardHeader><CardTitle>Formátum</CardTitle></CardHeader>
        <CardContent className="space-y-3">

          <div className="space-y-1">
            <Label>Előtag (prefix)</Label>
            <Select
              value={lotConfig.prefix}
              onValueChange={v => onLotConfigChange({ prefix: v })}
            >
              <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TM1" className="font-mono">TM1</SelectItem>
                <SelectItem value="TM2" className="font-mono">TM2</SelectItem>
                <SelectItem value="SZ1" className="font-mono">SZ1</SelectItem>
                <SelectItem value="DM1" className="font-mono">DM1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Dátum</Label>
            <Select
              value={lotConfig.dateFormat}
              onValueChange={v => onLotConfigChange({ dateFormat: v as DateFormat })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYYMMDD">YYYYMMDD — 20250504</SelectItem>
                <SelectItem value="YYMMDD">YYMMDD — 250504</SelectItem>
                <SelectItem value="YYMM">YYMM — 2505</SelectItem>
                <SelectItem value="YYYYWW">YYYYWW — hétszám</SelectItem>
                <SelectItem value="none">Nincs dátum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Elválasztó</Label>
            <Select
              value={lotConfig.separator === '' ? 'none' : lotConfig.separator}
              onValueChange={v => onLotConfigChange({ separator: (v === 'none' ? '' : v) as SepType })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Kötőjel  ( - )</SelectItem>
                <SelectItem value="/">Perjel  ( / )</SelectItem>
                <SelectItem value="_">Aláhúzás  ( _ )</SelectItem>
                <SelectItem value="none">Nincs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Sorszám jegyek</Label>
            <Select
              value={String(lotConfig.seqDigits)}
              onValueChange={v => onLotConfigChange({ seqDigits: Number(v) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 jegy — 001</SelectItem>
                <SelectItem value="4">4 jegy — 0001</SelectItem>
                <SelectItem value="5">5 jegy — 00001</SelectItem>
                <SelectItem value="6">6 jegy — 000001</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cfg-suffix">Utótag (opcionális)</Label>
            <Input
              id="cfg-suffix"
              value={lotConfig.suffix}
              onChange={e => onLotConfigChange({ suffix: e.target.value })}
              placeholder="pl. -A"
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Printer ── */}
      <Card>
        <CardHeader><CardTitle>Nyomtató</CardTitle></CardHeader>
        <CardContent className="space-y-3">

          <div className="space-y-1">
            <Label htmlFor="cfg-api">API endpoint</Label>
            <Input
              id="cfg-api"
              value={printerConfig.apiUrl}
              onChange={e => onPrinterConfigChange({ apiUrl: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label>Cimke méret</Label>
            <Select
              value={printerConfig.labelSize}
              onValueChange={v => onPrinterConfigChange({ labelSize: v as LabelSize })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(LABEL_SIZES) as [LabelSize, { label: string }][]).map(
                  ([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cfg-copies">Példányszám</Label>
            <Input
              id="cfg-copies"
              type="number"
              min={1} max={10}
              value={printerConfig.copies}
              onChange={e => onPrinterConfigChange({ copies: Math.max(1, Number(e.target.value)) })}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Counter ── */}
      <Card>
        <CardHeader><CardTitle>Számláló</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cfg-counter">Aktuális érték</Label>
            <Input
              id="cfg-counter"
              type="number"
              min={1} max={999999}
              value={counter}
              onChange={e => onCounterChange(Math.max(1, Number(e.target.value)))}
              className="font-mono text-lg"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onCounterReset}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Visszaállítás 1-re
          </Button>
        </CardContent>
      </Card>

    </aside>
  )
}
