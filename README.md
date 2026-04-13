# NourishNet

Food resource directory for Washington DC, Maryland, and Virginia.
Connects families seeking food assistance, donors, and volunteers with real local organizations.

Live demo: `https://<your-github-username>.github.io/nourishnet/`

---

## Quick Start

```bash
npm install
node scrape.js        # fetch live data from DC Open Data, PG CFEC, UMD Extension
npm run dev           # start dev server at http://localhost:5173/nourishnet/
```

---

## Deploy to GitHub Pages

```bash
npm run build         # builds to /dist with base path /nourishnet/
npm run deploy        # pushes /dist to gh-pages branch via gh-pages
```

GitHub Pages will serve the app at `https://<username>.github.io/nourishnet/`.
The `public/404.html` file handles SPA routing — all 404s redirect back to `index.html`
so React handles the path.

---

## Architecture

NourishNet uses a three-table flat-file pipeline stored as JSON in `src/data/`.

### Table 1 — `resources.json`

One record per food organization. Fields:

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable ID (numeric for seed data, `scraped_<hash>` for scraped) |
| `name` | string | Organization name |
| `address`, `city`, `state`, `zip` | string | Location |
| `phone`, `website`, `hours` | string | Contact info |
| `description` | string | Plain-text description |
| `categories` | string[] | e.g. `food_pantry`, `meal_program`, `snap_assistance` |
| `languages` | string[] | Languages spoken by staff |
| `requirements` | string | Eligibility requirements |
| `lat`, `lng` | number | Coordinates for map display |
| `acceptsDonations` | boolean | Whether org accepts donations |
| `needsVolunteers` | boolean | Whether org needs volunteers |
| `donationNeeds` | string[] | Specific items needed |
| `volunteerNeeds` | string[] | Volunteer roles available |
| `source` | string | Source ID (e.g. `dc_open_data`, `pgcfec`) |
| `lastScraped` | ISO string | Timestamp of last data verification |

### Table 2 — `scrape_log.json`

One record per scrape run. Every execution of `scrape.js` appends entries here.

| Field | Description |
|---|---|
| `runId` | Unique run identifier |
| `startedAt`, `finishedAt` | ISO timestamps |
| `source`, `sourceName`, `sourceUrl` | Which source was scraped |
| `recordsFound` | Total records parsed from source |
| `recordsNew` | Records not previously in database |
| `recordsUpdated` | Records that matched existing entries |
| `status` | `success`, `no_new_records`, `error`, or `partial` |
| `notes` | Human-readable run summary |

### Table 3 — `update_frequency.json`

One entry per source. Tracks content hashes and builds observed change intervals over time.

| Field | Description |
|---|---|
| `estimatedFrequency` | `daily`, `weekly`, `monthly`, `quarterly` |
| `confidence` | `high` (stated by publisher), `observed` (measured), `heuristic` (estimated) |
| `lastContentHash` | MD5 of last fetched response body |
| `lastChangedAt` | When content last differed from previous run |
| `timesChanged` | Count of observed content changes |
| `observedIntervalDays` | Rolling average days between content changes |

**How intervals are built:** On each scrape run, the response body is MD5-hashed. If the hash
differs from the previous run, the interval since `lastChangedAt` is recorded and averaged
into `observedIntervalDays`. After enough runs, `confidence` flips from `heuristic` to `observed`.

---

## Data Sources

| Source | URL | Type |
|---|---|---|
| DC Open Data | [opendata.dc.gov](https://opendata.dc.gov) | Government API |
| Maryland Open Data | [opendata.maryland.gov](https://opendata.maryland.gov) | Government API |
| PG County CFEC | [pgcfec.org](https://pgcfec.org) | Nonprofit HTML |
| Virginia Open Data | [data.virginia.gov](https://data.virginia.gov) | Government API |
| Capital Area Food Bank | [capitalareafoodbank.org](https://www.capitalareafoodbank.org) | Nonprofit HTML |
| Maryland Food Bank | [mdfoodbank.org](https://mdfoodbank.org) | Nonprofit HTML |
| UMD Extension | [extension.umd.edu](https://extension.umd.edu) | Nonprofit HTML |
| USDA SNAP Locator | [fns.usda.gov](https://www.fns.usda.gov/snap/retailer-locator) | Government API |
| 211 Maryland | [search.211md.org](https://search.211md.org) | Nonprofit API |
| Feeding America | [map.feedingamerica.org](https://map.feedingamerica.org) | Nonprofit HTML |
| US Census ACS | [data.census.gov](https://data.census.gov) | Government API |

---

## Scoring Algorithm

`scoreResource(r, params)` in `src/utils/search.js` ranks resources against a parsed query.
Higher score = better match. Results are sorted descending before display.

| Signal | Points | Notes |
|---|---|---|
| Need-type category match | +15 | `hot_meals`, `groceries`, `children`, `emergency_assistance`, `snap_assistance` |
| Other category match | +8 | Any other category in the parsed query |
| Language match | +10 | Staff speaks the requested language |
| No-ID explicit | +10 | Requirements text explicitly says no ID needed |
| No-ID neutral | +5 | Requirements text doesn't mention ID (benefit of the doubt) |
| Open on requested day | +5 | Hours string parsed to include the requested day |
| ZIP proximity | +8 | Same first 3 digits as user-entered ZIP |
| Free-text word match | +6 | Per matching word in name or description |
| Desc keyword match | +6 | Parsed `desc` field found in description |
| Donation/volunteer need match | +4 | Parsed `desc` found in donationNeeds or volunteerNeeds |

### Natural language query examples

| Input | Parsed as |
|---|---|
| `"halal chicken Saturday"` | `desc:'protein'`, `day:'Sat'` |
| `"baby formula no ID"` | `cats:['children']`, `desc:'formula'`, `noID:true` |
| `"hot soup Spanish"` | `cats:['hot_meals']`, `lang:'Spanish'` |
| `"emergency food today"` | `cats:['emergency_assistance']`, `day:<today>` |
| `"volunteer"` | `tab:'volunteers'` |

---

## Project Structure

```
nourishnet/
  scrape.js              # Node.js live data pipeline (run with: node scrape.js)
  src/
    App.jsx              # App shell: banner, header, routing, footer
    App.css
    pages/
      FindPage.jsx       # Unified search/donate/volunteer page
      FindPage.css
      PipelinePage.jsx   # Data pipeline transparency page
      PipelinePage.css
      Home.jsx           # Landing page
    data/
      resources.json     # Table 1: food organizations
      scrape_log.json    # Table 2: scrape run history
      update_frequency.json  # Table 3: per-source change tracking
      index.js           # Re-exports all three tables
      resources.js       # Adapter: exports resources + UI constants
    utils/
      search.js          # parseQuery, scoreResource, isOpen, timeAgo
      filterResources.js # Simple region/category/text filter
  public/
    404.html             # GitHub Pages SPA routing fix
    favicon.svg
```

---

## Built With

- [React 18](https://react.dev) + [Vite 5](https://vitejs.dev)
- [react-leaflet](https://react-leaflet.js.org) + [Leaflet](https://leafletjs.com) for maps
- [cheerio](https://cheerio.js.org) for HTML scraping
- [node-fetch](https://github.com/node-fetch/node-fetch) for server-side HTTP
- [gh-pages](https://github.com/tschaub/gh-pages) for deployment
- Map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright)
