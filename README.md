# Federated Community Need & Volunteer Matching Platform

Hackathon MVP — a multi-tenant platform where multiple NGOs ingest unstructured
field reports, visualize urgency hotspots, and share volunteers across
organizations when their own pool can't cover a need.

## Stack

- **Next.js 14** (App Router) + Tailwind CSS
- **Node.js / TypeScript** service layer
- **PostgreSQL + Prisma ORM**
- **Google Gemini API** (for LLM-based field report parsing and OCR refinement)
- Interactive Google Maps embed & OpenStreetMap/Nominatim Geocoding
- Simple lat/lng geometry + an SVG federated hotspot map

## Setup

```bash
npm install
cp .env.example .env       # edit DATABASE_URL & add your GEMINI_API_KEY
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

## Demo flow (the one that sells the federated story)

The seed creates two NGOs with deliberately complementary skills:

| NGO            | Volunteers                              |
| -------------- | --------------------------------------- |
| Helping Hands  | Logistics + General only — **no medics** |
| Care First     | Medical + First Aid                      |

### Step 1 — Land on `/`
Pick **Helping Hands**.

### Step 2 — Ingest a critical medical report
In the "Ingest field report" box, click the sample
*"Emergency: 3 people injured on MG Road…"* and hit **Ingest** (leave "Share"
unchecked).

The Gemini-powered parser extracts `MEDICAL` / `CRITICAL` / required skills =
`Medical, First Aid`. The new card appears in the needs list. (Falls back to a keyword-based mock if no API key is provided).

### Step 3 — Try to match it
Click **Find match** on the new need. You get an amber warning:

> No suitable volunteer in own NGO. Try toggling 'Share' to widen the search.

That's the matcher correctly refusing to leak across NGO boundaries.

### Step 4 — Click **Share**
The need now shows a "shared" badge.

### Step 5 — Click **Find match** again
Now the matcher widens to the federated pool, finds **Dr. Asha** at Care
First, and shows a green panel:

> ✓ Matched Dr. Asha — score X · 🌐 cross-NGO match

The need's status flips to `MATCHED`.

### Step 6 — Visit `/network`
The hotspot map renders every shared need across all NGOs, sized and colored
by urgency. The list below shows each one with its source NGO badge.

## API surface

| Method | Path                          | Purpose                                       |
| ------ | ----------------------------- | --------------------------------------------- |
| GET    | `/api/ngos`                   | List NGOs with member/need counts             |
| POST   | `/api/ingest`                 | Parse unstructured text → ReportedNeed        |
| GET    | `/api/needs?ngoId=&shared=`   | List needs (per-NGO or federated)             |
| GET    | `/api/needs/:id`              | Need detail with relations                    |
| PATCH  | `/api/needs/:id`              | Update `isShared` and/or `status`             |
| POST   | `/api/needs/:id/match`        | Run matcher and persist a Match               |
| GET    | `/api/volunteers?ngoId=`      | List volunteers (optionally per-NGO)          |

## Project layout

```
prisma/
  schema.prisma                           NGO, User, Skill, ReportedNeed, Match
  seed.ts                                 demo data with mismatched skill pools

src/
  app/
    page.tsx                              NGO picker (server component)
    dashboard/[ngoId]/page.tsx            per-NGO dashboard
    network/page.tsx                      federated network view
    api/...                               REST handlers (see table above)
  components/
    IngestForm.tsx                        client form → POST /api/ingest
    NeedRow.tsx                           per-need card with match + share
    VolunteerPanel.tsx                    sidebar volunteer list
    HotspotMap.tsx                        SVG hotspot map for /network
  lib/
    prisma.ts                             singleton client
    format.ts                             badge color/emoji helpers
  services/
    geo/distance.ts                       haversine
    ingestion/parser.ts                   Gemini LLM JSON parser / keyword fallback
    matching/matcher.ts                   cross-NGO matcher + scorer
```

## Matching algorithm — weighted sum

Tuneable in [`src/services/matching/matcher.ts`](src/services/matching/matcher.ts):

| Component      | Weight | Notes                                             |
| -------------- | -----: | ------------------------------------------------- |
| Skill match    |    50  | coverage × proficiency (normalized)               |
| Proximity      |    30  | linear decay within volunteer's `maxRadiusKm`     |
| Same-NGO bonus |    15  | zero when falling back to the federated pool      |
| Urgency boost  |     5  | multiplied by urgency level (CRITICAL = 1.3×)     |

Out-of-radius candidates are hard-rejected (score = 0).

## Cross-NGO fallback in plain English

```
Need is OPEN
  ├── Search volunteers WHERE ngoId = need.ngoId AND has-required-skill
  │     └── Found candidates? → score them, return best
  └── No candidates AND need.isShared
        └── Search WHERE ngoId != need.ngoId AND ngo.sharesPool = true
              └── Found candidates? → score them, mark match.isCrossNgo = true
```

Federation only widens the search when the *reporting NGO has explicitly
opted-in* by sharing the need — so privacy/control stays with the owning org.

## Next steps (post-hackathon)

- Real auth — NextAuth or Clerk; inject `ngoId` from the session instead of
  trusting URL params.
- Upgrade the federated `HotspotMap` to react-leaflet with real tiles (currently SVG).
- Swap lat/lng columns for PostGIS `geography(Point)` once `ST_DWithin`
  queries matter at scale.
- Volunteer-facing app: accept/decline match notifications.
