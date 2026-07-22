import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import type { LotItem } from '@/types'

// ── Template definitions ──────────────────────────────────────────────────────

interface Template {
  labelW:     number   // mm
  labelH:     number   // mm
  cols:       number
  rows:       number
  marginL:    number   // mm — left edge of first column
  marginT:    number   // mm — top edge of first row
  colGap:     number   // mm — horizontal gap between columns
  rowGap:     number   // mm — vertical gap between rows
  textY:      number   // mm from cell top — LOT number baseline
  barcodeY:   number   // mm from cell top — barcode top edge
  barcodeH:   number   // mm — barcode height
  barcodePad: number   // mm — left/right padding inside cell
  fontSize:   number   // pt
}

// Avery Zweckform 3474 — A4, 70×37mm, 3×8 = 24 labels
//   3×70 = 210 = A4 width; 0.5 + 8×37 = 296.5 ≈ 297
const T_3474: Template = {
  labelW: 70, labelH: 37, cols: 3, rows: 8,
  marginL: 0, marginT: 0.5, colGap: 0, rowGap: 0,
  textY: 7, barcodeY: 9, barcodeH: 14, barcodePad: 4,
  fontSize: 8,
}

// Avery L4785 — A4, 80×50mm, 2×5 = 10 labels
//   15+80+20+80+15 = 210 = A4 width
//   15 + 5×50 + 4×4.25 + 15 = 297 ✓
const T_L4785: Template = {
  labelW: 80, labelH: 50, cols: 2, rows: 5,
  marginL: 15, marginT: 15, colGap: 20, rowGap: 4.25,
  textY: 9, barcodeY: 12, barcodeH: 16, barcodePad: 5,
  fontSize: 9,
}

// Avery 3424 — A4, 105×48mm, 2×6 = 12 labels
//   2×105 = 210 = A4 width; top margin = (297 − 6×48) / 2 = 4.5mm
const T_3424: Template = {
  labelW: 105, labelH: 48, cols: 2, rows: 6,
  marginL: 0, marginT: 4.5, colGap: 0, rowGap: 0,
  textY: 9, barcodeY: 12, barcodeH: 18, barcodePad: 6,
  fontSize: 9,
}

interface TemplateInfo { tmpl: Template; name: string }

function templateFor(labelSize: string): TemplateInfo {
  if (labelSize === '80x50')  return { tmpl: T_L4785, name: 'Avery L4785 (A4, 2×5)' }
  if (labelSize === '105x48') return { tmpl: T_3424,  name: 'Avery 3424 (A4, 2×6)' }
  return { tmpl: T_3474, name: 'Avery 3474 (A4, 3×8)' }
}

// ── Barcode rasteriser ────────────────────────────────────────────────────────

function renderBarcode(value: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, value, {
    format:       'CODE128',
    width:        2,
    height:       80,
    margin:       0,
    displayValue: false,
    background:   '#ffffff',
    lineColor:    '#000000',
  })
  return canvas.toDataURL('image/png')
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PdfResult {
  previewUrl:   string
  perPage:      number
  templateName: string
  download:     () => void
  cleanup:      () => void
}

export function buildLotsPDF(items: LotItem[], filename = 'lot-numbers.pdf'): PdfResult | null {
  if (!items.length) return null

  const { tmpl, name: templateName } = templateFor(items[0].labelSize)
  const perPage = tmpl.cols * tmpl.rows

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  items.forEach((item, idx) => {
    if (idx > 0 && idx % perPage === 0) pdf.addPage()

    const pos = idx % perPage
    const col = pos % tmpl.cols
    const row = Math.floor(pos / tmpl.cols)

    const x = tmpl.marginL + col * (tmpl.labelW + tmpl.colGap)
    const y = tmpl.marginT + row * (tmpl.labelH + tmpl.rowGap)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(tmpl.fontSize)
    pdf.setTextColor(0, 0, 0)
    pdf.text(item.lotNumber, x + tmpl.labelW / 2, y + tmpl.textY, { align: 'center' })

    try {
      const img = renderBarcode(item.lotNumber)
      pdf.addImage(
        img, 'PNG',
        x + tmpl.barcodePad,
        y + tmpl.barcodeY,
        tmpl.labelW - tmpl.barcodePad * 2,
        tmpl.barcodeH,
      )
    } catch { /* skip if value invalid */ }
  })

  const blob = pdf.output('blob')
  const url  = URL.createObjectURL(blob)

  return {
    previewUrl: url,
    perPage,
    templateName,
    download: () => {
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
    },
    cleanup: () => URL.revokeObjectURL(url),
  }
}
