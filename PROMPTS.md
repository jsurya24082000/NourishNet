# NourishNet — Prompts Used to Build This App

This document records every prompt used to build NourishNet with [Kiro](https://kiro.dev).
Judges and reviewers can paste these into Kiro in order to reproduce the full project from scratch.

---

## Prompt 1 — Project scaffold

Sets up the Vite + React project, installs all dependencies, configures GitHub Pages base path,
and creates the folder structure for a three-audience food resource directory.

> Create a React + Vite project for a food resource directory called NourishNet serving Washington DC, Maryland, and Virginia.
> Install these dependencies: react, react-dom, leaflet, react-leaflet as dependencies.
> Add @vitejs/plugin-react, vite, gh-pages, node-fetch, cheerio as devDependencies.
> In vite.config.js set base to '/nourishnet/' for GitHub Pages deployment.
> Create this folder structure:
> - src/pages/
> - src/data/
> - src/utils/
> - public/
>
> The app serves three types of users: families seeking food assistance, donors wanting to give food or money, and volunteers wanting to help.

---

## Prompt 2 — Data architecture (three JSON files)

Replaces the hardcoded resources array with a proper three-file data architecture.
Introduces the full resource schema including categories, languages, requirements,
acceptsDonations, needsVolunteers, and source tracking fields.

> The current resources.js has hardcoded data. Replace it with a proper data architecture using three separate files:
> 1. src/data/resources.json — array of 15 real DMV food organizations
> 2. src/data/scrape_log.json — scrape run records
> 3. src/data/update_frequency.json — per-source frequency estimates
>
> Then create src/data/index.js that imports all three and exports them as one object:
> export { default as RESOURCES } from './resources.json'
> export { default as SCRAPE_LOG } from './scrape_log.json'
> export { default as UPDATE_FREQUENCY } from './update_frequency.json'
>
> Include these real organizations: Capital Area Food Bank, SOME (So Others Might Eat),
> Bread for the City NW, Bread for the City SE, Miriam's Kitchen, Martha's Table,
> DC Central Kitchen, Friendship Place, Manna Food Center, AFAC Arlington,
> Hyattsville Help, Food for Others, Catholic Charities Hyattsville, Bowie Food Pantry,
> Carpenter's Shelter Alexandria.
>
> scrape_log should have one initial entry per source showing the data was collected from:
> DC Open Data, Maryland Open Data, PG County CFEC, Virginia Open Data, UMD Extension.
>
> update_frequency should have one entry per source with honest heuristic estimates:
> government APIs = monthly, nonprofit HTML pages = weekly.

---

## Prompt 3 — Search and scoring utilities

Creates src/utils/search.js with four exported functions: a natural language query parser,
a relevance scoring function, an hours-based open/closed checker, and a verified date formatter.

> Create src/utils/search.js with these four exported functions:
>
> 1. parseQuery(rawText) — natural language parser that maps keywords to filters:
>    - "chicken", "meat", "protein", "halal", "kosher" → desc:'protein'
>    - "hot food", "hot meal", "cooked", "warm food", "soup" → cats:['hot_meals']
>    - "baby formula", "formula", "infant", "diapers" → cats:['children'], desc:'formula'
>    - "no ID", "without ID", "no documents", "undocumented" → noID:true
>    - "Spanish", "español" → lang:'Spanish'
>    - "Amharic" → lang:'Amharic'
>    - "Monday" through "Sunday", "today", "tomorrow", "weekend" → day filter
>    - "donate", "donation" → tab:'donate'
>    - "volunteer" → tab:'volunteer'
>    - "emergency", "urgent", "crisis" → cats:['emergency_assistance']
>    Returns: { cats, day, lang, noID, tab, desc, labels, raw }
>
> 2. scoreResource(r, params) — relevance scoring:
>    - Need type match (hot_meals, groceries, baby, emergency, snap) → +15
>    - Language match → +10
>    - No-ID match → +10
>    - Open today → +5
>    - ZIP code proximity (same first 3 digits) → +8
>    - Free text word match per word → +6
>    - Parsed category match → +8
>
> 3. isOpen(hours) — returns true if open today, false if closed, null if unknown
>
> 4. timeAgo(iso) — returns honest format like "Verified Apr 2026"

---

## Prompt 4 — Unified FindPage

Replaces the three separate Families, Donors, and Volunteers pages with a single unified
FindPage that has a dark navy hero, intake form with need-type pills and dropdowns,
a scored results list, a react-leaflet map with color-coded markers, and a slide-in detail drawer.

> Replace the current Families.jsx, Donors.jsx, and Volunteers.jsx pages with a single unified
> FindPage.jsx in src/pages/. Also update App.jsx to use it.
>
> FindPage.jsx should have:
>
> HERO SECTION (dark navy #0D2B4E background):
> - Small badge: "DC · Maryland · Virginia"
> - H1: "Find the right food resource for your situation."
> - Subtext: "Tell us what you need — we'll find and rank the best matches near you."
>
> INTAKE FORM (white card, rounded top corners, sits at bottom of hero):
> 1. Need type pill buttons: "🍽️ Any food", "🍲 Hot meals", "🛒 Groceries", "🍼 Baby/infant", "🚨 Emergency", "💳 SNAP/EBT"
> 2. Grid of 5 dropdowns: ZIP code input, State, Language, ID requirement, Day available
> 3. Free text input labeled "Anything specific? (optional)"
> 4. Full width dark navy "Find matching resources" button
> 5. Three tabs below button: Find Food | Donate | Volunteer
>
> RESULTS AREA (split layout):
> - Left panel (400px): scrollable list of resource cards with rank badges, match line, verified date, category tags, and info badges
> - Right panel: react-leaflet map, markers color coded by category, map pans to selected resource
>
> DETAIL DRAWER: slides in from right, shows all org details plus Call now, Get directions, Visit website buttons.
>
> Use scoreResource and parseQuery from src/utils/search.js for filtering and ranking.

---

## Prompt 5 — Data Pipeline transparency page

Creates PipelinePage.jsx for technical reviewers and judges. Shows live counts from the
three JSON tables, an architecture explanation, three styled data tables with expandable
notes, and a data sources section linking all 11 sources.

> Create src/pages/PipelinePage.jsx — a data pipeline transparency page for technical reviewers and judges.
>
> HEADER: Title "Data Pipeline", subtitle about three tables.
>
> 3 STAT CARDS: Total resources, total scrape runs, data sources tracked.
>
> ARCHITECTURE EXPLANATION BOX (light blue): explain the three-table pipeline design.
>
> TABLE 1 — resources: Name, City, State (colored badge), Categories, Source, Last verified
> TABLE 2 — scrape_log: Time, Source, Records found, New (green), Updated, Status badge
> TABLE 3 — update_frequency: Source name, Type, Est. frequency, Last changed, Times changed, Confidence badge
>
> DATA SOURCES SECTION: list all 11 sources with name and link.
>
> Import all data from src/data/index.js.

---

## Prompt 6 — App shell redesign

Rewrites App.jsx as a polished shell with a dark navy top banner (pulsing green dot),
sticky white header with serif logo and location pin SVG, active-state nav buttons,
client-side routing for all four views, and a dark navy footer with a "Call 211" crisis link.

> Update src/App.jsx to be the main app shell:
>
> TOP BANNER (dark navy, full width):
> - Text: "NourishNet · Food Resource Directory — Washington DC · Maryland · Virginia"
> - Right side: small green pulsing dot with text "DC · MD · VA"
>
> STICKY HEADER (white, 2px navy bottom border):
> - Left: logo with navy circle containing location pin SVG, "NourishNet" in Georgia serif, "FOOD RESOURCE DIRECTORY" in small caps
> - Right: nav buttons for "Find Food", "Donate", "Volunteer", "Data Pipeline"
> - Active nav button has light blue background and navy text
> - Clicking "Donate" switches to FindPage with Donate tab active
> - Clicking "Volunteer" switches to FindPage with Volunteer tab active
>
> PAGE ROUTING (no react-router, just useState):
> - Default: FindPage with activeView='find'
> - 'donate' → FindPage with activeView='donors'
> - 'volunteer' → FindPage with activeView='volunteers'
> - 'pipeline' → PipelinePage
>
> FOOTER (dark navy):
> - Left: NourishNet serif name, tagline, data sources attribution
> - Right: "In crisis? Call 211 — free, 24/7 food assistance"

---

## Prompt 7 — Live data scraper

Creates scrape.js in the project root — a real Node.js pipeline script that fetches live
data from three sources (DC Open Data ArcGIS API, PG County CFEC HTML, UMD Extension HTML),
uses MD5 content hashing to detect changes, merges records without overwriting seed data,
and writes real log entries and observed frequency intervals.

> Create scrape.js in the project root directory. This is a Node.js script that actually
> fetches live data from real websites and writes results to the three JSON files in src/data/.
>
> The script should:
> 1. Import node-fetch and cheerio
> 2. Read existing src/data/resources.json, scrape_log.json, update_frequency.json
> 3. Fetch these real sources:
>    - SOURCE 1: DC Open Data ArcGIS API (CAFB Emergency Food Providers)
>    - SOURCE 2: PG County CFEC HTML page (food pantry listings)
>    - SOURCE 3: UMD Extension food access page (link extraction)
> 4. Use MD5 content hashing to detect if content changed since last run
> 5. Write a real log entry to scrape_log.json with actual timestamps and record counts
> 6. Update update_frequency.json with real observed intervals
> 7. Merge new records into resources.json without deleting existing seed data
> 8. Print a clear summary showing what was fetched, how many records, what changed
>
> Add "scrape": "node scrape.js" to package.json scripts.

---

## Prompt 8 — Final files and documentation

Creates the GitHub Pages SPA routing fix (public/404.html), this PROMPTS.md file,
and a complete README.md with quick start, deploy instructions, architecture overview,
data sources table, and scoring algorithm table.

> Create two final files:
>
> 1. public/404.html — for GitHub Pages SPA routing. Redirects all 404s back to index.html.
>
> 2. PROMPTS.md — document all prompts used to build this app so judges can reproduce it in Kiro.
>
> Also update README.md with:
> - Quick start: npm install, node scrape.js, npm run dev
> - Deploy: npm run build then npm run deploy
> - Architecture: explain the 3-table pipeline
> - Data sources: table of all 11 sources
> - Scoring algorithm: table of each factor and its points value
