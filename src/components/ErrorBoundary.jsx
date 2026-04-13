import React from 'react'
import { RESOURCES } from '../data/index.js'
import { timeAgo } from '../utils/search.js'

/**
 * Catches any render error inside FindPage and shows a safe fallback
 * listing all resources — so the app never goes blank.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[NourishNet] Render error caught by boundary:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return <SafeFallback onReset={() => this.setState({ hasError: false, error: null })} />
  }
}

function SafeFallback({ onReset }) {
  const resources = RESOURCES || []

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{
        background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8,
        padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <span>Something went wrong loading the search view. Showing all resources below.</span>
        <button
          onClick={onReset}
          style={{
            background: '#0D2B4E', color: 'white', border: 'none', borderRadius: 6,
            padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}
        >
          Try again
        </button>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>
        All Food Resources — DC · Maryland · Virginia
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {resources.filter(r => r.name).map(r => (
          <div key={r.id} style={{
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
            padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#111827' }}>
              {r.name}
            </div>
            {r.address && (
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                📍 {r.address}{r.city ? `, ${r.city}` : ''}{r.state ? `, ${r.state}` : ''}
              </div>
            )}
            {r.hours && (
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                🕐 {r.hours}
              </div>
            )}
            {r.phone && (
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                📞 <a href={`tel:${r.phone}`} style={{ color: '#2d7a4f' }}>{r.phone}</a>
              </div>
            )}
            {r.website && (
              <a
                href={r.website} target="_blank" rel="noreferrer"
                style={{
                  display: 'inline-block', fontSize: '0.8rem', fontWeight: 600,
                  color: '#0D2B4E', border: '1.5px solid #0D2B4E', borderRadius: 6,
                  padding: '0.3rem 0.75rem', textDecoration: 'none',
                }}
              >
                Visit website →
              </a>
            )}
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem' }}>
              {timeAgo(r.lastScraped)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
