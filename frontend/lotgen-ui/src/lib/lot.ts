import type { LotConfig, DateFormat } from '@/types'

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return String(weekNo).padStart(2, '0')
}

export function getDateString(format: DateFormat, date: Date = new Date()): string {
  const Y  = date.getFullYear().toString()
  const YY = Y.slice(2)
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const DD = String(date.getDate()).padStart(2, '0')

  switch (format) {
    case 'YYYYMMDD': return `${Y}${MM}${DD}`
    case 'YYMMDD':   return `${YY}${MM}${DD}`
    case 'YYMM':     return `${YY}${MM}`
    case 'YYYYWW':   return `${Y}${getISOWeek(date)}`
    case 'none':     return ''
  }
}

export function formatLotNumber(seq: number, cfg: LotConfig, date?: Date): string {
  const dateStr = getDateString(cfg.dateFormat, date)
  const seqStr  = String(seq).padStart(cfg.seqDigits, '0')
  const parts   = [cfg.prefix, dateStr, seqStr, cfg.suffix].filter(Boolean)
  return parts.join(cfg.separator)
}
