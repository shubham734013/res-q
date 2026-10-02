# ResQ

Healthcare navigation and emergency coordination. Find nearby hospitals,
emergency departments, blood banks and ambulance providers — with honest
information about how current and how trustworthy each listing is.

**ResQ is not a diagnosis system.** It does not interpret symptoms, recommend
treatment, reserve beds or dispatch ambulances. In a life-threatening emergency,
contact your local emergency service.

---

## Stack

| Layer    | Choice                                                                |
| -------- | --------------------------------------------------------------------- |
| Client   | React 19 + Vite, **JavaScript/JSX**, Tailwind v4, React Router, TanStack Query |
| Server   | Node + Express, **JavaScript (ESM)**, Zod validation, Prisma ORM        |
| Database | PostgreSQL 16 (no PostGIS — see *Geospatial* below)                    |
| Maps     | Leaflet + OpenStreetMap (no API key required)                          |
| Auth     | JWT access token + rotating refresh token in an HttpOnly cookie        |

The whole repository is JavaScript. There is no TypeScript build step on either
side. Runtime validation is done by Zod, which works identically in JS — the
contract schemas in `server/src/contracts/` still enforce every rule at runtime;
only compile-time type checking is absent.

---

## Quick start

```bash
# 1. database
docker compose up -d                    # postgres on :5432

# 2. server
cd server
cp .env.example .env                    # then edit the two JWT secrets
npm install
npm run prisma:generate                 # generates Prisma Client
npm run prisma:migrate                  # creates the tables
npm run seed                            # 24 demo facilities, demo accounts
npm run dev                             # http://localhost:4000

# 3. client (second terminal)
cd client
npm install
npm run dev                             # http://localhost:5173
```

The client dev server proxies `/api` to `http://localhost:4000`, so the browser
sees a single origin and the refresh cookie is same-site. For production, set
`VITE_API_URL` to the deployed API instead.

If `npm run prisma:migrate` is unavailable, the same schema can be applied
directly:

```bash
psql "$DATABASE_URL" -f server/prisma/migrations/20261001000000_init/migration.sql
```

### Demo accounts

Password for all four: `ResQDemo!2026`

| Email                 | Role           | Notes                       |
| --------------------- | -------------- | --------------------------- |
| `user@demo.resq`      | USER           | saved facilities, contacts  |
| `hospital@demo.resq`  | HOSPITAL_ADMIN | manages 2 facilities        |
| `hospital2@demo.resq` | HOSPITAL_ADMIN | manages 1 other facility    |
| `admin@demo.resq`     | SUPER_ADMIN    | verification, report triage |

`hospital2` exists so the cross-facility 403 test has a real target. Never use
these credentials outside a demo.

---

## Scripts

**server**

| Script                    | Does                                        |
| ------------------------- | ------------------------------------------- |
| `npm run dev`             | API with `--watch`                          |
| `npm start`               | API                                         |
| `npm run check:contracts` | 26 contract and freshness invariant checks  |
| `npm test`                | `node --test` — needs a seeded database     |
| `npm run seed`            | demo data                                   |

**client**

| Script            | Does                 |
| ----------------- | -------------------- |
| `npm run dev`     | Vite dev server      |
| `npm run build`   | production build     |
| `npm run preview` | serve the built app  |

---

## How it is put together

```
res-q/
├── client/src/
│   ├── api/client.js        envelope handling, token refresh, one fetch wrapper
│   ├── services/            every endpoint named once
│   ├── context/             auth and location
│   ├── components/          UI, status/provenance display, map, dialogs
│   ├── layouts/             app shell (emergency has its own)
│   └── pages/               routed screens
└── server/
    ├── prisma/              schema, hand-checked SQL migration, seed
    └── src/
        ├── contracts/       Zod request + response schemas
        ├── lib/             freshness, distance, ranking, tokens, errors
        ├── middleware/      validation, auth, ownership, error envelope
        └── modules/         auth, facility, emergency, reports, hospitalAdmin
```

### The trust model is the architecture

The central rule is that **ResQ never states availability it cannot stand
behind.**

- `freshnessStatus` is **derived on every read** from `lastUpdatedAt`, never
  stored. A stored freshness value goes stale itself, which is the exact failure
  the system exists to prevent.
- Every facility and availability payload carries `source`, `sourceType`,
  `lastUpdatedAt` and `freshnessStatus`. No endpoint returns a bare status.
- If there is no timestamp, the status is forced to `UNKNOWN`. This is enforced
  in two places: `buildProvenance()`/`guardStatus()` in
  `server/src/lib/freshness.js`, which every serializer must route through, and
  `withProvenanceInvariants()` in the contracts, which fails a violating payload
  in tests.
- Seeded data is `sourceType: DEMO` and renders a DEMO badge regardless of age.

In the UI this shows up as the **confidence rail** — the vertical bar on the
leading edge of every result. Solid green = recently updated, dashed amber =
stale, dashed blue = demo, hollow = nothing known. It encodes freshness as
pattern *and* colour, so it survives greyscale and colour-blindness, and a
facility reporting nothing gets a hollow rail rather than borrowing the
facility record's freshness.

One more colour rule worth knowing before editing the CSS: **`--urgent` (red) is
reserved for emergency affordances only.** Errors and validation use neutral
ink. On a healthcare product, red must mean exactly one thing.

### Geospatial

No PostGIS. `/facilities/nearby` does a bounding-box prefilter on the indexed
`latitude`/`longitude` columns, then exact Haversine on the candidates, then the
radius cut, ranking and pagination in the application layer.

Prisma has no native geography type, so PostGIS would mean `Unsupported()`
columns plus `$queryRaw` for every nearby query. The bounding-box approach is
portable and fast well past prototype scale. All of it lives behind
`server/src/lib/distance.js`, so swapping in PostGIS later touches that file and
the repository layer only.

There is a `MAX_CANDIDATES = 2000` cap in `modules/facility/service.js`. If it
is ever hit in practice, that is the signal to move ranking into SQL — not to
raise the number.

### Ranking

`server/src/lib/ranking.js`. Every factor is named and bounded, and each result
returns `rankReason` so the order is explainable in the UI and assertable in
tests. Emergency Mode weights capability, freshness and verification above
distance; normal search weights distance highest. **Nothing in the ranking can
be bought, and no sponsorship input should ever be added.**

### Security

- bcrypt (cost 12); plaintext passwords are never stored or logged.
- Access token in memory only — never `localStorage`, so XSS cannot read it.
  Refresh token is an HttpOnly, SameSite cookie, stored server-side as a SHA-256
  hash.
- Refresh rotation with reuse detection: replaying an already-rotated token
  revokes the entire token family.
- `role` is absent from `RegisterRequest`, so it cannot be mass-assigned.
  Likewise the hospital-admin update schema has no `name`, `type`, `latitude` or
  `verificationStatus` — omission is the enforcement.
- Ownership is checked server-side on every hospital-admin write
  (`resolveFacilityOwnership`), with a test asserting the 403.
- Helmet, CORS allow-list, rate limiting (tighter on auth and reports), 100 kB
  body cap, and an error handler that never leaks internals in production.

### Privacy

Precise coordinates are stored only on `EmergencySession`, with an `expiresAt`
for purging. A user's profile keeps at most a manually chosen city. Emergency
Mode works signed out. There is no background tracking, and location sharing is
one-shot and explicit.

---

## Known limitations

- **Blood bank and ambulance modules are schema and seed only.** The tables,
  enums and demo rows exist; the API routes and UI do not. This was the deferred
  second pass.
- **Super-admin verification workflow is partial.** Report triage is built;
  approving and rejecting facility registrations is not.
- **No notifications are actually delivered.** `POST /emergency/share` records
  the intent and returns `queued`, never `delivered`, because no SMS or email
  provider is configured. Wire one up in `modules/emergency/routes.js`.
- **No live availability integration exists**, so `REAL_TIME` freshness is
  unreachable by design. Everything is `RECENT`, `STALE`, `DEMO` or `UNKNOWN`.
- **Pagination of `/facilities/nearby` happens after ranking in memory.** Fine
  at prototype scale, wrong at city scale — see the `MAX_CANDIDATES` note.
- **Geocoding is a fixed list** in `client/src/context/LocationContext.jsx`.
  Free-text place search needs a geocoding provider.
- `npm run preview` serves the built client without the dev proxy, so set
  `VITE_API_URL` before building if you want to preview against a running API.

## Next steps

1. Blood bank and ambulance endpoints + screens (schema is already in place).
2. Facility verification queue for SUPER_ADMIN.
3. Move ranking into SQL, or adopt PostGIS, before the candidate cap bites.
4. A real geocoder for manual location entry.
5. Integration tests for the search and emergency flows; `test/ownership.test.js`
   is the pattern to follow.
