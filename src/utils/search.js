/**
 * search.js — NourishNet query parsing, relevance scoring, and display utilities.
 */

// ─── 1. parseQuery ────────────────────────────────────────────────────────────

/**
 * Maps natural-language text to structured filter params.
 *
 * @param {string} rawText
 * @returns {{
 *   cats: string[],
 *   day: string|null,
 *   lang: string|null,
 *   noID: boolean,
 *   tab: string|null,
 *   desc: string|null,
 *   labels: string[],
 *   raw: string
 * }}
 */
export function parseQuery(rawText) {
  const text = (rawText || '').toLowerCase().trim()
  const cats = []
  const labels = []
  let day = null
  let lang = null
  let noID = false
  let tab = null
  let desc = null

  // Protein / meat keywords
  if (/\b(chicken|meat|protein|halal|kosher)\b/.test(text)) {
    desc = 'protein'
    labels.push('Protein foods')
  }

  // Hot / cooked meals
  if (/\b(hot food|hot meal|cooked|warm food|soup)\b/.test(text)) {
    cats.push('hot_meals')
    labels.push('Hot meals')
  }

  // Baby / infant supplies
  if (/\b(baby formula|formula|infant|diapers)\b/.test(text)) {
    if (!cats.includes('children')) cats.push('children')
    desc = desc ?? 'formula'
    labels.push('Baby & infant supplies')
  }

  // No-ID / undocumented
  if (/\b(no id|without id|no documents|undocumented)\b/.test(text)) {
    noID = true
    labels.push('No ID required')
  }

  // Language — Spanish
  if (/\b(spanish|español|espanol)\b/.test(text)) {
    lang = 'Spanish'
    labels.push('Spanish-speaking staff')
  }

  // Language — Amharic
  if (/\bamharic\b/.test(text)) {
    lang = 'Amharic'
    labels.push('Amharic-speaking staff')
  }

  // Day of week
  const DAY_MAP = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
    friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  }
  for (const [word, abbr] of Object.entries(DAY_MAP)) {
    if (text.includes(word)) {
      day = abbr
      labels.push(`Open ${abbr}`)
      break
    }
  }

  // "today" / "tomorrow"
  if (!day && /\btoday\b/.test(text)) {
    day = _todayAbbr()
    labels.push('Open today')
  }
  if (!day && /\btomorrow\b/.test(text)) {
    day = _tomorrowAbbr()
    labels.push('Open tomorrow')
  }

  // "weekend"
  if (!day && /\bweekend\b/.test(text)) {
    day = 'Sat'          // prefer Saturday as the primary weekend day
    labels.push('Open weekends')
  }

  // Donate tab
  if (/\b(donate|donation)\b/.test(text)) {
    tab = 'donors'
    labels.push('Donation info')
  }

  // Volunteer tab
  if (/\bvolunteer\b/.test(text)) {
    tab = 'volunteers'
    labels.push('Volunteer opportunities')
  }

  // Emergency / urgent
  if (/\b(emergency|urgent|crisis)\b/.test(text)) {
    if (!cats.includes('emergency_assistance')) cats.push('emergency_assistance')
    labels.push('Emergency assistance')
  }

  return { cats, day, lang, noID, tab, desc, labels, raw: rawText }
}

// ─── 2. scoreResource ─────────────────────────────────────────────────────────

/**
 * Scores a resource against parsed query params.
 * Higher score = better match.
 *
 * @param {object} r        - Resource object from resources.json
 * @param {object} params   - Output of parseQuery(), plus optional { zip, freeText }
 * @returns {number}
 */
export function scoreResource(r, params) {
  const { cats = [], day, lang, noID, desc, zip, freeText } = params
  let score = 0

  const rCats = r.categories || []
  const rLangs = r.languages || []
  const rReqs = (r.requirements || '').toLowerCase()
  const rDesc = (r.description || '').toLowerCase()
  const rName = (r.name || '').toLowerCase()

  // Need-type category match (+15 each)
  const NEED_TYPES = ['hot_meals', 'groceries', 'children', 'emergency_assistance', 'snap_assistance']
  for (const cat of cats) {
    if (rCats.includes(cat)) {
      score += NEED_TYPES.includes(cat) ? 15 : 8
    }
  }

  // Parsed category match (+8 for any other category hit)
  for (const cat of cats) {
    if (!NEED_TYPES.includes(cat) && rCats.includes(cat)) {
      score += 8
    }
  }

  // Language match (+10)
  if (lang && rLangs.includes(lang)) {
    score += 10
  }

  // No-ID match (+10) — look for absence of strict ID language in requirements
  if (noID) {
    const strictID = /\b(id required|photo id required|documentation required)\b/.test(rReqs)
    const explicitNoID = /\b(no id|no documentation|no requirement|self.declar)\b/.test(rReqs)
    if (explicitNoID) score += 10
    else if (!strictID) score += 5   // neutral / unclear — partial credit
  }

  // Open today (+5)
  if (day) {
    const openStatus = isOpen(r.hours, day)
    if (openStatus === true) score += 5
  }

  // ZIP proximity (+8) — same first 3 digits
  if (zip && r.zip) {
    if (String(zip).slice(0, 3) === String(r.zip).slice(0, 3)) {
      score += 8
    }
  }

  // Free-text word match (+6 per matching word)
  if (freeText) {
    const words = freeText.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    for (const word of words) {
      if (rName.includes(word) || rDesc.includes(word)) {
        score += 6
      }
    }
  }

  // Desc keyword match against description (+6)
  if (desc) {
    if (rDesc.includes(desc)) score += 6
    // Also check donationNeeds / volunteerNeeds for relevant terms
    const needs = [...(r.donationNeeds || []), ...(r.volunteerNeeds || [])]
      .join(' ').toLowerCase()
    if (needs.includes(desc)) score += 4
  }

  return score
}

// ─── 3. isOpen ────────────────────────────────────────────────────────────────

/**
 * Returns true if the hours string indicates the location is open on the given day.
 * Returns false if explicitly closed, null if the hours string is ambiguous.
 *
 * @param {string} hours   - e.g. "Mon–Fri 8am–5pm" or "Tue & Thu 10am–1pm"
 * @param {string} [dayAbbr] - Three-letter abbreviation, e.g. "Mon". Defaults to today.
 * @returns {boolean|null}
 */
export function isOpen(hours, dayAbbr) {
  if (!hours) return null

  const day = (dayAbbr || _todayAbbr()).toLowerCase()
  const h = hours.toLowerCase()

  // "varies" or "call ahead" — unknown
  if (/varies|call|by appointment/.test(h)) return null

  // "daily" covers every day
  if (/\bdaily\b/.test(h)) return true

  // Expand range abbreviations: "mon–fri" → includes mon tue wed thu fri
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const RANGE_RE = /(mon|tue|wed|thu|fri|sat|sun)[–\-–](mon|tue|wed|thu|fri|sat|sun)/gi

  let expandedDays = []

  // Collect explicit day mentions first
  let match
  const rangeRe = new RegExp(RANGE_RE.source, 'gi')
  while ((match = rangeRe.exec(h)) !== null) {
    const start = DAYS.indexOf(match[1].toLowerCase())
    const end = DAYS.indexOf(match[2].toLowerCase())
    if (start !== -1 && end !== -1) {
      if (start <= end) {
        expandedDays.push(...DAYS.slice(start, end + 1))
      } else {
        // Wraps around (e.g. Fri–Mon)
        expandedDays.push(...DAYS.slice(start), ...DAYS.slice(0, end + 1))
      }
    }
  }

  // Also collect standalone day mentions (not part of a range)
  for (const d of DAYS) {
    if (new RegExp(`\\b${d}\\b`).test(h)) {
      expandedDays.push(d)
    }
  }

  if (expandedDays.length === 0) return null   // can't determine

  return expandedDays.includes(day)
}

// ─── 4. timeAgo ───────────────────────────────────────────────────────────────

/**
 * Returns a human-readable verification label from an ISO timestamp.
 * Intentionally avoids misleading "just now" language.
 *
 * @param {string} iso  - ISO 8601 date string, e.g. "2026-04-01T08:00:00Z"
 * @returns {string}    - e.g. "Verified Apr 2026"
 */
export function timeAgo(iso) {
  if (!iso) return 'Verification date unknown'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return 'Verification date unknown'

  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const year = date.getUTCFullYear()
  return `Verified ${month} ${year}`
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DAY_ABBRS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function _todayAbbr() {
  return DAY_ABBRS[new Date().getDay()]
}

function _tomorrowAbbr() {
  return DAY_ABBRS[(new Date().getDay() + 1) % 7]
}
