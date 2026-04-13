import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { RESOURCES } from '../data/index.js'
import { parseQuery, scoreResource, isOpen, timeAgo } from '../utils/search.js'
import './FindPage.css'

// ── Leaflet icon fix (local assets via Vite, no CDN) ─────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
})

// ── Map pan helper ────────────────────────────────────────────────────────────
function MapPanner({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 0.8 })
  }, [target, map])
  return null
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NEED_PILLS = [
  { value: '',                   label: '🍽️ Any food' },
  { value: 'meal_program',       label: '🍲 Hot meals' },
  { value: 'food_pantry',        label: '🛒 Groceries' },
  { value: 'children',           label: '🍼 Baby/infant' },
  { value: 'emergency_assistance', label: '🚨 Emergency' },
  { value: 'snap_assistance',    label: '💳 SNAP/EBT' },
]

const DAYS = ['Any', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TABS = ['find', 'donors', 'volunteers']

const CAT_LABEL = {
  food_bank: 'Food Bank', food_pantry: 'Food Pantry', meal_program: 'Meal Program',
  mobile_distribution: 'Mobile', snap_assistance: 'SNAP/EBT', children: 'Children',
  senior: 'Senior', job_training: 'Job Training', social_services: 'Social Services',
  housing: 'Housing', emergency_assistance: 'Emergency', produce: 'Produce',
  medical: 'Medical', legal: 'Legal', education: 'Education', immigration: 'Immigration',
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FindPage({ navigate, initialTab = 'find' }) {
  // Intake form state
  const [needType, setNeedType]   = useState('')
  const [zip, setZip]             = useState('')
  const [state, setState]         = useState('Any')
  const [lang, setLang]           = useState('Any')
  const [noID, setNoID]           = useState('Any')
  const [day, setDay]             = useState('Any')
  const [freeText, setFreeText]   = useState('')

  // Derive active tab directly from initialTab prop — no separate state needed.
  // App passes a new initialTab value when nav buttons are clicked.
  const safeTab = (initialTab === 'donors' || initialTab === 'volunteers') ? initialTab : 'find'

  // Results state — pre-show results for donate/volunteer tabs immediately
  const [searched, setSearched]   = useState(safeTab !== 'find')
  const [activeTab, setActiveTab] = useState(safeTab)
  const [selected, setSelected]   = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const listRef = useRef(null)

  // When parent nav changes initialTab, sync without remounting
  useEffect(() => {
    const t = (initialTab === 'donors' || initialTab === 'volunteers') ? initialTab : 'find'
    setActiveTab(t)
    if (t !== 'find') setSearched(true)
  }, [initialTab])

  const handleSearch = useCallback(() => {
    setSearched(true)
    setSelected(null)
    setDrawerOpen(false)
  }, [])

  const handleSelect = useCallback((r) => {
    setSelected(r)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setTimeout(() => setSelected(null), 300)
  }, [])

  // Build scored + filtered results
  const results = useMemo(() => {
    if (!searched) return []

    const parsed = parseQuery(freeText)
    // Merge pill-selected need type into parsed cats
    if (needType && !parsed.cats.includes(needType)) parsed.cats.push(needType)
    if (lang !== 'Any') parsed.lang = lang
    if (noID === 'no_id') parsed.noID = true
    if (day !== 'Any') parsed.day = day

    return RESOURCES
      .filter((r) => {
        if (state !== 'Any' && r.state !== state) return false
        return true
      })
      .map((r) => ({ ...r, _score: scoreResource(r, { ...parsed, zip, freeText }) }))
      .sort((a, b) => b._score - a._score)
  }, [searched, needType, zip, state, lang, noID, day, freeText])

  // Donor / volunteer filtered lists
  const donorList = useMemo(() => RESOURCES.filter((r) => r.acceptsDonations), [])
  const volunteerList = useMemo(() => RESOURCES.filter((r) => r.needsVolunteers), [])

  // Split display list: full-data records first, link-only below
  const rawList = activeTab === 'donors' ? donorList
    : activeTab === 'volunteers' ? volunteerList
    : results

  const fullRecords = rawList.filter(r => r.dataQuality !== 'link_only')
  const linkOnlyRecords = rawList.filter(r => r.dataQuality === 'link_only')

  return (
    <div className="fp-root">
      {/* ── HERO ── */}
      <section className="fp-hero">
        <span className="fp-badge">DC · Maryland · Virginia</span>
        <h1 className="fp-h1">Find the right food resource for your situation.</h1>
        <p className="fp-sub">Tell us what you need — we'll find and rank the best matches near you.</p>

        {/* ── INTAKE CARD ── */}
        <div className="fp-card">
          {/* Need type pills */}
          <div className="fp-pills">
            {NEED_PILLS.map((p) => (
              <button
                key={p.value}
                className={`fp-pill ${needType === p.value ? 'fp-pill--active' : ''}`}
                onClick={() => setNeedType(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dropdowns grid */}
          <div className="fp-grid">
            <input
              className="fp-input"
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
              aria-label="ZIP code"
            />
            <select className="fp-select" value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
              <option value="Any">Any state</option>
              <option value="DC">DC</option>
              <option value="MD">Maryland</option>
              <option value="VA">Virginia</option>
            </select>
            <select className="fp-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
              <option value="Any">Any language</option>
              <option value="Spanish">Spanish</option>
              <option value="Amharic">Amharic</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
            </select>
            <select className="fp-select" value={noID} onChange={(e) => setNoID(e.target.value)} aria-label="ID requirement">
              <option value="Any">Any ID policy</option>
              <option value="no_id">No ID available</option>
            </select>
            <select className="fp-select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day available">
              {DAYS.map((d) => <option key={d} value={d}>{d === 'Any' ? 'Any day' : d}</option>)}
            </select>
          </div>

          {/* Free text */}
          <input
            className="fp-input fp-input--full"
            type="text"
            placeholder='Anything specific? e.g. "chicken", "rice", "halal", "baby formula", "Saturday lunch"'
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            aria-label="Specific needs"
          />

          {/* Search button */}
          <button className="fp-search-btn" onClick={handleSearch}>
            Find matching resources
          </button>

          {/* Tabs */}
          <div className="fp-tabs">
            {[['find','🔍 Find Food'],['donors','🤝 Donate'],['volunteers','🌱 Volunteer']].map(([key, label]) => (
              <button
                key={key}
                className={`fp-tab ${activeTab === key ? 'fp-tab--active' : ''}`}
                onClick={() => { setActiveTab(key); if (key !== 'find') setSearched(true) }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESULTS ── */}
      {searched && (
        <div className="fp-results">
          {/* Left: list */}
          <div className="fp-list" ref={listRef}>
            {activeTab === 'find' && (
              <p className="fp-count">
                {fullRecords.length} resource{fullRecords.length !== 1 ? 's' : ''} found
                {freeText && <span className="fp-query-label"> for "{freeText}"</span>}
              </p>
            )}
            {activeTab === 'donors' && <p className="fp-count">{fullRecords.length + linkOnlyRecords.length} organizations accepting donations</p>}
            {activeTab === 'volunteers' && <p className="fp-count">{fullRecords.length + linkOnlyRecords.length} organizations seeking volunteers</p>}

            {fullRecords.length === 0 && linkOnlyRecords.length === 0 && (
              <div className="fp-empty">No results match your filters. Try broadening your search.</div>
            )}

            {fullRecords.map((r, i) => (
              <ResourceCard
                key={r.id}
                r={r}
                rank={activeTab === 'find' ? i : null}
                isSelected={selected?.id === r.id}
                onClick={() => handleSelect(r)}
                tab={activeTab}
              />
            ))}

            {linkOnlyRecords.length > 0 && (
              <>
                <div className="fp-section-divider">
                  More resources (website only)
                </div>
                {linkOnlyRecords.map((r) => (
                  <ResourceCard
                    key={r.id}
                    r={r}
                    rank={null}
                    isSelected={selected?.id === r.id}
                    onClick={() => handleSelect(r)}
                    tab={activeTab}
                  />
                ))}
              </>
            )}
          </div>

          {/* Right: map */}
          <div className="fp-map-wrap">
            <MapContainer center={[38.92, -77.03]} zoom={9} className="fp-map" style={{ height: '600px' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {selected && selected.lat && selected.lng && <MapPanner target={selected} />}
              {fullRecords.filter(r => r.lat && r.lng).map((r) => (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  eventHandlers={{ click: () => handleSelect(r) }}
                >
                  <Popup>
                    <strong>{r.name}</strong><br />
                    {r.address}, {r.city}<br />
                    <button
                      style={{ color: '#2d7a4f', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}
                      onClick={() => handleSelect(r)}
                    >
                      View details →
                    </button>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map legend */}
            <div className="fp-legend">
              <span className="fp-legend-dot fp-legend-dot--red" /> Hot meals
              <span className="fp-legend-dot fp-legend-dot--green" /> Food pantry
              <span className="fp-legend-dot fp-legend-dot--darkgreen" /> Food bank
              <span className="fp-legend-dot fp-legend-dot--blue" /> Other
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL DRAWER ── */}
      <DetailDrawer r={selected} open={drawerOpen} onClose={closeDrawer} />
      {drawerOpen && <div className="fp-overlay" onClick={closeDrawer} />}
    </div>
  )
}

// ── ResourceCard ──────────────────────────────────────────────────────────────
function ResourceCard({ r, rank, isSelected, onClick, tab }) {
  const isLinkOnly = r.dataQuality === 'link_only'
  const openToday = isLinkOnly ? null : isOpen(r.hours)
  const cats = r.categories || []

  let rankBadge = null
  if (!isLinkOnly) {
    if (tab === 'find' && rank !== null) {
      if (rank === 0)      rankBadge = { label: 'Top match', cls: 'fp-rank--top' }
      else if (rank === 1) rankBadge = { label: '#2 match',  cls: 'fp-rank--second' }
      else if (openToday)  rankBadge = { label: 'Open today', cls: 'fp-rank--open' }
      else if (openToday === false) rankBadge = { label: 'Closed today', cls: 'fp-rank--closed' }
    } else if (openToday === true) {
      rankBadge = { label: 'Open today', cls: 'fp-rank--open' }
    } else if (openToday === false) {
      rankBadge = { label: 'Closed today', cls: 'fp-rank--closed' }
    }
  }

  const hasScore = tab === 'find' && r._score > 0

  // Link-only card — minimal, just name + description + website button
  if (isLinkOnly) {
    return (
      <div
        className={`fp-rcard fp-rcard--link-only ${isSelected ? 'fp-rcard--selected' : ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        aria-label={`View details for ${r.name}`}
      >
        <h3 className="fp-rcard-name">{r.name}</h3>
        {r.description && (
          <p className="fp-rcard-meta" style={{ marginBottom: '0.5rem' }}>{r.description}</p>
        )}
        <div className="fp-rcard-tags" style={{ marginBottom: '0.5rem' }}>
          {cats.slice(0, 3).map((c) => (
            <span key={c} className="fp-tag">{CAT_LABEL[c] || c}</span>
          ))}
        </div>
        {r.website && (
          <a
            href={r.website} target="_blank" rel="noreferrer"
            className="fp-rcard-website-btn"
            onClick={e => e.stopPropagation()}
          >
            🌐 Visit website →
          </a>
        )}
        <p className="fp-verified">{timeAgo(r.lastScraped)}</p>
      </div>
    )
  }

  return (
    <div
      className={`fp-rcard ${isSelected ? 'fp-rcard--selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`View details for ${r.name}`}
    >
      <div className="fp-rcard-top">
        <h3 className="fp-rcard-name">{r.name}</h3>
        {rankBadge && <span className={`fp-rank ${rankBadge.cls}`}>{rankBadge.label}</span>}
      </div>

      {hasScore && (
        <p className="fp-match-line">✓ Matches your criteria</p>
      )}

      {r.address && <p className="fp-rcard-meta">📍 {r.address}{r.city ? `, ${r.city}` : ''}{r.state ? `, ${r.state}` : ''} {r.zip || ''}</p>}
      {r.hours   && <p className="fp-rcard-meta">🕐 {r.hours}</p>}
      {r.phone   && <p className="fp-rcard-meta">📞 {r.phone}</p>}

      <div className="fp-rcard-tags">
        {cats.slice(0, 4).map((c) => (
          <span key={c} className="fp-tag">{CAT_LABEL[c] || c}</span>
        ))}
      </div>

      <div className="fp-rcard-badges">
        {r.acceptsDonations && <span className="fp-badge-sm fp-badge-sm--orange">Accepts donations</span>}
        {r.needsVolunteers  && <span className="fp-badge-sm fp-badge-sm--green">Needs volunteers</span>}
        {/no id|no documentation|self.declar/i.test(r.requirements || '') && (
          <span className="fp-badge-sm fp-badge-sm--blue">No ID required</span>
        )}
        {(r.languages || []).includes('Spanish') && (
          <span className="fp-badge-sm fp-badge-sm--purple">Español</span>
        )}
      </div>

      <p className="fp-verified">{timeAgo(r.lastScraped)}</p>
    </div>
  )
}

// ── DetailDrawer ──────────────────────────────────────────────────────────────
function DetailDrawer({ r, open, onClose }) {
  if (!r) return null
  const openToday = isOpen(r.hours)
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address + ', ' + r.city + ', ' + r.state + ' ' + r.zip)}`

  return (
    <aside className={`fp-drawer ${open ? 'fp-drawer--open' : ''}`} aria-label="Resource details">
      <div className="fp-drawer-header">
        <h2 className="fp-drawer-title">{r.name}</h2>
        <button className="fp-drawer-close" onClick={onClose} aria-label="Close details">✕</button>
      </div>

      <div className="fp-drawer-body">
        {openToday === true  && <span className="fp-rank fp-rank--open" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Open today</span>}
        {openToday === false && <span className="fp-rank fp-rank--closed" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>Closed today</span>}

        <p className="fp-drawer-desc">{r.description}</p>

        <div className="fp-drawer-section">
          <div className="fp-drawer-row">📍 <span>{r.address}, {r.city}, {r.state} {r.zip}</span></div>
          <div className="fp-drawer-row">🕐 <span>{r.hours}</span></div>
          <div className="fp-drawer-row">📞 <span>{r.phone}</span></div>
        </div>

        {r.requirements && (
          <div className="fp-drawer-section">
            <h4 className="fp-drawer-label">Requirements</h4>
            <p className="fp-drawer-text">{r.requirements}</p>
          </div>
        )}

        {(r.languages || []).length > 0 && (
          <div className="fp-drawer-section">
            <h4 className="fp-drawer-label">Languages</h4>
            <div className="fp-rcard-tags">
              {r.languages.map((l) => <span key={l} className="fp-tag">{l}</span>)}
            </div>
          </div>
        )}

        {(r.categories || []).length > 0 && (
          <div className="fp-drawer-section">
            <h4 className="fp-drawer-label">Services</h4>
            <div className="fp-rcard-tags">
              {r.categories.map((c) => <span key={c} className="fp-tag">{CAT_LABEL[c] || c}</span>)}
            </div>
          </div>
        )}

        {r.acceptsDonations && (r.donationNeeds || []).length > 0 && (
          <div className="fp-drawer-section">
            <h4 className="fp-drawer-label">Donation needs</h4>
            <ul className="fp-drawer-list">
              {r.donationNeeds.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        )}

        {r.needsVolunteers && (r.volunteerNeeds || []).length > 0 && (
          <div className="fp-drawer-section">
            <h4 className="fp-drawer-label">Volunteer opportunities</h4>
            <ul className="fp-drawer-list">
              {r.volunteerNeeds.map((v) => <li key={v}>{v}</li>)}
            </ul>
          </div>
        )}

        <p className="fp-verified" style={{ marginTop: '1rem' }}>{timeAgo(r.lastScraped)}</p>

        {/* Action buttons */}
        <div className="fp-drawer-actions">
          <a href={`tel:${r.phone}`} className="fp-action-btn fp-action-btn--green">
            📞 Call now
          </a>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="fp-action-btn fp-action-btn--outline">
            🗺️ Get directions
          </a>
          <a href={r.website} target="_blank" rel="noreferrer" className="fp-action-btn fp-action-btn--outline">
            🌐 Visit website
          </a>
        </div>
      </div>
    </aside>
  )
}
