import { createContext, useContext, useState, ReactNode } from 'react'

export type Locale = 'hu' | 'en' | 'de'

// ── Translations ──────────────────────────────────────────────────────────────

const t_hu = {
  // app
  appTitle:              'Sarzs / LOT generáló és nyomtató alkalmazás',
  appTitleShort:         'Sarzs / LOT generáló',
  counterLabel:          'Számláló:',
  // config — format card
  format:                'Formátum',
  prefix:                'Előtag (prefix)',
  date:                  'Dátum',
  dateWeekNumber:        'hétszám',
  noDate:                'Nincs dátum',
  separator:             'Elválasztó',
  hyphen:                'Kötőjel  ( - )',
  slash:                 'Perjel  ( / )',
  underscore:            'Aláhúzás  ( _ )',
  none:                  'Nincs',
  seqDigits:             'Sorszám jegyek',
  digitsUnit:            'jegy',
  suffix:                'Utótag (opcionális)',
  suffixPlaceholder:     'pl. -A',
  // config — printer card
  printer:               'Nyomtató',
  labelSize:             'Cimke méret',
  copies:                'Példányszám',
  // config — counter card
  currentValue:          'Aktuális érték',
  resetTo1:              'Visszaállítás 1-re',
  // preview card
  preview:               'Előnézet',
  range:                 'Tartomány',
  quantity:              'Mennyiség',
  generate:              'Generálás',
  generateAndPrint:      'Generálás + Nyomtatás',
  // history panel
  generatedNumbers:      'Generált számok',
  printAll:              'Összes nyomtat',
  clearAll:              'Törlés',
  noNumbersYet:          'Még nincs generált szám — kattints a Generálás gombra',
  printed:               'Nyomtatva',
  pending:               'Vár',
  viewZpl:               'ZPL kód megtekintése',
  reprint:               'Újra',
  print:                 'Nyomtat',
  labels:                'cimke',
  // PDF modal
  pdfPreview:            'PDF előnézet',
  pages:                 'oldal',
  cancelClearNumbers:    'Mégse — generált számok törlése',
  downloadPdf:           'PDF letöltés',
  // ZPL panel
  zplCode:               'ZPL kód',
  copy:                  'Másolás',
  zplCopied:             'ZPL kód vágólapra másolva',
  copyFailed:            'Másolás nem sikerült',
  // auth
  signInToContinue:      'Jelentkezz be a folytatáshoz',
  username:              'Felhasználónév',
  password:              'Jelszó',
  newPassword:           'Új jelszó (hagyható üresen)',
  signIn:                'Bejelentkezés',
  users:                 'Felhasználók',
  logout:                'Kijelentkezés',
  // users modal
  userManagement:        'Felhasználók kezelése',
  name:                  'Név',
  email:                 'E-mail',
  role:                  'Szerepkör',
  errorOccurred:         'Hiba történt',
  cancel:                'Mégse',
  save:                  'Mentés',
  create:                'Létrehozás',
  newUser:               'Új felhasználó',
  active:                'Aktív',
  inactive:              'Inaktív',
  editTooltip:           'Szerkesztés',
  deleteTooltip:         'Törlés',
  // roles
  roleSuperadmin:        'Superadmin',
  roleAdmin:             'Admin',
  roleOperator:          'Operátor',
  roleViewer:            'Néző',
  roleWorker:            'Dolgozó',
  // last lot
  lastBatch:             'Utolsó sarzs',
  // parameterised (use {0}, {1})
  toastGenerated:        '{0} szám generálva',
  toastGeneratedPrint:   '{0} szám generálva — nyomtatás indul...',
  toastPrinted:          'Nyomtatva: {0}',
  toastPrintError:       'Nyomtatási hiba: HTTP {0}',
  toastPrinterUnreachable: 'A nyomtatóhoz nem sikerült csatlakozni',
  toastGenerateFailed:   'Generálás sikertelen',
  toastPrintingItems:    '{0} elem nyomtatása...',
  deleteConfirm:         'Töröljük: {0}?',
  pdfInfo:               '{0} cimke · {1} oldal',
  seqDigitsOption:       '{0} jegy — {1}',
  // locale
  bcp47:                 'hu-HU',
}

type TMap = typeof t_hu
const t_en: TMap = {
  appTitle:              'Batch / LOT Generator & Printer',
  appTitleShort:         'Batch / LOT Generator',
  counterLabel:          'Counter:',
  format:                'Format',
  prefix:                'Prefix',
  date:                  'Date',
  dateWeekNumber:        'week number',
  noDate:                'No date',
  separator:             'Separator',
  hyphen:                'Hyphen  ( - )',
  slash:                 'Slash  ( / )',
  underscore:            'Underscore  ( _ )',
  none:                  'None',
  seqDigits:             'Sequence digits',
  digitsUnit:            'digits',
  suffix:                'Suffix (optional)',
  suffixPlaceholder:     'e.g. -A',
  printer:               'Printer',
  labelSize:             'Label size',
  copies:                'Copies',
  currentValue:          'Current value',
  resetTo1:              'Reset to 1',
  preview:               'Preview',
  range:                 'Range',
  quantity:              'Quantity',
  generate:              'Generate',
  generateAndPrint:      'Generate + Print',
  generatedNumbers:      'Generated numbers',
  printAll:              'Print all',
  clearAll:              'Clear',
  noNumbersYet:          'No numbers generated yet — click Generate',
  printed:               'Printed',
  pending:               'Pending',
  viewZpl:               'View ZPL code',
  reprint:               'Reprint',
  print:                 'Print',
  labels:                'labels',
  pdfPreview:            'PDF preview',
  pages:                 'pages',
  cancelClearNumbers:    'Cancel — clear generated numbers',
  downloadPdf:           'Download PDF',
  zplCode:               'ZPL code',
  copy:                  'Copy',
  zplCopied:             'ZPL code copied to clipboard',
  copyFailed:            'Copy failed',
  signInToContinue:      'Sign in to continue',
  username:              'Username',
  password:              'Password',
  newPassword:           'New password (leave empty to keep)',
  signIn:                'Sign in',
  users:                 'Users',
  logout:                'Logout',
  userManagement:        'User management',
  name:                  'Name',
  email:                 'E-mail',
  role:                  'Role',
  errorOccurred:         'An error occurred',
  cancel:                'Cancel',
  save:                  'Save',
  create:                'Create',
  newUser:               'New user',
  active:                'Active',
  inactive:              'Inactive',
  editTooltip:           'Edit',
  deleteTooltip:         'Delete',
  roleSuperadmin:        'Superadmin',
  roleAdmin:             'Admin',
  roleOperator:          'Operator',
  roleViewer:            'Viewer',
  roleWorker:            'Worker',
  lastBatch:             'Last batch',
  toastGenerated:        '{0} numbers generated',
  toastGeneratedPrint:   '{0} numbers generated — printing...',
  toastPrinted:          'Printed: {0}',
  toastPrintError:       'Print error: HTTP {0}',
  toastPrinterUnreachable: 'Could not connect to printer',
  toastGenerateFailed:   'Generation failed',
  toastPrintingItems:    'Printing {0} items...',
  deleteConfirm:         'Delete: {0}?',
  pdfInfo:               '{0} labels · {1} pages',
  seqDigitsOption:       '{0} digits — {1}',
  bcp47:                 'en-US',
}

const t_de: TMap = {
  appTitle:              'Charge / LOT Generator & Drucker',
  appTitleShort:         'Charge / LOT Generator',
  counterLabel:          'Zähler:',
  format:                'Format',
  prefix:                'Präfix',
  date:                  'Datum',
  dateWeekNumber:        'Wochennummer',
  noDate:                'Kein Datum',
  separator:             'Trennzeichen',
  hyphen:                'Bindestrich  ( - )',
  slash:                 'Schrägstrich  ( / )',
  underscore:            'Unterstrich  ( _ )',
  none:                  'Keines',
  seqDigits:             'Sequenzstellen',
  digitsUnit:            'Stellen',
  suffix:                'Suffix (optional)',
  suffixPlaceholder:     'z.B. -A',
  printer:               'Drucker',
  labelSize:             'Etikettenformat',
  copies:                'Exemplare',
  currentValue:          'Aktueller Wert',
  resetTo1:              'Zurücksetzen auf 1',
  preview:               'Vorschau',
  range:                 'Bereich',
  quantity:              'Menge',
  generate:              'Generieren',
  generateAndPrint:      'Generieren + Drucken',
  generatedNumbers:      'Generierte Nummern',
  printAll:              'Alle drucken',
  clearAll:              'Löschen',
  noNumbersYet:          'Noch keine Nummern generiert — Generieren klicken',
  printed:               'Gedruckt',
  pending:               'Ausstehend',
  viewZpl:               'ZPL-Code anzeigen',
  reprint:               'Nochmal',
  print:                 'Drucken',
  labels:                'Etiketten',
  pdfPreview:            'PDF-Vorschau',
  pages:                 'Seiten',
  cancelClearNumbers:    'Abbrechen — generierte Nummern löschen',
  downloadPdf:           'PDF herunterladen',
  zplCode:               'ZPL-Code',
  copy:                  'Kopieren',
  zplCopied:             'ZPL-Code in die Zwischenablage kopiert',
  copyFailed:            'Kopieren fehlgeschlagen',
  signInToContinue:      'Anmelden zum Fortfahren',
  username:              'Benutzername',
  password:              'Passwort',
  newPassword:           'Neues Passwort (leer lassen zum Beibehalten)',
  signIn:                'Anmelden',
  users:                 'Benutzer',
  logout:                'Abmelden',
  userManagement:        'Benutzerverwaltung',
  name:                  'Name',
  email:                 'E-Mail',
  role:                  'Rolle',
  errorOccurred:         'Ein Fehler ist aufgetreten',
  cancel:                'Abbrechen',
  save:                  'Speichern',
  create:                'Erstellen',
  newUser:               'Neuer Benutzer',
  active:                'Aktiv',
  inactive:              'Inaktiv',
  editTooltip:           'Bearbeiten',
  deleteTooltip:         'Löschen',
  roleSuperadmin:        'Superadmin',
  roleAdmin:             'Admin',
  roleOperator:          'Operator',
  roleViewer:            'Betrachter',
  roleWorker:            'Mitarbeiter',
  lastBatch:             'Letzte Charge',
  toastGenerated:        '{0} Nummern generiert',
  toastGeneratedPrint:   '{0} Nummern generiert — Druck läuft...',
  toastPrinted:          'Gedruckt: {0}',
  toastPrintError:       'Druckfehler: HTTP {0}',
  toastPrinterUnreachable: 'Verbindung zum Drucker fehlgeschlagen',
  toastGenerateFailed:   'Generierung fehlgeschlagen',
  toastPrintingItems:    '{0} Elemente werden gedruckt...',
  deleteConfirm:         'Löschen: {0}?',
  pdfInfo:               '{0} Etiketten · {1} Seiten',
  seqDigitsOption:       '{0} Stellen — {1}',
  bcp47:                 'de-DE',
}

const TRANSLATIONS: Record<Locale, TMap> = { hu: t_hu, en: t_en, de: t_de }

// ── Context ───────────────────────────────────────────────────────────────────

type TranslationKey = keyof typeof t_hu

interface I18nCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
  tf: (key: TranslationKey, ...args: (string | number)[]) => string
}

const Ctx = createContext<I18nCtx | null>(null)

const STORAGE_KEY = 'lotgen_locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    return stored && stored in TRANSLATIONS ? stored : 'hu'
  })

  const setLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLocaleState(l)
  }

  const dict = TRANSLATIONS[locale]

  const t  = (key: TranslationKey) => dict[key]
  const tf = (key: TranslationKey, ...args: (string | number)[]) =>
    args.reduce<string>((s, arg, i) => s.replace(`{${i}}`, String(arg)), dict[key])

  return <Ctx.Provider value={{ locale, setLocale, t, tf }}>{children}</Ctx.Provider>
}

export function useI18n() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
