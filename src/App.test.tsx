import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('renders the application heading', () => {
    expect(renderToStaticMarkup(<App />)).toContain('Tatarus Ledger')
  })
})
