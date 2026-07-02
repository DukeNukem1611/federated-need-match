Deployment Link: https://federated-need-match.vercel.app/

# Federated Community Need & Volunteer Matching Platform

A multi-tenant relief coordination platform where NGOs ingest unstructured
field reports, run shared incident timelines, visualize urgency hotspots, and
share volunteers across organizations when their own pool can't cover a need.
Installable as a PWA, with real logins, browser push notifications, photo
evidence, offline report queueing, and a live analytics pulse.

## Stack

- **Next.js 14** (App Router, server components) + Tailwind CSS
- **PostgreSQL + Prisma ORM**
- **Auth:** signed JWT session cookies (`jose`) + `bcryptjs` password hashing
- **Web Push** (VAPID) + service worker → real browser notifications
- **PWA:** web app manifest, offline fallback, installable to home screen
- **Google Gemini API** for LLM field-report parsing & OCR refinement
  (keyword-based fallback when no API key is set)
- **tesseract.js** client-side OCR for photographed notices/handwriting
- Google Maps embeds + OpenStreetMap/Nominatim geocoding; SVG hotspot map fallback

## Roles & access

| Role | Signs in at | Can |
| --- | --- | --- |
| **Volunteer** | `/login` (Volunteer tab) | file incidents & reports as their NGO, toggle availability, **accept / decline / complete assignments**, upload a profile picture, get push notifications |
| **NGO admin** | `/login` (NGO tab) | everything a volunteer can, plus add/remove volunteers, set & **reset** their passwords, remove fulfilled needs, set the NGO's profile picture |
| **Super-admin** | `/admin/login` (platform password) | add/remove NGOs (with generated admin credentials), remove incidents |

Every page and API is behind login (middleware + per-route guards). Server
routes derive the acting NGO/user from the session — request bodies can't
impersonate another NGO. New members get a default password and must change
it at first login.

## Setup

```bash
npm install
cp .env.example .env   # DATABASE_URL, GEMINI_API_KEY, AUTH_SESSION_SECRET,
                       # ADMIN_PASSWORD/ADMIN_SESSION_SECRET, VAPID keys, maps key
npm run db:generate
npm run db:push
npm run db:seed        # prints all demo login credentials
npm run dev
```

Open <http://localhost:3000> — you'll be redirected to `/login`.
All seeded accounts use the password printed by the seed (e.g.
`admin@helpinghands.org` / `ravi@helpinghands.org`).

## The demo flow that sells the federation

The seed creates NGOs with deliberately complementary skills
(Helping Hands has **no medics**; Care First does).

1. Log in as the **Helping Hands admin** → its dashboard.
2. **Ingest** the sample report *"Emergency: 3 people injured on MG Road…"*
   — the parser extracts `MEDICAL / CRITICAL / Medical, First Aid`. Optionally
   attach a **field photo** with the report.
3. **Find Match** → amber warning: no suitable volunteer in your own NGO.
   The matcher refuses to leak across NGO boundaries.
4. Click **Share**, then **Find Match** again → cross-NGO match with a medic
   from Care First; the volunteer gets a **push notification**.
5. Log in as that volunteer → **My Assignments** shows the proposal with
   **Accept / Decline**. Declining reopens the need and excludes them from the
   next ranking; accepting marks them BUSY and deployed; completing resolves it.
   The NGO admins are notified of every response.
6. Visit **/network** → hotspot map of every shared need, filters + search,
   and the **Network Analytics** pulse (filed vs matched trend, median
   time-to-match, acceptance rate, per-NGO contribution).

## Feature highlights

- **Incidents** — long-running, multi-NGO situations with an append-only
  timeline (info/hazard/need/resource/status updates), linked needs, live map.
- **Photos** — field photos (with optional caption) on timeline updates and
  needs; profile pictures for NGOs and members. Stored compressed in Postgres,
  served via cacheable endpoints so polled boards stay light.
- **PWA** — install from the browser (or the 📲 button); offline fallback page;
  **reports written offline are queued in IndexedDB and auto-sent on reconnect**.
- **Push** — new-incident broadcasts, match recommendations (skips BUSY
  volunteers), assignment responses; prunes dead subscriptions.
- **Boards** — status/category/urgency filters, text search, and pagination on
  the incident board and the federated network board.

## API surface (all auth-guarded)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` / `logout` / `change-password` | session lifecycle |
| GET | `/api/ngos` · PATCH/DELETE `/api/ngos/:id` | list; logo update (own admin); removal (super-admin) |
| POST | `/api/users` · PATCH/DELETE `/api/users/:id` | member management (NGO admin; self-PATCH for status/avatar) |
| POST | `/api/users/:id/reset-password` | issue a fresh default password |
| POST | `/api/ingest` | parse unstructured text (+photo) → ReportedNeed |
| GET/PATCH/DELETE | `/api/needs/:id` | detail; share/status; removal (owning NGO) |
| POST | `/api/needs/:id/match` | rank + persist a match, notify volunteers |
| PATCH | `/api/matches/:id` | volunteer accept / decline / complete |
| GET/POST | `/api/incidents` · `/api/incidents/:id/updates` | board + timelines (identity from session) |
| PATCH/DELETE | `/api/incidents/:id` | status change; removal (super-admin) |
| GET | `/api/needs/:id/photo` · `/api/updates/:id/photo` | cached photo bytes |
| POST | `/api/push/subscribe` / `unsubscribe` | Web Push subscriptions |
| GET/POST | `/api/notifications` (+`/read`) | in-app notification feed |

## Matching algorithm — transparent weighted sum

Tuneable in [`src/services/matching/matcher.ts`](src/services/matching/matcher.ts):

| Component | Weight | Notes |
| --- | ---: | --- |
| Skill match | 50 | coverage × proficiency (normalized) |
| Proximity | 30 | linear decay within volunteer's `maxRadiusKm`; out-of-radius candidates are still ranked (lower), never hidden |
| Same-NGO bonus | 15 | zero for federated-pool candidates |
| Urgency boost | 5 | CRITICAL = 1.3× |

Volunteers who **declined** a need are excluded from its future rankings.
Federation only widens the search when the owning NGO explicitly **shares**
the need — privacy stays with the org.

## Project layout

```
prisma/schema.prisma      NGO, User, Skill, ReportedNeed, Match, Incident,
                          IncidentUpdate, Notification, PushSubscription
src/
  middleware.ts           login gate for every page
  lib/                    session/auth guards, push, validation, photo serving
  services/
    ingestion/parser.ts   Gemini JSON parser / keyword fallback
    matching/matcher.ts   cross-NGO matcher + scorer
    notifications/        fan-out helpers (in-app + push)
  app/
    login/ · admin/       volunteer/NGO login · super-admin console
    dashboard/[ngoId]/    NGO command center (read-only for other NGOs)
    user/[userId]/        volunteer workspace + My Assignments
    incidents/ · network/ incident board · federated board + analytics
    api/...               REST handlers (table above)
  components/             forms, panels, charts, PWA plumbing
public/sw.js              push + offline service worker
scripts/gen-icons.mjs     regenerates PWA icons from the SVG sources
```

## Post-hackathon ideas

- Login rate limiting / lockout.
- Move photo bytes to blob storage (Vercel Blob/S3) — the serving endpoints
  already isolate storage, so it's a drop-in swap.
- Email notifications as a push fallback.
- PostGIS `geography(Point)` + `ST_DWithin` once geo queries matter at scale.
