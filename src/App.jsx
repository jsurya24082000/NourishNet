import React, { useState } from 'react'
import FindPage from './pages/FindPage'
import PipelinePage from './pages/PipelinePage'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

/**
 * Page routing:
 *   'find'      → FindPage, tab='find'
 *   'donate'    → FindPage, tab='donors'
 *   'volunteer' → FindPage, tab='volunteers'
 *   'pipeline'  → PipelinePage
 */
const TAB_MAP = {
  find:      'find',
  donate:    'donors',
  volunteer: 'volunteers',
}

export default function App() {
  const [page, setPage] = useState('find')

  const isFindPage = page !== 'pipeline'
  const findTab    = TAB_MAP[page] || 'find'

  return (
    <div className="app">

      {/* ── TOP BANNER ── */}
      <div className="app-banner">
        <span className="app-banner-text">
          NourishNet · Food Resource Directory — Washington DC · Maryland · Virginia
        </span>
        <span className="app-banner-status">
          <span className="app-banner-dot" aria-hidden="true" />
          DC · MD · VA
        </span>
      </div>

      {/* ── STICKY HEADER ── */}
      <header className="app-header">
        <div className="app-header-inner">

          {/* Logo */}
          <button className="app-logo" onClick={() => setPage('find')} aria-label="NourishNet home">
            <span className="app-logo-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" fill="#0D2B4E"/>
                <path
                  d="M16 7C12.686 7 10 9.686 10 13c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                  fill="white"
                />
              </svg>
            </span>
            <span className="app-logo-text">
              <span className="app-logo-name">NourishNet</span>
              <span className="app-logo-sub">Food Resource Directory</span>
            </span>
          </button>

          {/* Nav */}
          <nav className="app-nav" aria-label="Main navigation">
            <NavBtn active={page === 'find'}      onClick={() => setPage('find')}>Find Food</NavBtn>
            <NavBtn active={page === 'donate'}    onClick={() => setPage('donate')}>Donate</NavBtn>
            <NavBtn active={page === 'volunteer'} onClick={() => setPage('volunteer')}>Volunteer</NavBtn>
          </nav>
        </div>
      </header>

      {/* ── PAGE CONTENT ── */}
      <main className="app-main">
        {isFindPage
          ? (
            <ErrorBoundary>
              <FindPage initialTab={findTab} navigate={setPage} />
            </ErrorBoundary>
          )
          : <div className="app-page-wrap"><PipelinePage /></div>
        }
      </main>

      {/* ── FOOTER ── */}
      <footer className="app-footer">
        <div className="app-footer-inner">
          <div className="app-footer-left">
            <span className="app-footer-name">NourishNet</span>
            <span className="app-footer-tagline">
              Food Resource Directory — Washington DC · Maryland · Virginia
            </span>
            <span className="app-footer-sources">
              Data from DC Open Data, MD Open Data, PG County, Virginia Open Data,
              USDA SNAP, 211 Maryland, UMD Extension
            </span>
          </div>
          <div className="app-footer-right">
            <span className="app-footer-crisis-label">In crisis?</span>
            <a href="tel:211" className="app-footer-crisis-link">Call 211</a>
            <span className="app-footer-crisis-sub">Free · 24/7 food assistance</span>
          </div>
        </div>
      </footer>

    </div>
  )
}

function NavBtn({ active, onClick, children }) {
  return (
    <button
      className={`app-nav-btn ${active ? 'app-nav-btn--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
