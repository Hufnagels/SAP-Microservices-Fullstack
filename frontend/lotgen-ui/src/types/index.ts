export type DateFormat = 'YYYYMMDD' | 'YYMMDD' | 'YYMM' | 'YYYYWW' | 'none'
export type Separator  = '-' | '/' | '_' | ''
export type LabelSize  = '70x37' | '80x50' | '102x51' | '102x76' | '102x152'

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
  '70x37':   { w: mmToDots(70),  h: mmToDots(37),  label: '70 × 37 mm' },
  '80x50':   { w: mmToDots(80),  h: mmToDots(50),  label: '80 × 50 mm' },
  '102x51':  { w: mmToDots(102), h: mmToDots(51),  label: '102 × 51 mm' },
  '102x76':  { w: mmToDots(102), h: mmToDots(76),  label: '102 × 76 mm' },
  '102x152': { w: mmToDots(102), h: mmToDots(152), label: '102 × 152 mm' },
}

function mmToDots(mm: number): number {
  return Math.round(mm * 300 / 25.4)
}
