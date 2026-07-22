import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface Props {
  value:     string
  className?: string
  height?:   number
}

export function BarcodePreview({ value, className, height = 64 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format:       'CODE128',
        width:        2,
        height,
        displayValue: false,
        margin:       0,
        background:   '#ffffff',
        lineColor:    '#111111',
      })
    } catch {
      // invalid value — clear the SVG
      if (svgRef.current) svgRef.current.innerHTML = ''
    }
  }, [value])

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-label={`Code128 barcode: ${value}`}
    />
  )
}
