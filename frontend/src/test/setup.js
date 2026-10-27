import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { initI18n, setLanguage } from '../i18n'

beforeAll(async () => {
  await initI18n()
})

afterEach(async () => {
  cleanup()
  localStorage.clear()
  await setLanguage('en')
  localStorage.clear()
})
