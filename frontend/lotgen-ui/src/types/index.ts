export type DateFormat = 'YYYYMMDD' | 'YYMMDD' | 'YYMM' | 'YYYYWW' | 'none'
export type Separator  = '-' | '/' | '_' | ''
export type LabelSize  = '70x37' | '80x50' | '105x48'

export interface LotConfig {
  prefix:     string
  dateFormat: DateFormat
  separator:  Separator
  seqDigits:  number
  suffix:     string
}

export interface PrinterConfig {
  apiUrl:    string
  labelSize: LabelSize
  copies:    number
}

export interface LotItem {
  id:         string
  lotNumber:  string
  timestamp:  Date
  printed:    boolean
  zpl:        string
  labelSize:  LabelSize
}

export const LABEL_SIZES: Record<LabelSize, { w: number; h: number; label: string }> = {
  '70x37':  { w: mmToDots(70),  h: mmToDots(37),  label: '70 × 37 mm' },
  '80x50':  { w: mmToDots(80),  h: mmToDots(50),  label: '80 × 50 mm' },
  '105x48': { w: mmToDots(105), h: mmToDots(48),  label: '105 × 48 mm' },
}

function mmToDots(mm: number): number {
  return Math.round(mm * 300 / 25.4)
}
