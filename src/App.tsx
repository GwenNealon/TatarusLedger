const pageStyles = {
  minHeight: '100vh',
  margin: 0,
  padding: '2rem 1rem',
  display: 'grid',
  placeItems: 'center',
  backgroundColor: '#f8fafc',
  color: '#0f172a',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const cardStyles = {
  width: '100%',
  maxWidth: '48rem',
  borderRadius: '0.75rem',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
  padding: '2rem',
}

export default function App() {
  return (
    <main style={pageStyles}>
      <article style={cardStyles}>
        <h1>Tataru's Ledger</h1>
        <p>
          The official project website for tracking profitable crafting, gathering, and market board opportunities in Final Fantasy XIV.
        </p>
        <section aria-labelledby="project-status-heading">
          <h2 id="project-status-heading">Project status</h2>
          <p>
            This GitHub Pages deployment is the canonical public site for Tataru's Ledger. Feature updates are published automatically from the main branch.
          </p>
        </section>
      </article>
    </main>
  )
}
