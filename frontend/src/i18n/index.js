import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'

export const SUPPORTED_LANGUAGES = ['en', 'ta', 'hi']
export const DEFAULT_LANGUAGE = 'en'
export const LANGUAGE_STORAGE_KEY = 'lang'

// None of the supported languages is RTL today; the mapping exists so adding one is a one-line change.
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']

// English ships in the main bundle; the others are fetched on demand.
const lazyBundles = {
  ta: () => import('../locales/ta.json'),
  hi: () => import('../locales/hi.json'),
}

export const isSupported = (lng) => SUPPORTED_LANGUAGES.includes(lng)

export const directionFor = (lng) => (RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr')

export function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isSupported(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

async function ensureBundle(lng) {
  if (lng === 'en' || i18n.hasResourceBundle(lng, 'translation')) return
  const mod = await lazyBundles[lng]()
  i18n.addResourceBundle(lng, 'translation', mod.default ?? mod, true, true)
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  document.documentElement.dir = directionFor(lng)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  } catch {
    /* storage unavailable (private mode); the in-memory choice still applies */
  }
})

/** Loads the locale if needed, then switches. Unsupported codes are ignored. */
export async function setLanguage(lng) {
  if (!isSupported(lng)) return i18n.language
  await ensureBundle(lng)
  await i18n.changeLanguage(lng)
  return lng
}

export async function initI18n() {
  const lng = readStoredLanguage()
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  })
  // init() replaces the resource store, so a non-English bundle must be added afterwards.
  await setLanguage(lng)
  return i18n
}

export default i18n
