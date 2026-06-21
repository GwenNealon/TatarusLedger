import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import type { NormalizedItem } from '../../data/types.ts'

const SEARCH_DEBOUNCE_MS = 180
const MAX_RESULTS = 50

const styles: Record<'searchInput' | 'itemList' | 'itemButton', CSSProperties> =
  {
    searchInput: {
      width: '100%',
      maxWidth: '24rem',
      border: '1px solid #94a3b8',
      borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem',
      fontSize: '1rem',
    },
    itemList: {
      listStyle: 'none',
      margin: '0.75rem 0 0',
      padding: 0,
      maxWidth: '24rem',
      maxHeight: '14rem',
      overflowY: 'auto',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
    },
    itemButton: {
      width: '100%',
      textAlign: 'left',
      border: 0,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem',
      cursor: 'pointer',
    },
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
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(queryInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timeout)
    }
  }, [queryInput])

  const filteredItems: NormalizedItem[] = []
  let hasMoreResults = false

  if (query.length > 0) {
    const lowered = query.toLowerCase()
    const shouldMatchById = /^\d+$/.test(query)

    for (const item of items) {
      if (
        !item.name.toLowerCase().includes(lowered) &&
        !(shouldMatchById && item.id.toString().includes(query))
      ) {
        continue
      }

      if (!showAllResults && filteredItems.length >= MAX_RESULTS) {
        hasMoreResults = true
        break
      }

      filteredItems.push(item)
    }
  }

  const effectiveHighlightedIndex =
    highlightedIndex < filteredItems.length ? highlightedIndex : 0

  return (
    <section aria-labelledby="item-search-heading">
      <h2 id="item-search-heading">Item search</h2>
      <label htmlFor="item-search-input">Search items</label>
      <br />
      <input
        id="item-search-input"
        type="search"
        style={styles.searchInput}
        value={queryInput}
        onChange={(event) => {
          setQueryInput(event.target.value)
          setShowAllResults(false)
          setHighlightedIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            if (filteredItems.length === 0) {
              return
            }

            event.preventDefault()
            setHighlightedIndex((currentIndex) => {
              const boundedIndex =
                currentIndex < filteredItems.length ? currentIndex : 0
              return Math.min(boundedIndex + 1, filteredItems.length - 1)
            })
            return
          }

          if (event.key === 'ArrowUp') {
            if (filteredItems.length === 0) {
              return
            }

            event.preventDefault()
            setHighlightedIndex((currentIndex) => {
              const boundedIndex =
                currentIndex < filteredItems.length ? currentIndex : 0
              return Math.max(boundedIndex - 1, 0)
            })
            return
          }

          if (event.key !== 'Enter') {
            return
          }

          const selectedItem = filteredItems.at(effectiveHighlightedIndex)
          if (selectedItem === undefined) {
            return
          }

          event.preventDefault()
          onSelectItem(selectedItem)
        }}
        placeholder="Type an item name"
      />

      <ul
        style={styles.itemList}
        onMouseLeave={() => {
          setHighlightedIndex(0)
        }}
      >
        {filteredItems.map((item, index) => {
          const iconId = String(item.iconId).padStart(6, '0')
          const iconUrl = `https://xivapi.com/i/${iconId.slice(0, 3)}000/${iconId}.png`
          const isHighlighted = index === effectiveHighlightedIndex

          return (
            <li key={item.id}>
              <button
                type="button"
                style={{
                  ...styles.itemButton,
                  background: isHighlighted ? '#e2e8f0' : '#fff',
                }}
                aria-selected={isHighlighted}
                onMouseEnter={() => {
                  setHighlightedIndex(index)
                }}
                onClick={() => {
                  onSelectItem(item)
                }}
              >
                <img
                  src={iconUrl}
                  alt={`${item.name} icon`}
                  width={24}
                  height={24}
                  style={{ borderRadius: '4px' }}
                />
                <span>{item.name}</span>
              </button>
            </li>
          )
        })}
        {hasMoreResults ? (
          <li style={{ padding: '0.5rem' }}>
            <button
              type="button"
              style={{ width: '100%' }}
              onClick={() => {
                setShowAllResults(true)
                setHighlightedIndex(0)
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
