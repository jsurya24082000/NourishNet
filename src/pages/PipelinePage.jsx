import React, { useState } from 'react'
import { RESOURCES, SCRAPE_LOG, UPDATE_FREQUENCY } from '../data/index.js'
import { timeAgo } from '../utils/search.js'
import './PipelinePage.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_SOURCES = [
  { name: 'DC Open Data',          url: 'https://opendata.dc.gov',              type: 'Government API' },
  { name: 'Maryland Open Data',    url: 'https://opendata.maryland.gov',        type: 'Government API' },
  { name: 'PG County CFEC',        url: 'https://pgcfec.org',                   type: 'Nonprofit HTML' },
  { name: 'Virginia Open Data',    url: 'https://data.virginia.gov',            type: 'Government API' },
  { name: 'Capital Area Food Bank',url: 'https://www.capitalareafoodbank.org',  type: 'Nonprofit HTML' },
  { name: 'Maryland Food Bank',    url: 'https://mdfoodbank.org',               type: 'Nonprofit HTML' },
  { name: 'UMD Extension',         url: 'https://extension.umd.edu',            type: 'Nonprofit HTML' },
  { name: 'USDA SNAP Locator',     url: 'https://www.fns.usda.gov/snap/retailer-locator', type: 'Government API' },
  { name: '211 Maryland',          url: 'https://search.211md.org',             type: 'Nonprofit API' },
  { name: 'Feeding America',       url: 'https://map.feedingamerica.org',       type: 'Nonprofit HTML' },
  { name: 'US Census ACS',         url: 'https://data.census.gov',              type: 'Government API' },
]

const CAT_LABEL = {
  food_bank: 'Food Bank', food_pantry: 'Food Pantry', meal_program: 'Meal Program',
  mobile_distribution: 'Mobile', snap_assistance: 'SNAP/EBT', children: 'Children',
  senior: 'Senior', job_training: 'Job Training', social_services: 'Social Services',
  housing: 'Housing', emergency_assistance: 'Emergency', produce: 'Produce',
  medical: 'Medical', legal: 'Legal', education: 'Education', immigration: 'Immigration',
}

const SOURCE_LABEL = {
  dc_open_data:   'DC Open Data',
  md_open_data:   'MD Open Data',
  pg_county_cfec: 'PG County CFEC',
  va_open_data:   'VA Open Data',
  umd_extension:  'UMD Extension',
}

const TYPE_LABEL = {
  government_api: 'Government API',
  nonprofit_html: 'Nonprofit HTML',
  nonprofit_api:  'Nonprofit API',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  })
}

function fmtDuration(startIso, endIso) {
  if (!startIso || !endIso) return '—'
  const secs = Math.round((new Date(endIso) - new Date(startIso)) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [expandedNote, setExpandedNote] = useState(null)
  const ufEntries = Object.entries(UPDATE_FREQUENCY)

  return (
    <div className="pp-root">

      {/* ── Page header ── */}
      <div className="pp-header">
        <h1 className="pp-title">Data Pipeline</h1>
        <p className="pp-subtitle">
          Three tables tracking live food resource data across DC, Maryland, and Virginia.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="pp-stats">
        <StatCard value={RESOURCES.length}      label="Resources in database"  icon="🗂️" />
        <StatCard value={SCRAPE_LOG.length}     label="Scrape runs logged"      icon="🔄" />
        <StatCard value={ufEntries.length}      label="Data sources tracked"    icon="📡" />
      </div>

      {/* ── Architecture explanation ── */}
      <div className="pp-arch">
        <h3 className="pp-arch-title">How the pipeline works</h3>
        <p className="pp-arch-text">
          Data is ingested from public sources into <strong>Table 1 (resources)</strong> — one row per
          food organization, with address, hours, categories, and language support. Every ingestion
          run is logged in <strong>Table 2 (scrape_log)</strong>, capturing records found, records new,
          records updated, and run status so failures are visible and auditable.{' '}
          <strong>Table 3 (update_frequency)</strong> tracks per-source content hashes to detect when
          data actually changes — building real observed intervals over time rather than relying on
          publisher-stated cadences. Government APIs are estimated at monthly; nonprofit HTML pages
          are estimated at weekly with lower confidence, since they update without notice.
        </p>
      </div>

      {/* ── Table 1: resources ── */}
      <section className="pp-section">
        <div className="pp-table-label">
          <span className="pp-table-num">Table 1</span>
          <span className="pp-table-name">resources</span>
          <span className="pp-table-desc">all food resource records</span>
          <span className="pp-row-count">{RESOURCES.length} rows</span>
        </div>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>City</th>
                <th>State</th>
                <th>Categories</th>
                <th>Source</th>
                <th>Last verified</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((r) => (
                <tr key={r.id}>
                  <td className="pp-td-name">{r.name}</td>
                  <td>{r.city}</td>
                  <td>
                    <span className={`pp-state-badge pp-state-badge--${r.state.toLowerCase()}`}>
                      {r.state}
                    </span>
                  </td>
                  <td>
                    <div className="pp-cats">
                      {(r.categories || []).slice(0, 3).map((c) => (
                        <span key={c} className="pp-cat">{CAT_LABEL[c] || c}</span>
                      ))}
                      {(r.categories || []).length > 3 && (
                        <span className="pp-cat pp-cat--more">+{r.categories.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="pp-source">{SOURCE_LABEL[r.source] || r.source}</span>
                  </td>
                  <td className="pp-verified">{timeAgo(r.lastScraped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Table 2: scrape_log ── */}
      <section className="pp-section">
        <div className="pp-table-label">
          <span className="pp-table-num">Table 2</span>
          <span className="pp-table-name">scrape_log</span>
          <span className="pp-table-desc">every scrape run recorded</span>
          <span className="pp-row-count">{SCRAPE_LOG.length} rows</span>
        </div>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Source</th>
                <th>Found</th>
                <th>New</th>
                <th>Updated</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {SCRAPE_LOG.map((run) => (
                <tr key={run.runId}>
                  <td><code className="pp-code">{run.runId}</code></td>
                  <td className="pp-td-time">{fmtDateTime(run.startedAt)}</td>
                  <td>{fmtDuration(run.startedAt, run.finishedAt)}</td>
                  <td>{run.sourceName}</td>
                  <td className="pp-num">{run.recordsFound}</td>
                  <td className="pp-num pp-num--green">{run.recordsNew}</td>
                  <td className="pp-num">{run.recordsUpdated}</td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td>
                    <button
                      className="pp-notes-btn"
                      onClick={() => setExpandedNote(expandedNote === run.runId ? null : run.runId)}
                      aria-expanded={expandedNote === run.runId}
                    >
                      {expandedNote === run.runId ? 'Hide ▲' : 'Show ▼'}
                    </button>
                    {expandedNote === run.runId && (
                      <p className="pp-notes-text">{run.notes}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Table 3: update_frequency ── */}
      <section className="pp-section">
        <div className="pp-table-label">
          <span className="pp-table-num">Table 3</span>
          <span className="pp-table-name">update_frequency</span>
          <span className="pp-table-desc">per-source change tracking</span>
          <span className="pp-row-count">{ufEntries.length} rows</span>
        </div>
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr>
                <th>Source ID</th>
                <th>Source name</th>
                <th>Type</th>
                <th>Est. frequency</th>
                <th>Last changed</th>
                <th>Times changed</th>
                <th>Confidence</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {ufEntries.map(([id, src]) => {
                // Find the most recent scrape run for this source
                const runs = SCRAPE_LOG.filter((r) => r.source === id)
                const lastRun = runs.length
                  ? runs.reduce((a, b) => (a.finishedAt > b.finishedAt ? a : b))
                  : null
                const timesChanged = runs.reduce((sum, r) => sum + (r.recordsNew + r.recordsUpdated), 0)

                return (
                  <tr key={id}>
                    <td><code className="pp-code">{id}</code></td>
                    <td>
                      <a href={src.url} target="_blank" rel="noreferrer" className="pp-link">
                        {src.sourceName}
                      </a>
                    </td>
                    <td>
                      <span className={`pp-type-badge pp-type-badge--${src.type}`}>
                        {TYPE_LABEL[src.type] || src.type}
                      </span>
                    </td>
                    <td>{src.estimatedFrequency}</td>
                    <td className="pp-td-time">
                      {lastRun ? fmtDateTime(lastRun.finishedAt) : '—'}
                    </td>
                    <td className="pp-num">{timesChanged}</td>
                    <td><ConfidenceBadge confidence={src.confidence} /></td>
                    <td>
                      <button
                        className="pp-notes-btn"
                        onClick={() => setExpandedNote(expandedNote === id ? null : id)}
                        aria-expanded={expandedNote === id}
                      >
                        {expandedNote === id ? 'Hide ▲' : 'Show ▼'}
                      </button>
                      {expandedNote === id && (
                        <p className="pp-notes-text">{src.notes}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Data sources ── */}
      <section className="pp-section">
        <h2 className="pp-section-title">Data Sources</h2>
        <p className="pp-section-sub">
          All sources consulted during initial data collection and pipeline design.
        </p>
        <div className="pp-sources-grid">
          {DATA_SOURCES.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="pp-source-card"
            >
              <span className="pp-source-name">{s.name}</span>
              <span className="pp-source-type">{s.type}</span>
              <span className="pp-source-url">{s.url.replace('https://', '')}</span>
            </a>
          ))}
        </div>
      </section>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }) {
  return (
    <div className="pp-stat">
      <span className="pp-stat-icon">{icon}</span>
      <span className="pp-stat-value">{value}</span>
      <span className="pp-stat-label">{label}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    success:        { cls: 'pp-status--green',  label: 'success' },
    no_new_records: { cls: 'pp-status--gray',   label: 'no new records' },
    error:          { cls: 'pp-status--red',    label: 'error' },
    partial:        { cls: 'pp-status--orange', label: 'partial' },
  }
  const { cls, label } = map[status] || { cls: 'pp-status--gray', label: status }
  return <span className={`pp-status ${cls}`}>{label}</span>
}

function ConfidenceBadge({ confidence }) {
  const map = {
    high:      { cls: 'pp-conf--green',  label: 'High' },
    medium:    { cls: 'pp-conf--orange', label: 'Medium' },
    low:       { cls: 'pp-conf--gray',   label: 'Heuristic' },
    heuristic: { cls: 'pp-conf--gray',   label: 'Heuristic' },
  }
  const { cls, label } = map[confidence] || { cls: 'pp-conf--gray', label: confidence }
  return <span className={`pp-conf ${cls}`}>{label}</span>
}
