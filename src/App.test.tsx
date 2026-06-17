import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('renders the official website heading and deployment messaging', () => {
    const html = renderToStaticMarkup(<App />)
    const div = document.createElement('div')
    div.innerHTML = html

    expect(div.textContent).toContain("Tataru's Ledger")
    expect(html).toContain('official project website')
    expect(html).toContain('GitHub Pages deployment')
    expect(html).toContain('Project status')
  })
})
