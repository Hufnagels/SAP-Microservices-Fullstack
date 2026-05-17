import jsPDF from 'jspdf'
import JsBarcode from 'jsbarcode'
import type { LotItem } from '@/types'

// ── Avery Zweckform 3474 — A4, 3×8 = 24 labels ───────────────────────────────
const LABEL_W  = 70      // mm
const LABEL_H  = 37      // mm
const COLS     = 3
const ROWS     = 8
const MARGIN_T = 0.5     // mm  (0.5 + 8×37 = 296.5 ≈ 297)
const MARGIN_L = 0       // mm  (3×70 = 210 = A4 width)
const PER_PAGE = COLS * ROWS  // 24

// Content layout within each cell (matches preview.pdf)
const TEXT_Y      = 7    // mm from cell top  — LOT number baseline
const BARCODE_Y   = 9    // mm from cell top  — barcode top edge
const BARCODE_H   = 14   // mm                — barcode height
const BARCODE_PAD = 4    // mm                — left/right padding

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

export interface PdfResult {
  previewUrl: string
  download:   () => void
  cleanup:    () => void
}

export function buildLotsPDF(items: LotItem[], filename = 'lot-numbers.pdf'): PdfResult | null {
  if (!items.length) return null

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  items.forEach((item, idx) => {
    if (idx > 0 && idx % PER_PAGE === 0) pdf.addPage()

    const pos = idx % PER_PAGE
    const col = pos % COLS
    const row = Math.floor(pos / COLS)

    const x = MARGIN_L + col * LABEL_W
    const y = MARGIN_T + row * LABEL_H

    // LOT number — small, centered, above barcode
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(0, 0, 0)
    pdf.text(item.lotNumber, x + LABEL_W / 2, y + TEXT_Y, { align: 'center' })

    // Barcode — full width minus padding
    try {
      const img = renderBarcode(item.lotNumber)
      pdf.addImage(img, 'PNG', x + BARCODE_PAD, y + BARCODE_Y, LABEL_W - BARCODE_PAD * 2, BARCODE_H)
    } catch { /* skip if value invalid */ }
  })

  const blob = pdf.output('blob')
  const url  = URL.createObjectURL(blob)

  return {
    previewUrl: url,
    download:   () => {
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
    },
    cleanup: () => URL.revokeObjectURL(url),
  }
}
