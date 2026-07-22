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
import { useI18n }      from '@/i18n'
import type { Locale }  from '@/i18n'
import type { LotItem } from '@/types'
import { Tag } from 'lucide-react'

const LOCALE_LABELS: Record<Locale, string> = { hu: 'HU', en: 'EN', de: 'DE' }

export default function App() {
  const auth  = useAuth()
  const store = useLotStore(auth.getToken(), auth.logout)
  const { locale, setLocale, t, tf } = useI18n()
  const [printingId,   setPrintingId]   = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<LotItem | null>(null)
  const [prevCounter,  setPrevCounter]  = useState<number>(1)

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
        toast.success(tf('toastPrinted', item.lotNumber))
      } else {
        toast.error(tf('toastPrintError', res.status))
      }
    } catch {
      toast.error(t('toastPrinterUnreachable'))
    } finally {
      setPrintingId(null)
    }
  }

  // ── generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setPrevCounter(store.counter)
    try {
      const batch = await store.generate()
      toast.success(tf('toastGenerated', batch.length))
    } catch {
      toast.error(t('toastGenerateFailed'))
    }
  }

  const handleGeneratePrint = async () => {
    setPrevCounter(store.counter)
    try {
      const batch = await store.generate()
      toast.success(tf('toastGeneratedPrint', batch.length))
      for (const item of batch) {
        await printItem(item)
      }
    } catch {
      toast.error(t('toastGenerateFailed'))
    }
  }

  const handlePdfCancel = () => {
    store.clearItems()
    store.restoreCounter(prevCounter)
  }

  const handlePrintAll = async () => {
    const pending = store.items.filter(i => !i.printed)
    if (!pending.length) return
    toast.info(tf('toastPrintingItems', pending.length))
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
          <h1 className="font-semibold text-sm tracking-tight">{t('appTitle')}</h1>
          <div className="ml-auto flex items-center gap-4">

            {/* Language switcher */}
            <div className="flex items-center gap-0.5">
              {(Object.keys(LOCALE_LABELS) as Locale[]).map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocale(loc)}
                  className={[
                    'text-[11px] font-bold px-2 py-1 rounded transition-colors',
                    locale === loc
                      ? 'bg-amber-500 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  ].join(' ')}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span>{t('counterLabel')}</span>
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
              labelSize={store.printerConfig.labelSize}
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
