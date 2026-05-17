import { useState } from 'react'
import { Toaster, toast } from 'sonner'
import { ConfigPanel }  from '@/components/lot/ConfigPanel'
import { PreviewCard }  from '@/components/lot/PreviewCard'
import { HistoryPanel } from '@/components/lot/HistoryPanel'
import { ZplPanel }     from '@/components/lot/ZplPanel'
import { LoginPage }    from '@/components/auth/LoginPage'
import { UserMenu }     from '@/components/auth/UserMenu'
import { useLotStore }  from '@/hooks/useLotStore'
import { useAuth }      from '@/hooks/useAuth'
import type { LotItem } from '@/types'
import { Tag } from 'lucide-react'

export default function App() {
  const auth  = useAuth()
  const store = useLotStore(auth.getToken(), auth.logout)
  const [printingId,     setPrintingId]     = useState<string | null>(null)
  const [selectedItem,   setSelectedItem]   = useState<LotItem | null>(null)
  const [prevCounter,    setPrevCounter]    = useState<number>(1)

  if (!auth.isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={auth.login} error={auth.error} busy={auth.busy} />
        <Toaster position="bottom-right" richColors />
      </>
    )
  }

  // ── print a single item via API ──────────────────────────────────────────
  const printItem = async (item: LotItem) => {
    setPrintingId(item.id)
    try {
      const res = await fetch(store.printerConfig.apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zpl:    item.zpl,
          copies: store.printerConfig.copies,
          lot:    item.lotNumber,
        }),
      })
      if (res.ok) {
        store.markPrinted(item.id)
        toast.success(`Nyomtatva: ${item.lotNumber}`)
      } else {
        toast.error(`Nyomtatási hiba: HTTP ${res.status}`)
      }
    } catch (err) {
      toast.error('A nyomtatóhoz nem sikerült csatlakozni')
    } finally {
      setPrintingId(null)
    }
  }

  // ── generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setPrevCounter(store.counter)
    try {
      const batch = await store.generate()
      toast.success(`${batch.length} szám generálva`)
    } catch {
      toast.error('Generálás sikertelen')
    }
  }

  const handleGeneratePrint = async () => {
    setPrevCounter(store.counter)
    try {
      const batch = await store.generate()
      toast.success(`${batch.length} szám generálva — nyomtatás indul...`)
      for (const item of batch) {
        await printItem(item)
      }
    } catch {
      toast.error('Generálás sikertelen')
    }
  }

  const handlePdfCancel = () => {
    store.clearItems()
    store.restoreCounter(prevCounter)
  }

  const handlePrintAll = async () => {
    const pending = store.items.filter(i => !i.printed)
    if (!pending.length) return
    toast.info(`${pending.length} elem nyomtatása...`)
    for (const item of pending) {
      await printItem(item)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center gap-3">
          <Tag className="h-5 w-5 text-amber" />
          <h1 className="font-semibold text-sm tracking-tight">Sarzs / LOT gereláló és nyomtató alkalzazás</h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>Számláló:</span>
              <span className="font-semibold text-foreground">{String(store.counter).padStart(6, '0')}</span>
            </div>
            <div className="border-l pl-4">
              <UserMenu user={auth.user!} token={auth.getToken()!} onLogout={auth.logout} />
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-[1280px] mx-auto px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* Left: Config */}
          <ConfigPanel
            lotConfig={store.lotConfig}
            printerConfig={store.printerConfig}
            counter={store.counter}
            onLotConfigChange={store.updateLotConfig}
            onPrinterConfigChange={store.updatePrinterConfig}
            onCounterChange={store.setCounter}
            onCounterReset={store.resetCounter}
          />

          {/* Right: Preview + History + ZPL */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <PreviewCard
              previewLot={store.previewLot}
              lotConfig={store.lotConfig}
              counter={store.counter}
              quantity={store.quantity}
              onQuantityChange={store.setQuantity}
              onGenerate={handleGenerate}
              onGeneratePrint={handleGeneratePrint}
            />

            <HistoryPanel
              items={store.items}
              onPrint={printItem}
              onPrintAll={handlePrintAll}
              onClear={store.clearItems}
              onPdfCancel={handlePdfCancel}
              onShowZpl={setSelectedItem}
              printingId={printingId}
            />

            <ZplPanel
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          </div>
        </div>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
