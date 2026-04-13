/**
 * scrape.js — NourishNet live data pipeline
 *
 * Fetches real food resource data from three sources, merges into
 * src/data/resources.json, and updates scrape_log.json and
 * update_frequency.json with observed run metadata.
 *
 * Usage: node scrape.js
 */

import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, 'src', 'data')

// ── File helpers ──────────────────────────────────────────────────────────────

function readJSON(filename) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8'))
  } catch {
    return filename.endsWith('.json') && filename.includes('log') ? [] : {}
  }
}

function writeJSON(filename, data) {
  writeFileSync(
    join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    'utf8'
  )
}

function md5(str) {
  return createHash('md5').update(str).digest('hex')
}

function nowISO() {
  return new Date().toISOString()
}

// ── ID generation ─────────────────────────────────────────────────────────────
// Stable ID from name + address so re-runs don't create duplicates
function stableId(name, address) {
  return 'scraped_' + md5(`${(name || '').toLowerCase().trim()}|${(address || '').toLowerCase().trim()}`).slice(0, 12)
}

// ── Fetch with timeout ────────────────────────────────────────────────────────

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NourishNet-Scraper/1.0 (food resource directory; contact: nourishnet@example.org)' },
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } finally {
    clearTimeout(timer)
  }
}

// ── Normalise helpers ─────────────────────────────────────────────────────────

function cleanPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`
  return raw.trim() || null
}

function cleanUrl(raw) {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith('http')) return s
  return 'https://' + s
}

function inferState(address, city) {
  const text = `${address || ''} ${city || ''}`.toUpperCase()
  if (/\bDC\b|WASHINGTON/.test(text)) return 'DC'
  if (/\bMD\b|MARYLAND/.test(text)) return 'MD'
  if (/\bVA\b|VIRGINIA/.test(text)) return 'VA'
  return 'DC' // default for CAFB data which is DC-area
}

function extractZip(text) {
  const m = (text || '').match(/\b(\d{5})(?:-\d{4})?\b/)
  return m ? m[1] : null
}

// ── SOURCE 1: DC Open Data — CAFB Emergency Food Providers ───────────────────
// Tries multiple known endpoints in order, uses first one that returns records.

async function scrapeDCOpenData() {
  const sourceId = 'dc_open_data_cafb'

  const CANDIDATE_URLS = [
    // Primary: DC DCGIS Health layer (more reliable)
    'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Health_WebMercator/MapServer/67/query?where=1%3D1&outFields=*&f=json&resultRecordCount=200',
    // Fallback: original CAFB FeatureServer
    'https://services.arcgis.com/ORpvigFPJUhb8RDF/arcgis/rest/services/Capital_Area_Food_Bank_Emergency_Food_Providers/FeatureServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=200',
  ]

  console.log('\n📡 SOURCE 1 — DC Open Data (CAFB Emergency Food Providers)')

  const startedAt = nowISO()
  let records = []
  let rawHash = null
  let error = null
  let usedUrl = CANDIDATE_URLS[0]

  for (const url of CANDIDATE_URLS) {
    console.log(`   Trying: ${url.slice(0, 80)}…`)
    try {
      const { ok, status, text } = await fetchWithTimeout(url, 20000)
      if (!ok) { console.log(`   ✗ HTTP ${status} — trying next`); continue }

      const json = JSON.parse(text)

      // ArcGIS error response
      if (json.error) { console.log(`   ✗ ArcGIS error: ${json.error.message} — trying next`); continue }

      const features = json.features || []
      if (features.length === 0) { console.log(`   ○ 0 features returned — trying next`); continue }

      console.log(`   ✓ Got ${features.length} features from this endpoint`)
      rawHash  = md5(text)
      usedUrl  = url

      for (const f of features) {
        const a = f.attributes || {}
        const name    = a.NAME || a.SITE_NAME || a.ORG_NAME || a.ORGANIZATION || a.PROVIDER_NAME || null
        const address = a.ADDRESS || a.STREET_ADDRESS || a.ADDR || a.FULL_ADDRESS || null
        const city    = a.CITY || a.MUNICIPALITY || null
        const zip     = a.ZIP || a.ZIPCODE || a.ZIP_CODE || extractZip(address) || null
        const phone   = cleanPhone(a.PHONE || a.PHONE_NUMBER || a.CONTACT_PHONE || null)
        const website = cleanUrl(a.WEBSITE || a.URL || a.WEB || null)
        const hours   = a.HOURS || a.HOURS_OF_OPERATION || a.SERVICE_HOURS || null
        const lat     = f.geometry?.y ?? a.LATITUDE ?? a.LAT ?? null
        const lng     = f.geometry?.x ?? a.LONGITUDE ?? a.LNG ?? null

        if (!name) continue

        records.push({
          id:           stableId(name, address),
          name:         name.trim(),
          address:      (address || '').trim(),
          city:         (city || '').trim(),
          state:        inferState(address, city),
          zip,
          phone,
          website,
          hours:        hours ? hours.trim() : null,
          description:  a.DESCRIPTION || a.NOTES || 'Emergency food provider in the Capital Area Food Bank network.',
          categories:   ['food_pantry', 'emergency_assistance'],
          languages:    ['English'],
          requirements: a.REQUIREMENTS || a.ELIGIBILITY || 'Contact organization for eligibility requirements.',
          lat:          lat != null ? parseFloat(lat) : null,
          lng:          lng != null ? parseFloat(lng) : null,
          acceptsDonations: false,
          needsVolunteers:  false,
          donationNeeds:    [],
          volunteerNeeds:   [],
          source:       sourceId,
          lastScraped:  startedAt,
        })
      }

      console.log(`   ✓ Parsed ${records.length} valid records`)
      break // success — stop trying fallbacks

    } catch (err) {
      console.log(`   ✗ Error: ${err.message} — trying next`)
      error = err.message
    }
  }

  if (records.length === 0 && !error) {
    error = 'All endpoints returned 0 features'
    console.log(`   ✗ ${error}`)
  }

  return { sourceId, url: usedUrl, startedAt, finishedAt: nowISO(), records, rawHash, error: records.length > 0 ? null : error }
}

// ── SOURCE 2: PG County CFEC food pantry listings ────────────────────────────

async function scrapePGCFEC() {
  const sourceId = 'pgcfec'
  const url = 'https://pgcfec.org/resources/find-food-food-pantry-listings/'

  console.log('\n📡 SOURCE 2 — PG County CFEC (Food Pantry Listings)')
  console.log(`   ${url}`)

  const startedAt = nowISO()
  let records = []
  let rawHash = null
  let error = null

  try {
    const { ok, status, text } = await fetchWithTimeout(url)
    if (!ok) throw new Error(`HTTP ${status}`)

    rawHash = md5(text)
    const $ = cheerio.load(text)
    console.log(`   ✓ Fetched HTML (${Math.round(text.length / 1024)}KB)`)

    // Try multiple selectors — CFEC uses a Drupal views layout
    const candidates = []

    // Strategy A: views rows
    $('.views-row, .view-row').each((_, el) => {
      candidates.push($(el).text())
    })

    // Strategy B: article / entry blocks
    if (candidates.length === 0) {
      $('article, .entry, .resource-item, .pantry-item').each((_, el) => {
        candidates.push($(el).text())
      })
    }

    // Strategy C: list items with enough text
    if (candidates.length === 0) {
      $('li').each((_, el) => {
        const t = $(el).text().trim()
        if (t.length > 40) candidates.push(t)
      })
    }

    // Strategy D: table rows
    if (candidates.length === 0) {
      $('table tr').each((_, el) => {
        const t = $(el).text().trim()
        if (t.length > 40) candidates.push(t)
      })
    }

    // Strategy E: paragraphs that look like org entries (contain phone pattern)
    if (candidates.length === 0) {
      $('p, div').each((_, el) => {
        const t = $(el).text().trim()
        if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(t) && t.length > 30) {
          candidates.push(t)
        }
      })
    }

    console.log(`   ✓ Found ${candidates.length} candidate blocks`)

    for (const block of candidates) {
      const lines = block.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) continue

      // First non-empty line is usually the org name
      const name = lines[0].replace(/^\d+\.\s*/, '').trim()
      if (!name || name.length < 4) continue

      // Extract phone
      const phoneMatch = block.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)
      const phone = phoneMatch ? cleanPhone(phoneMatch[0]) : null

      // Extract address — line containing a number followed by street words
      const addrLine = lines.find(l =>
        /^\d+\s+\w/.test(l) && !/^\d{4}$/.test(l.trim())
      )

      // Extract ZIP
      const zip = extractZip(block)

      // Extract hours — line containing am/pm or day abbreviations
      const hoursLine = lines.find(l =>
        /\b(mon|tue|wed|thu|fri|sat|sun|am|pm|open|closed)\b/i.test(l) && l !== name
      )

      if (!name) continue

      records.push({
        id:           stableId(name, addrLine),
        name,
        address:      addrLine || '',
        city:         'Prince George\'s County',
        state:        'MD',
        zip:          zip,
        phone,
        website:      null,
        hours:        hoursLine || null,
        description:  `Food pantry serving Prince George's County residents. Listed in the CFEC member directory.`,
        categories:   ['food_pantry'],
        languages:    ['English', 'Spanish'],
        requirements: 'Prince George\'s County residents. Contact organization for specific requirements.',
        lat:          null,
        lng:          null,
        acceptsDonations: true,
        needsVolunteers:  true,
        donationNeeds:    ['non-perishable food', 'monetary donations'],
        volunteerNeeds:   ['food sorting', 'pantry shifts'],
        source:       sourceId,
        lastScraped:  startedAt,
      })
    }

    // Deduplicate by name
    const seen = new Set()
    records = records.filter(r => {
      const key = r.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`   ✓ Parsed ${records.length} unique records`)
  } catch (err) {
    error = err.message
    console.log(`   ✗ Error: ${err.message}`)
  }

  return { sourceId, url, startedAt, finishedAt: nowISO(), records, rawHash, error }
}

// ── SOURCE 3: UMD Extension food access resources ────────────────────────────

async function scrapeUMDExtension() {
  const sourceId = 'umd_extension'
  const url = 'https://extension.umd.edu/resource/food-access-resources/'

  console.log('\n📡 SOURCE 3 — UMD Extension (Food Access Resources)')
  console.log(`   ${url}`)

  const startedAt = nowISO()
  let records = []
  let rawHash = null
  let error = null

  const FOOD_KEYWORDS = /food|pantry|hunger|meal|nutrition|snap|ebt|bank|feed|nourish/i

  try {
    const { ok, status, text } = await fetchWithTimeout(url)
    if (!ok) throw new Error(`HTTP ${status}`)

    rawHash = md5(text)
    const $ = cheerio.load(text)
    console.log(`   ✓ Fetched HTML (${Math.round(text.length / 1024)}KB)`)

    const links = new Map() // href → label

    $('a[href]').each((_, el) => {
      const href  = $(el).attr('href') || ''
      const label = $(el).text().trim()

      if (!label || label.length < 5) return
      if (!FOOD_KEYWORDS.test(label) && !FOOD_KEYWORDS.test(href)) return

      // Skip nav, footer, social links
      if (/twitter|facebook|instagram|linkedin|mailto|tel:|#/.test(href)) return
      if (/nav|menu|footer|header|skip|login|search/i.test(href)) return

      const fullUrl = href.startsWith('http') ? href
        : href.startsWith('/') ? `https://extension.umd.edu${href}`
        : null

      if (fullUrl && !links.has(fullUrl)) {
        links.set(fullUrl, label)
      }
    })

    console.log(`   ✓ Found ${links.size} food-related links`)

    for (const [href, label] of links) {
      records.push({
        id:           stableId(label, href),
        name:         label,
        address:      '',
        city:         '',
        state:        'MD',
        zip:          null,
        phone:        null,
        website:      href,
        hours:        null,
        description:  `Food access resource listed by UMD Extension. Visit the website for full details.`,
        categories:   ['food_pantry'],
        languages:    ['English'],
        requirements: 'See website for eligibility and requirements.',
        lat:          null,
        lng:          null,
        acceptsDonations: false,
        needsVolunteers:  false,
        donationNeeds:    [],
        volunteerNeeds:   [],
        source:       sourceId,
        lastScraped:  startedAt,
      })
    }

    console.log(`   ✓ Parsed ${records.length} resource links`)
  } catch (err) {
    error = err.message
    console.log(`   ✗ Error: ${err.message}`)
  }

  return { sourceId, url, startedAt, finishedAt: nowISO(), records, rawHash, error }
}

// ── SOURCE 4: Maryland Food Bank — find-food page ────────────────────────────

async function scrapeMDFoodBank() {
  const sourceId = 'md_food_bank'
  const url = 'https://mdfoodbank.org/find-food/'

  console.log('\n📡 SOURCE 4 — Maryland Food Bank (Find Food)')
  console.log(`   ${url}`)

  const startedAt = nowISO()
  let records = []
  let rawHash = null
  let error = null

  try {
    const { ok, status, text } = await fetchWithTimeout(url, 20000)
    if (!ok) throw new Error(`HTTP ${status}`)

    rawHash = md5(text)
    const $ = cheerio.load(text)
    console.log(`   ✓ Fetched HTML (${Math.round(text.length / 1024)}KB)`)

    // MFB uses a partner agency locator — extract any listed pantry entries
    const candidates = []

    // Try structured location cards first
    $('.location, .agency, .pantry, .partner, .find-food-result, .result-item').each((_, el) => {
      candidates.push({ el: $(el), text: $(el).text() })
    })

    // Fallback: any block with a phone number
    if (candidates.length === 0) {
      $('div, article, section').each((_, el) => {
        const t = $(el).text().trim()
        if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(t) && t.length > 40 && t.length < 800) {
          candidates.push({ el: $(el), text: t })
        }
      })
    }

    console.log(`   ✓ Found ${candidates.length} candidate blocks`)

    for (const { el, text: block } of candidates) {
      const lines = block.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) continue

      const name = lines[0].replace(/^\d+\.\s*/, '').trim()
      if (!name || name.length < 4) continue

      const phoneMatch = block.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)
      const phone = phoneMatch ? cleanPhone(phoneMatch[0]) : null
      const addrLine = lines.find(l => /^\d+\s+\w/.test(l))
      const zip = extractZip(block)
      const hoursLine = lines.find(l =>
        /\b(mon|tue|wed|thu|fri|sat|sun|am|pm|open|closed)\b/i.test(l) && l !== name
      )
      const website = el.find('a[href]').first().attr('href') || null

      records.push({
        id:           stableId(name, addrLine),
        name,
        address:      addrLine || '',
        city:         '',
        state:        'MD',
        zip,
        phone,
        website:      cleanUrl(website),
        hours:        hoursLine || null,
        description:  'Food pantry partner of the Maryland Food Bank.',
        categories:   ['food_pantry'],
        languages:    ['English'],
        requirements: 'Contact organization for eligibility requirements.',
        lat:          null,
        lng:          null,
        acceptsDonations: true,
        needsVolunteers:  true,
        donationNeeds:    ['non-perishable food', 'monetary donations'],
        volunteerNeeds:   ['food sorting', 'pantry shifts'],
        source:       sourceId,
        lastScraped:  startedAt,
      })
    }

    // Deduplicate
    const seen = new Set()
    records = records.filter(r => {
      const key = r.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`   ✓ Parsed ${records.length} unique records`)
  } catch (err) {
    error = err.message
    console.log(`   ✗ Error: ${err.message}`)
  }

  return { sourceId, url, startedAt, finishedAt: nowISO(), records, rawHash, error }
}

// ── SOURCE 5: 211 Maryland — food pantry search ───────────────────────────────

async function scrape211Maryland() {
  const sourceId = '211_maryland'
  const url = 'https://search.211md.org/search?query=food+pantry&query_label=food+pantry&query_type=text'

  console.log('\n📡 SOURCE 5 — 211 Maryland (Food Pantry Search)')
  console.log(`   ${url}`)

  const startedAt = nowISO()
  let records = []
  let rawHash = null
  let error = null

  try {
    const { ok, status, text } = await fetchWithTimeout(url, 20000)
    if (!ok) throw new Error(`HTTP ${status}`)

    rawHash = md5(text)
    const $ = cheerio.load(text)
    console.log(`   ✓ Fetched HTML (${Math.round(text.length / 1024)}KB)`)

    // 211 MD uses a React-rendered results page — try to extract from JSON-LD or
    // pre-rendered HTML result cards
    const candidates = []

    // Strategy A: result cards
    $('.result, .search-result, .listing, .agency-result, [class*="result"]').each((_, el) => {
      const t = $(el).text().trim()
      if (t.length > 30) candidates.push({ el: $(el), text: t })
    })

    // Strategy B: JSON-LD structured data
    if (candidates.length === 0) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html())
          const items = Array.isArray(data) ? data : [data]
          for (const item of items) {
            if (item['@type'] === 'FoodEstablishment' || item['@type'] === 'LocalBusiness' || item.name) {
              records.push({
                id:           stableId(item.name, item.address?.streetAddress),
                name:         item.name || 'Unknown',
                address:      item.address?.streetAddress || '',
                city:         item.address?.addressLocality || '',
                state:        item.address?.addressRegion || 'MD',
                zip:          item.address?.postalCode || null,
                phone:        cleanPhone(item.telephone) || null,
                website:      cleanUrl(item.url) || null,
                hours:        item.openingHours || null,
                description:  item.description || 'Food resource listed on 211 Maryland.',
                categories:   ['food_pantry'],
                languages:    ['English'],
                requirements: 'See 211 Maryland listing for eligibility.',
                lat:          item.geo?.latitude ? parseFloat(item.geo.latitude) : null,
                lng:          item.geo?.longitude ? parseFloat(item.geo.longitude) : null,
                acceptsDonations: false,
                needsVolunteers:  false,
                donationNeeds:    [],
                volunteerNeeds:   [],
                source:       sourceId,
                lastScraped:  startedAt,
              })
            }
          }
        } catch { /* skip malformed JSON-LD */ }
      })
    }

    // Strategy C: parse HTML result blocks
    if (records.length === 0) {
      for (const { el, text: block } of candidates) {
        const lines = block.split(/\n|\r/).map(l => l.trim()).filter(Boolean)
        if (lines.length < 2) continue
        const name = lines[0].replace(/^\d+\.\s*/, '').trim()
        if (!name || name.length < 4) continue

        const phoneMatch = block.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/)
        const addrLine = lines.find(l => /^\d+\s+\w/.test(l))
        const zip = extractZip(block)
        const stateMatch = block.match(/\b(DC|MD|VA)\b/)

        records.push({
          id:           stableId(name, addrLine),
          name,
          address:      addrLine || '',
          city:         '',
          state:        stateMatch ? stateMatch[1] : 'MD',
          zip,
          phone:        phoneMatch ? cleanPhone(phoneMatch[0]) : null,
          website:      el.find('a[href^="http"]').first().attr('href') || null,
          hours:        null,
          description:  'Food resource listed on 211 Maryland.',
          categories:   ['food_pantry'],
          languages:    ['English'],
          requirements: 'See 211 Maryland listing for eligibility.',
          lat:          null,
          lng:          null,
          acceptsDonations: false,
          needsVolunteers:  false,
          donationNeeds:    [],
          volunteerNeeds:   [],
          source:       sourceId,
          lastScraped:  startedAt,
        })
      }
    }

    // Deduplicate
    const seen = new Set()
    records = records.filter(r => {
      const key = r.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    console.log(`   ✓ Parsed ${records.length} unique records`)
  } catch (err) {
    error = err.message
    console.log(`   ✗ Error: ${err.message}`)
  }

  return { sourceId, url, startedAt, finishedAt: nowISO(), records, rawHash, error }
}

// ── Merge logic ───────────────────────────────────────────────────────────────

/**
 * Merge scraped records into existing resources array.
 * Matches on stable ID first, then falls back to name+state.
 * Never deletes seed records (those without a 'scraped_' prefix id).
 * Returns { merged, countNew, countUpdated }
 */
function mergeResources(existing, incoming) {
  const byId   = new Map(existing.map(r => [r.id, r]))
  const byKey  = new Map(existing.map(r => [`${r.name.toLowerCase()}|${r.state}`, r]))

  let countNew     = 0
  let countUpdated = 0

  for (const rec of incoming) {
    const nameKey = `${rec.name.toLowerCase()}|${rec.state}`

    if (byId.has(rec.id)) {
      // Update scraped fields but preserve any manually curated fields
      const existing = byId.get(rec.id)
      byId.set(rec.id, {
        ...existing,
        hours:       rec.hours       ?? existing.hours,
        phone:       rec.phone       ?? existing.phone,
        website:     rec.website     ?? existing.website,
        description: rec.description ?? existing.description,
        lastScraped: rec.lastScraped,
      })
      countUpdated++
    } else if (byKey.has(nameKey)) {
      // Same org found by name — update lastScraped and scraped fields
      const ex = byKey.get(nameKey)
      byId.set(ex.id, {
        ...ex,
        hours:       rec.hours       ?? ex.hours,
        phone:       rec.phone       ?? ex.phone,
        website:     rec.website     ?? ex.website,
        lastScraped: rec.lastScraped,
      })
      countUpdated++
    } else {
      // Genuinely new record
      byId.set(rec.id, rec)
      countNew++
    }
  }

  return {
    merged: Array.from(byId.values()),
    countNew,
    countUpdated,
  }
}

// ── Scrape log entry ──────────────────────────────────────────────────────────

function buildLogEntry(result, countNew, countUpdated, runIndex) {
  const { sourceId, url, startedAt, finishedAt, records, error } = result

  const SOURCE_NAMES = {
    dc_open_data_cafb: 'DC Open Data (CAFB)',
    pgcfec:            'PG County CFEC',
    umd_extension:     'UMD Extension',
    md_food_bank:      'Maryland Food Bank',
    '211_maryland':    '211 Maryland',
  }

  const status = error
    ? 'error'
    : records.length === 0
      ? 'no_new_records'
      : 'success'

  return {
    runId:          `run_${sourceId}_${Date.now()}_${runIndex}`,
    startedAt,
    finishedAt,
    source:         sourceId,
    sourceName:     SOURCE_NAMES[sourceId] || sourceId,
    sourceUrl:      url,
    recordsFound:   records.length,
    recordsNew:     countNew,
    recordsUpdated: countUpdated,
    status,
    notes: error
      ? `Scrape failed: ${error}`
      : `Live scrape. Found ${records.length} records; ${countNew} new, ${countUpdated} updated.`,
  }
}

// ── Update frequency tracking ─────────────────────────────────────────────────

function updateFrequencyEntry(existing, result, countNew, countUpdated) {
  const { sourceId, url, startedAt, rawHash } = result
  const prev = existing[sourceId] || {}

  const SOURCE_NAMES = {
    dc_open_data_cafb: 'DC Open Data (CAFB)',
    pgcfec:            'PG County CFEC',
    umd_extension:     'UMD Extension',
    md_food_bank:      'Maryland Food Bank',
    '211_maryland':    '211 Maryland',
  }

  const SOURCE_TYPES = {
    dc_open_data_cafb: 'government_api',
    pgcfec:            'nonprofit_html',
    umd_extension:     'nonprofit_html',
    md_food_bank:      'nonprofit_html',
    '211_maryland':    'nonprofit_api',
  }

  const contentChanged = rawHash && prev.lastContentHash && rawHash !== prev.lastContentHash
  const isFirstRun     = !prev.lastContentHash

  // Compute observed interval if content changed
  let observedIntervalDays = prev.observedIntervalDays || null
  if (contentChanged && prev.lastChangedAt) {
    const diffMs   = new Date(startedAt) - new Date(prev.lastChangedAt)
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    // Rolling average with previous observation
    observedIntervalDays = prev.observedIntervalDays
      ? Math.round((prev.observedIntervalDays + diffDays) / 2)
      : diffDays
  }

  // Derive estimated frequency from observed interval
  let estimatedFrequency = prev.estimatedFrequency || 'monthly'
  let confidence         = prev.confidence || 'heuristic'

  if (observedIntervalDays !== null) {
    if (observedIntervalDays <= 3)       { estimatedFrequency = 'daily';    confidence = 'observed' }
    else if (observedIntervalDays <= 10) { estimatedFrequency = 'weekly';   confidence = 'observed' }
    else if (observedIntervalDays <= 45) { estimatedFrequency = 'monthly';  confidence = 'observed' }
    else                                 { estimatedFrequency = 'quarterly'; confidence = 'observed' }
  }

  return {
    ...prev,
    sourceName:           SOURCE_NAMES[sourceId] || sourceId,
    url,
    type:                 SOURCE_TYPES[sourceId] || 'unknown',
    estimatedFrequency,
    confidence,
    lastContentHash:      rawHash || prev.lastContentHash || null,
    lastScrapedAt:        startedAt,
    lastChangedAt:        (contentChanged || isFirstRun) ? startedAt : (prev.lastChangedAt || startedAt),
    timesChanged:         (prev.timesChanged || 0) + (contentChanged || isFirstRun ? 1 : 0),
    observedIntervalDays: observedIntervalDays,
    notes: observedIntervalDays
      ? `Observed avg change interval: ${observedIntervalDays} days. Confidence: ${confidence}.`
      : (prev.notes || `No change interval observed yet — need at least 2 runs with content changes.`),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  NourishNet Scraper')
  console.log(`  Started: ${new Date().toLocaleString()}`)
  console.log('═══════════════════════════════════════════════════════')

  // Load existing data
  const existingResources      = readJSON('resources.json')
  const existingLog            = readJSON('scrape_log.json')
  const existingUpdateFreq     = readJSON('update_frequency.json')

  console.log(`\n📂 Loaded existing data:`)
  console.log(`   ${Array.isArray(existingResources) ? existingResources.length : 0} resources`)
  console.log(`   ${Array.isArray(existingLog) ? existingLog.length : 0} log entries`)
  console.log(`   ${Object.keys(existingUpdateFreq).length} update_frequency entries`)

  // Run all scrapers
  const scrapeResults = await Promise.allSettled([
    scrapeDCOpenData(),
    scrapePGCFEC(),
    scrapeUMDExtension(),
    scrapeMDFoodBank(),
    scrape211Maryland(),
  ])

  const results = scrapeResults.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const sourceIds = ['dc_open_data_cafb', 'pgcfec', 'umd_extension', 'md_food_bank', '211_maryland']
    return {
      sourceId:   sourceIds[i],
      url:        '',
      startedAt:  nowISO(),
      finishedAt: nowISO(),
      records:    [],
      rawHash:    null,
      error:      r.reason?.message || 'Unknown error',
    }
  })

  // Merge all scraped records into existing resources
  let currentResources = Array.isArray(existingResources) ? [...existingResources] : []
  const newLogEntries      = []
  const updatedFreqEntries = { ...existingUpdateFreq }
  const summary            = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const { merged, countNew, countUpdated } = mergeResources(currentResources, result.records)
    currentResources = merged

    const logEntry  = buildLogEntry(result, countNew, countUpdated, i)
    newLogEntries.push(logEntry)

    updatedFreqEntries[result.sourceId] = updateFrequencyEntry(
      existingUpdateFreq,
      result,
      countNew,
      countUpdated
    )

    summary.push({
      source:   result.sourceId,
      found:    result.records.length,
      new:      countNew,
      updated:  countUpdated,
      status:   logEntry.status,
      error:    result.error || null,
    })
  }

  // Write updated files
  writeJSON('resources.json',       currentResources)
  writeJSON('scrape_log.json',      [...existingLog, ...newLogEntries])
  writeJSON('update_frequency.json', updatedFreqEntries)

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  Scrape Summary')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`${'Source'.padEnd(24)} ${'Found'.padStart(6)} ${'New'.padStart(6)} ${'Updated'.padStart(8)}  Status`)
  console.log('─'.repeat(57))

  for (const s of summary) {
    const statusIcon = s.status === 'success' ? '✓'
      : s.status === 'no_new_records' ? '○'
      : '✗'
    console.log(
      `${statusIcon} ${s.source.padEnd(22)} ${String(s.found).padStart(6)} ${String(s.new).padStart(6)} ${String(s.updated).padStart(8)}  ${s.status}${s.error ? ` — ${s.error}` : ''}`
    )
  }

  const totalNew     = summary.reduce((n, s) => n + s.new, 0)
  const totalUpdated = summary.reduce((n, s) => n + s.updated, 0)

  console.log('─'.repeat(57))
  console.log(`  Total resources now in database: ${currentResources.length}`)
  console.log(`  New this run: ${totalNew}  |  Updated: ${totalUpdated}`)
  console.log(`  Log entries written: ${newLogEntries.length}`)
  console.log(`\n  Files written:`)
  console.log(`    src/data/resources.json       (${currentResources.length} records)`)
  console.log(`    src/data/scrape_log.json       (${(Array.isArray(existingLog) ? existingLog.length : 0) + newLogEntries.length} total entries)`)
  console.log(`    src/data/update_frequency.json (${Object.keys(updatedFreqEntries).length} sources)`)
  console.log('\n  Done.\n')
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err)
  process.exit(1)
})
