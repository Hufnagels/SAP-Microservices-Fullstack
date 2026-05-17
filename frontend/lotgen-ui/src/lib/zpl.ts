import { LABEL_SIZES, type LabelSize } from '@/types'

export function generateZPL(lotNumber: string, sizeKey: LabelSize): string {
  const { w, h } = LABEL_SIZES[sizeKey]
  const today    = new Date().toLocaleDateString('hu-HU')
  const margin   = 40
  const usable   = w - margin * 2

  // Scale elements proportionally to label height
  const headerFontSize = Math.max(24, Math.round(h * 0.072))
  const lotFontSize    = Math.max(36, Math.round(h * 0.135))
  const barModW        = w < 900 ? 2 : 3
  const barH           = Math.round(h * 0.38)
  const barY           = Math.round(h * 0.33)
  const dateFontSize   = Math.max(20, Math.round(h * 0.058))
  const dateY          = h - Math.round(h * 0.09)

  return [
    '^XA',
    `^PW${w}`,
    `^LL${h}`,
    // Header
    `^CF0,${headerFontSize}`,
    `^FO${margin},30^FDSarzs / LOT^FS`,
    `^FO${margin},${30 + headerFontSize + 6}^GB${usable},2,2^FS`,
    // LOT number text
    `^CF0,${lotFontSize}`,
    `^FO${margin},${30 + headerFontSize + 16}^FD${lotNumber}^FS`,
    // Barcode (Code128)
    `^FO${margin},${barY}^BY${barModW},2,${barH}^BCN,,Y,N,N^FD${lotNumber}^FS`,
    // Date footer
    `^CF0,${dateFontSize}`,
    `^FO${margin},${dateY}^FD${today}^FS`,
    '^XZ',
  ].join('\n')
}
