import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const lodestoneFont = new FontFace(
  'FFXIV_Lodestone_SSF',
  `url("${import.meta.env.BASE_URL}fonts/FFXIV_Lodestone_SSF.woff") format("woff")`,
)
void lodestoneFont
  .load()
  .then((loadedFont) => {
    document.fonts.add(loadedFont)
  })
  .catch(() => {
    // ponytail: keep UI functional if the icon font cannot load
  })

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
