import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from '../../data/types.ts'
import { toIconUrl } from './iconUrl.ts'

const SEARCH_DEBOUNCE_MS = 180
const MAX_RESULTS = 50

const searchInputStyles: CSSProperties = {
  width: '100%',
  maxWidth: '24rem',
  border: '1px solid #94a3b8',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '1rem',
}

const itemListStyles: CSSProperties = {
  listStyle: 'none',
  margin: '0.75rem 0 0',
  padding: 0,
  maxWidth: '24rem',
  maxHeight: '14rem',
  overflowY: 'auto',
  border: '1px solid #e2e8f0',
  borderRadius: '0.5rem',
}

const itemButtonStyles: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  border: 0,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem',
  cursor: 'pointer',
}

interface ItemSearchProps {
  items: NormalizedItem[]
  onSelectItem: (item: NormalizedItem) => void
}

export function ItemSearch(props: ItemSearchProps) {
  const { items, onSelectItem } = props
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [showAllResults, setShowAllResults] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(queryInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [queryInput])

  const { filteredItems, hasMoreResults } = useMemo(() => {
    if (query.length === 0) {
      return {
        filteredItems: [],
        hasMoreResults: false,
      }
    }

    const lowered = query.toLowerCase()
    const matches: NormalizedItem[] = []
    let hasMoreResults = false

    for (const item of items) {
      if (!item.name.toLowerCase().includes(lowered)) {
        continue
      }

      if (!showAllResults && matches.length >= MAX_RESULTS) {
        hasMoreResults = true
        break
      }

      matches.push(item)
    }

    return {
      filteredItems: matches,
      hasMoreResults,
    }
  }, [items, query, showAllResults])

  return (
    <section aria-labelledby="item-search-heading">
      <h2 id="item-search-heading">Item search</h2>
      <label htmlFor="item-search-input">Search items</label>
      <br />
      <input
        id="item-search-input"
        type="search"
        style={searchInputStyles}
        value={queryInput}
        onChange={(event) => {
          setQueryInput(event.target.value)
          setShowAllResults(false)
        }}
        placeholder="Type an item name"
      />

      <ul style={itemListStyles}>
        {filteredItems.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              style={itemButtonStyles}
              onClick={() => {
                onSelectItem(item)
              }}
            >
              <img
                src={toIconUrl(item.iconId)}
                alt={`${item.name} icon`}
                width={24}
                height={24}
                style={{ borderRadius: '4px' }}
              />
              <span>{item.name}</span>
            </button>
          </li>
        ))}
        {hasMoreResults ? (
          <li style={{ padding: '0.5rem' }}>
            <button
              type="button"
              style={{ width: '100%' }}
              onClick={() => {
                setShowAllResults(true)
              }}
            >
              Load remaining entries
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  )
}
