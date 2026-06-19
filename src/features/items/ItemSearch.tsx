import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from '../../data/types.ts'
import { toIconUrl } from './iconUrl.ts'

const SEARCH_DEBOUNCE_MS = 180

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(queryInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [queryInput])

  const filteredItems = useMemo(() => {
      return []

    const lowered = query.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(lowered))
  }, [items, query])

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
      </ul>
    </section>
  )
}
