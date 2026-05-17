import { useState, useCallback, useEffect, useRef } from 'react'
import type { LotConfig, PrinterConfig, LotItem, LabelSize } from '@/types'
import { formatLotNumber } from '@/lib/lot'
import { generateZPL } from '@/lib/zpl'

const API = ''   // relative — nginx proxies /lot/* to Traefik → lotgen-service

const DEFAULT_LOT_CONFIG: LotConfig = {
  prefix:     'TM1',
  dateFormat: 'YYMMDD',
  separator:  '-',
  seqDigits:  4,
  suffix:     '',
}

const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  apiUrl:    'http://localhost/labeling/print',
  labelSize: '70x37',
  copies:    1,
}

export function useLotStore(token: string | null, onUnauthorized?: () => void) {
  const [lotConfig,     setLotConfig]     = useState<LotConfig>(DEFAULT_LOT_CONFIG)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  const [counter,       setCounter]       = useState(1)
  const [quantity,      setQuantity]      = useState(1)
  const [items,         setItems]         = useState<LotItem[]>([])

  // Stable refs for values that must not recreate callbacks
  const tokenRef          = useRef(token)
  const onUnauthorizedRef = useRef(onUnauthorized)
  useEffect(() => { tokenRef.current          = token          }, [token])
  useEffect(() => { onUnauthorizedRef.current = onUnauthorized }, [onUnauthorized])

  const headers = useCallback((): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
  }), [])

  const guardedFetch = useCallback(async (url: string, init: RequestInit): Promise<Response> => {
    const res = await fetch(url, init)
    if (res.status === 401) onUnauthorizedRef.current?.()
    return res
  }, [])

  // ── counter ───────────────────────────────────────────────────────────────────
  const fetchCounter = useCallback(async (prefix: string) => {
    if (!tokenRef.current) return
    try {
      const res = await guardedFetch(`${API}/lot/counter/${prefix}`, { headers: headers() })
      if (res.ok) setCounter((await res.json()).counter)
    } catch { /* backend unreachable */ }
  }, [headers, guardedFetch])

  // Re-fetch whenever prefix changes OR when token becomes available (after login)
  useEffect(() => {
    if (token) fetchCounter(lotConfig.prefix)
  }, [token, lotConfig.prefix, fetchCounter])

  // ── derived ───────────────────────────────────────────────────────────────────
  const previewLot = formatLotNumber(counter, lotConfig)

  // ── generate — reads state directly so values are always current ──────────────
  const generate = useCallback(async (): Promise<LotItem[]> => {
    if (!tokenRef.current) return []

    const res = await guardedFetch(`${API}/lot/generate`, {
      method:  'POST',
      headers: headers(),
      body: JSON.stringify({
        prefix:      lotConfig.prefix,
        date_format: lotConfig.dateFormat,
        separator:   lotConfig.separator,
        seq_digits:  lotConfig.seqDigits,
        suffix:      lotConfig.suffix,
        quantity,
        label_size:  printerConfig.labelSize,
      }),
    })

    if (!res.ok) throw new Error(`Generate failed: ${res.status}`)
    const { items: generated, next_counter } = await res.json()

    const batch: LotItem[] = generated.map((g: {
      id: number; lot_number: string; generated_at: string; label_size: LabelSize
    }) => ({
      id:        String(g.id),
      lotNumber: g.lot_number,
      timestamp: new Date(g.generated_at),
      printed:   false,
      zpl:       generateZPL(g.lot_number, g.label_size as LabelSize),
      labelSize: g.label_size as LabelSize,
    }))

    setItems(prev => [...batch, ...prev])
    setCounter(next_counter)
    return batch
  }, [headers, guardedFetch, lotConfig, quantity, printerConfig.labelSize])

  // ── other actions ─────────────────────────────────────────────────────────────
  const markPrinted = useCallback(async (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, printed: true } : it))
    try {
      await guardedFetch(`${API}/lot/${id}/printed`, { method: 'PUT', headers: headers() })
    } catch { /* non-critical */ }
  }, [headers, guardedFetch])

  const clearItems = useCallback(() => setItems([]), [])

  const resetCounter = useCallback(async () => {
    setCounter(1)
    if (!tokenRef.current) return
    try {
      await guardedFetch(`${API}/lot/counter/${lotConfig.prefix}`, {
        method:  'PUT',
        headers: headers(),
        body:    JSON.stringify({ value: 1 }),
      })
    } catch { /* non-critical */ }
  }, [headers, guardedFetch, lotConfig.prefix])

  const restoreCounter = useCallback(async (value: number) => {
    setCounter(value)
    if (!tokenRef.current) return
    try {
      await guardedFetch(`${API}/lot/counter/${lotConfig.prefix}`, {
        method:  'PUT',
        headers: headers(),
        body:    JSON.stringify({ value }),
      })
    } catch { /* non-critical */ }
  }, [headers, guardedFetch, lotConfig.prefix])

  const updateLotConfig = useCallback((partial: Partial<LotConfig>) => {
    setLotConfig(prev => ({ ...prev, ...partial }))
  }, [])

  const updatePrinterConfig = useCallback((partial: Partial<PrinterConfig>) => {
    setPrinterConfig(prev => ({ ...prev, ...partial }))
  }, [])

  return {
    lotConfig,     updateLotConfig,
    printerConfig, updatePrinterConfig,
    counter,       setCounter,
    quantity,      setQuantity,
    items,
    previewLot,
    generate,
    markPrinted,
    clearItems,
    resetCounter,
    restoreCounter,
  }
}
