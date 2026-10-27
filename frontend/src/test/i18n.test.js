import { describe, it, expect, vi } from 'vitest'
import i18n, {
  SUPPORTED_LANGUAGES,
  setLanguage,
  readStoredLanguage,
  directionFor,
} from '../i18n'
import en from '../locales/en.json'
import ta from '../locales/ta.json'
import hi from '../locales/hi.json'

describe('language switching', () => {
  it('starts in English with lang="en"', () => {
    expect(i18n.language).toBe('en')
    expect(i18n.t('nav.signOut')).toBe('Sign Out')
  })

  it('switches to Tamil and Hindi, loading the bundle on demand', async () => {
    await setLanguage('ta')
    expect(i18n.t('nav.signOut')).toBe(ta.nav.signOut)
    await setLanguage('hi')
    expect(i18n.t('nav.signOut')).toBe(hi.nav.signOut)
  })

  it('persists the choice to localStorage', async () => {
    await setLanguage('ta')
    expect(localStorage.getItem('lang')).toBe('ta')
    expect(readStoredLanguage()).toBe('ta')
  })

  it('updates the html lang attribute and direction', async () => {
    await setLanguage('hi')
    expect(document.documentElement.lang).toBe('hi')
    expect(document.documentElement.dir).toBe('ltr')
    await setLanguage('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('ignores unsupported languages', async () => {
    await setLanguage('fr')
    expect(i18n.language).toBe('en')
    expect(localStorage.getItem('lang')).not.toBe('fr')
  })

  it('falls back to English for a stored language that is not supported', () => {
    localStorage.setItem('lang', 'xx')
    expect(readStoredLanguage()).toBe('en')
  })

  it('restores the stored language on a cold start', async () => {
    localStorage.setItem('lang', 'ta')
    vi.resetModules()
    const fresh = await import('../i18n')
    await fresh.initI18n()
    expect(fresh.default.language).toBe('ta')
    expect(fresh.default.t('auth.signIn')).toBe(ta.auth.signIn)
    expect(document.documentElement.lang).toBe('ta')
  })

  it('falls back to English text when a key is missing', async () => {
    await setLanguage('ta')
    expect(i18n.t('definitely.not.a.key', { defaultValue: 'fallback' })).toBe('fallback')
  })

  it('treats none of the supported languages as right-to-left', () => {
    SUPPORTED_LANGUAGES.forEach((l) => expect(directionFor(l)).toBe('ltr'))
    expect(directionFor('ar')).toBe('rtl')
  })

  it('pluralises with count', async () => {
    expect(i18n.t('card.daysLeft', { count: 1 })).toBe('1 day left')
    expect(i18n.t('card.daysLeft', { count: 3 })).toBe('3 days left')
    await setLanguage('hi')
    expect(i18n.t('card.daysLeft', { count: 3 })).toContain('3')
  })
})

// Flatten nested JSON to dotted keys so locale files can be compared structurally.
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  )

const placeholders = (s) => (String(s).match(/{{\s*\w+\s*}}/g) || []).sort().join(',')

describe('locale files', () => {
  const enFlat = Object.fromEntries(flatten(en))

  for (const [name, bundle] of [['ta', ta], ['hi', hi]]) {
    const flat = Object.fromEntries(flatten(bundle))

    it(`${name} has exactly the same keys as en`, () => {
      const missing = Object.keys(enFlat).filter((k) => !(k in flat))
      const extra = Object.keys(flat).filter((k) => !(k in enFlat))
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it(`${name} keeps every interpolation placeholder`, () => {
      const bad = Object.keys(enFlat).filter((k) => k in flat && placeholders(enFlat[k]) !== placeholders(flat[k]))
      expect(bad).toEqual([])
    })

    it(`${name} has no empty strings`, () => {
      expect(Object.entries(flat).filter(([, v]) => !String(v).trim())).toEqual([])
    })
  }
})
