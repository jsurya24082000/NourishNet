# NourishNet — Project Report

**Submitted for:** NourishNet Food Resource Directory Challenge
**Built with:** Kiro AI IDE
**Region served:** Washington DC · Maryland · Virginia
**Live app:** React + Vite, deployable to GitHub Pages at `/nourishnet/`

---

## Who It's For

NourishNet serves three distinct audiences, and every design decision was made with all three in mind simultaneously.

**Families seeking food assistance** are the primary users. Many are in a stressful situation — they may not speak English as a first language, may not have ID, may need food today rather than next week. The app was designed to remove friction: no account required, no forms to fill out, no jargon. A family can open the app, type "halal food Saturday" or "baby formula no ID" in plain English, and get a ranked list of matching organizations within seconds. The map shows exactly where each one is. The detail drawer shows hours, phone number, and a one-tap "Get directions" button.

**Donors** want to know where their contribution will have the most impact. The Donate tab shows every organization that accepts donations, with specific lists of what each one needs right now — not just "food donations" but "canned protein, peanut butter, cereal, cooking oil." Donors can filter by region and toggle between money, food, and fresh produce.

**Volunteers** want flexibility. The Volunteer tab shows organizations by region and role type — food sorting, driving, cooking, administrative — so someone with a car and two hours on Saturday can find the right fit without calling around.

**Technical reviewers and judges** have a fourth entry point: the Data Pipeline page (accessible via the `/pipeline` route in the code, intentionally hidden from the main nav so regular users aren't confused by it). It shows all three database tables live, with real scrape timestamps, content hashes, and source confidence levels.

---

## How the UI Works

The app is a single-page React application with no client-side router. Navigation is handled by a `page` state variable in `App.jsx` — clean, dependency-free, and impossible to break with a bad URL.

### The Shell

A dark navy top banner (`#0D2B4E`) carries the app name and a pulsing green dot indicating live data coverage across DC, MD, and VA. Below it, a sticky white header with a 2px navy bottom border holds the logo (Georgia serif font, inline SVG location pin) and three nav buttons: Find Food, Donate, Volunteer. The header stays visible as users scroll through results.

The footer repeats the navy color and includes a prominent "Call 211" link — a real `tel:211` hyperlink that works on mobile — for users in immediate crisis.

### FindPage — the core experience

FindPage is a single unified component that handles all three user flows (find, donate, volunteer) through an internal tab system. It was deliberately built as one component rather than three separate pages because the underlying data, map, and card layout are identical — only the filtering logic differs.

**The hero and intake form** sit at the top. The hero has the dark navy background with a white card rising from the bottom with rounded top corners. The card contains:

- Six need-type pill buttons (Any food, Hot meals, Groceries, Baby/infant, Emergency, SNAP/EBT) — tapping one pre-filters results before the user even types anything
- Five dropdowns: ZIP code, State, Language, ID requirement, Day available
- A free-text field for natural language input
- A full-width "Find matching resources" button
- Three tabs (Find Food, Donate, Volunteer) that switch the results view without reloading

**The results area** is a split layout: a 400px scrollable list on the left, a Leaflet map on the right. After clicking "Find matching resources," results appear ranked by relevance score. Each card shows the organization name, a rank badge (Top match / #2 match / Open today / Closed today), address, hours, phone, category tags, and small badges for "Accepts donations," "Needs volunteers," "No ID required," and "Español."

Full-data records (address + phone + hours + coordinates) appear first. Below a divider labeled "More resources (website only)," link-only records appear with a dashed border and a "Visit website →" button instead of contact details. This is honest — we don't pretend to have data we don't have.

**The map** uses react-leaflet with OpenStreetMap tiles. Markers are color-coded by category: red for hot meals/meal programs, dark green for food pantries, darker green for food banks, blue for others. Clicking a marker or a card opens the detail drawer.

**The detail drawer** slides in from the right on desktop, up from the bottom on mobile. It shows the full organization record: description, address, hours, phone, requirements, languages, services, donation needs, volunteer opportunities, and a "Verified [Month Year]" timestamp. Three action buttons — Call now, Get directions (Google Maps deep link), Visit website — are stacked at the bottom.

**Error boundary:** A React error boundary wraps FindPage. If anything crashes during render, instead of a blank white page, users see a plain grid of all 33 resources with basic contact info and a "Try again" button. The app never goes blank.

### Natural language search

The `parseQuery` function in `src/utils/search.js` maps plain English to structured filters:

- "halal chicken" → `desc: 'protein'`
- "hot soup" → `cats: ['hot_meals']`
- "baby formula no ID" → `cats: ['children'], desc: 'formula', noID: true`
- "Spanish Saturday" → `lang: 'Spanish', day: 'Sat'`
- "emergency urgent" → `cats: ['emergency_assistance']`

The `scoreResource` function then scores every record against those parsed params. A language match is worth +10 points. An explicit "no ID required" in the requirements text is worth +10. Being open on the requested day is +5. ZIP code proximity (same first 3 digits) is +8. Each matching word in the free-text field is +6. Results are sorted descending by score — the most relevant organization appears first.

The `isOpen` function parses hours strings like "Mon–Fri 9am–5pm" or "Tue & Thu 10am–1pm" into a day-of-week check. It handles ranges (Mon–Fri), individual days (Tue & Thu), "Daily," and "Varies" — returning `true`, `false`, or `null` (unknown) rather than guessing.

---

## How the 3-Table Pipeline Works

The data architecture is three flat JSON files in `src/data/`. They were designed to be simple enough to inspect in a text editor, real enough to demonstrate a production pipeline pattern, and honest enough to show exactly what was fetched and what failed.

### Table 1 — resources.json

The master database. 33 records total: 15 with full data (address, phone, hours, coordinates) and 18 link-only records (website URL only, no address or phone).

Every record has 23 fields: `id, name, address, city, state, zip, phone, website, hours, description, categories, languages, requirements, lat, lng, acceptsDonations, needsVolunteers, donationNeeds, volunteerNeeds, source, lastScraped, dataQuality`.

The `dataQuality` field is `"full"`, `"partial"`, or `"link_only"` — the UI uses this to decide how to render each card and whether to plot a map marker.

The 15 seed records (numeric IDs 1–15) were hand-curated with verified addresses, phone numbers, and coordinates. They are never overwritten by the scraper — only their `lastScraped` timestamp is updated when a matching record is found in a live source.

### Table 2 — scrape_log.json

An append-only audit log. Every time `scrape.js` runs, it adds one entry per source — regardless of whether anything was found. The log currently has 18 entries across 4 run sessions (5 seed entries written by hand, 13 from three live `node scrape.js` executions).

Each entry records: `runId` (contains a Unix epoch millisecond timestamp), `startedAt`, `finishedAt`, `source`, `sourceName`, `sourceUrl`, `recordsFound`, `recordsNew`, `recordsUpdated`, `status`, and `notes`. The `status` field is one of `success`, `no_new_records`, `error`, or `partial` — failures are logged honestly rather than silently dropped.

### Table 3 — update_frequency.json

One entry per data source. This table is updated in place on each run — it's the pipeline's memory about each source.

The key mechanism is **content hashing**: every time a source is fetched, the raw HTTP response body is MD5-hashed. If the hash differs from the stored hash, the source changed. The pipeline records the date of the change and computes a rolling average of the interval between changes. Over time, `observedIntervalDays` converges to the real update cadence of each source, and `confidence` flips from `heuristic` to `observed`.

Currently 5 of 9 sources have real content hashes from live fetches. The 4 seed entries (`dc_open_data`, `md_open_data`, `pg_county_cfec`, `va_open_data`) have no hash because they predate the live scraper.

### How the tables connect

Every record in Table 1 has a `source` field (e.g. `pgcfec`, `umd_extension`). That same ID is the key in Table 3 and appears in every Table 2 log entry. This means any record in the database can be traced back to: which source it came from, when it was last scraped, whether that scrape succeeded, and how reliable that source is historically.

### What each source actually returned

| Source | Method | Result |
|---|---|---|
| DC Open Data (CAFB ArcGIS) | REST API | Both endpoints returned API errors — layer requires auth or has moved |
| PG County CFEC | HTML scrape | 7 blocks parsed; after cleanup, navigation noise removed |
| UMD Extension | Link extraction | 36 food-related links; 18 kept as real org references after noise removal |
| Maryland Food Bank | HTML scrape | 4 branch office records with addresses and phone numbers |
| 211 Maryland | HTML scrape | 0 records — page is React-rendered, content loads via JavaScript after page load |

The DC Open Data failure is documented honestly in the scrape log with the exact error messages from both endpoints. The 211 Maryland failure is a known limitation of static HTML scraping against JavaScript-rendered pages — solving it would require a headless browser (Puppeteer/Playwright), which is the natural next step.

---

## Prompt Engineering Experience

NourishNet was built entirely through Kiro using 8 sequential prompts over a single session. The experience revealed several things about how to work effectively with an AI IDE.

**Specificity compounds.** The first prompt established the project structure, dependencies, and the three-audience framing. Every subsequent prompt built on that foundation without re-explaining it. By prompt 4 (FindPage), I could reference "the scoring functions from search.js" and "the data from index.js" and Kiro knew exactly what those were. The context accumulated rather than resetting.

**Schema decisions made early pay off late.** The decision in prompt 2 to use `categories` (an array) instead of `type` (a single string) meant that in prompt 4, the scoring function could check `r.categories.includes('hot_meals')` cleanly. The decision to include `source` and `lastScraped` on every record meant the pipeline page in prompt 5 could display real provenance data without any schema changes.

**Honest constraints produce better architecture.** When I asked for a `timeAgo` function, I specified "honest format like 'Verified Apr 2026' — not a misleading 'just now.'" That constraint shaped the entire data quality philosophy: the `dataQuality` field, the "link only" section divider, the scrape log's honest failure entries. Telling Kiro what *not* to do was as important as telling it what to do.

**Large files need to be broken up.** The original prompt asked for a single `tables.json` file. Kiro couldn't write it in one shot — the file was too large. Breaking it into three separate files (`resources.json`, `scrape_log.json`, `update_frequency.json`) with a thin `index.js` adapter was both the right technical decision and the right prompt engineering decision.

**Debugging through conversation works.** When the map wasn't rendering, I described the symptom ("map not showing after clicking Find matching resources") and Kiro diagnosed three separate causes: missing Leaflet CSS import, CDN marker icon URLs that could fail silently, and null lat/lng coordinates crashing the marker renderer. Each fix was targeted and explained. The blank-page bug on Donate/Volunteer was traced to `key={findTab}` forcing a React remount — a subtle issue that required reading the component carefully before fixing.

**The pipeline prompt was the most technically demanding.** Prompt 7 (scrape.js) required Kiro to write a real Node.js script that fetches live websites, parses HTML with cheerio, handles timeouts and errors gracefully, implements content hashing, and merges records without data loss. The result worked on the first run — PG CFEC returned 7 records, UMD Extension returned 36 links, and the DC Open Data failure was caught and logged cleanly.

---

## What I Would Improve

**1. Headless browser scraping for JavaScript-rendered pages.**
The two most valuable sources — 211 Maryland and the CAFB ArcGIS layer — couldn't be scraped with a plain HTTP fetch because their content loads via JavaScript. Adding Puppeteer or Playwright to the pipeline would unlock these sources. 211 Maryland alone has thousands of food resource listings across the DMV.

**2. Geocoding for records without coordinates.**
18 of 33 records have no lat/lng. The Maryland Food Bank branch offices have real addresses — running them through a geocoding API (Nominatim is free, Google Maps is more accurate) would put them on the map. This would make the map significantly more useful for Maryland users.

**3. Scheduled scraping.**
Right now `scrape.js` runs manually. A GitHub Actions workflow running on a cron schedule (weekly for nonprofit HTML sources, monthly for government APIs) would keep the data fresh automatically. The `update_frequency.json` table already has the infrastructure to track observed change intervals — it just needs a scheduler to feed it regular runs.

**4. User-submitted corrections.**
Food pantry hours change frequently, especially around holidays. A simple "Report incorrect hours" button on each card, backed by a Google Form or a GitHub issue template, would let community members flag stale data. The `lastScraped` timestamp already signals to users when data was last verified — pairing it with a correction mechanism would close the loop.

**5. SNAP eligibility integration.**
The USDA SNAP Locator API (`fns.usda.gov`) is a government API that returns authorized SNAP retailers by ZIP code. Integrating it would let users filter specifically for SNAP/EBT-accepting locations with verified government data rather than relying on self-reported categories.

**6. Accessibility audit.**
The app uses semantic HTML, ARIA labels on interactive elements, and keyboard navigation on cards and the drawer. But full WCAG 2.1 AA compliance requires manual testing with screen readers (VoiceOver, NVDA) and real users with disabilities. That testing hasn't been done and should be before a production launch — the population most likely to need food assistance includes people with disabilities.

**7. Offline support.**
A service worker caching the last-known resource list would let the app work without internet — important for users in areas with unreliable connectivity, or who look up a pantry address before leaving home and then lose signal on the way there.

---

## Technical Summary

| Item | Detail |
|---|---|
| Framework | React 18 + Vite 5 |
| Map | react-leaflet 4 + Leaflet 1.9 + OpenStreetMap |
| Scraping | node-fetch 3 + cheerio 1 |
| Data format | Flat JSON (no database required) |
| Deployment | GitHub Pages via gh-pages |
| Records | 33 total (15 full, 18 link-only) |
| States covered | DC, Maryland, Virginia |
| Scrape sources | 5 (2 returning data, 1 partial, 2 blocked) |
| Scrape runs logged | 18 entries across 3 live sessions |
| Sources with real content hashes | 5 of 9 |
| Lines of code | ~1,800 across 12 source files |
| External API dependencies | 0 (map tiles from OSM, no API key required) |

---
