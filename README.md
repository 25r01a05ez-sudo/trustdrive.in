# TrustDrive — Verified Used Car Marketplace

A full-stack implementation of the architecture you shared: a buyer-facing
marketplace, a dealer dashboard, and an admin dashboard, backed by an
Express API that mirrors each box in the diagram (Auth, Dealer Service,
Vehicle Service, Search Service, Verification Service, Lead Management,
Review Service, Analytics Service), sitting on an in-memory "Database Layer"
you can swap for Postgres + Redis.

```
trustdrive/
├── backend/     Express API gateway + services (Node.js)
└── frontend/    React + Vite + Tailwind buyer/dealer/admin UI
```

## Run it locally

**0. Set up environment files (required — see "Set up auth" below for what goes in each)**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**1. Backend (port 4000)**
```bash
cd backend
npm install
npm run dev        # or: npm start
```

**2. Frontend (port 5173)**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to
`http://localhost:4000`, so both must be running. Demo accounts (see below)
work immediately with no extra setup — WhatsApp alerts and RC verification
are optional, see the next sections.

## Using Supabase (recommended) or local Postgres

By default the backend runs against an in-memory store — zero config,
resets on restart. Set `DATABASE_URL` (and `DIRECT_URL`) to switch to real
Postgres automatically, no code changes needed.

**Option A — Supabase (hosted, recommended)**
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to Project Settings → Database → Connection string.
3. Copy the **Transaction pooler** string (port 6543) into `backend/.env`
   as `DATABASE_URL` — this is what your app uses at runtime.
4. Copy the **Session** / **Direct connection** string (port 5432) into
   `backend/.env` as `DIRECT_URL` — this is only used for running
   migrations, since migrations don't work through the pooler.
5. Both strings look like `postgresql://postgres.[project-ref]:[password]@...`
   — Supabase shows you the exact values on that same page. Make sure
   `?pgbouncer=true` is on the pooled `DATABASE_URL` if Supabase doesn't add
   it automatically.
6. From `backend/`:
   ```bash
   npx prisma migrate dev --name init
   npm run prisma:seed
   npm run dev
   ```
   Your data now lives in Supabase's Postgres — you can browse it in the
   Supabase dashboard's Table Editor, or locally with `npm run prisma:studio`.

**Option B — local Postgres via Docker**
```bash
# 1. Start Postgres (Docker) from the repo root
docker compose up -d

# 2. Point the backend at it
cd backend
cp .env.example .env
# uncomment DATABASE_URL AND set DIRECT_URL to the same value

# 3. Create tables and seed demo data
npx prisma migrate dev --name init
npm run prisma:seed

# 4. Run the API as usual
npm run dev
```

No route code changes are needed either way — `backend/lib/store.js` picks
the in-memory or Prisma implementation automatically based on whether
`DATABASE_URL` is set. Browse the data with `npm run prisma:studio`.

## Set up auth, encryption, WhatsApp alerts, and verification

**1. Auth (works out of the box)**
Login/signup is handled by TrustDrive's own JWT-based auth — no third-party
account needed. Demo accounts (password `password123` for all) — these only
exist in the in-memory demo store and in the Postgres seed script, and are
for local testing only, never for a real deployment:

| Role   | Email                     |
|--------|---------------------------|
| Buyer  | arjun@example.com         |
| Dealer | farhan@primemotors.in     |
| Admin  | admin@trustdrive.in       |

Set `JWT_SECRET` in `backend/.env` to anything random before a real deployment.

**Creating your own real admin account** — there's no signup flow for
admin (intentionally — letting anyone self-register as admin would be a
serious hole), so it's done via a one-time CLI script instead:
```bash
cd backend
npm run create-admin
```
Follow the prompts (name, email, a real password — 12+ characters, and it'll
refuse the demo password). This requires `DATABASE_URL` to be set to real
Postgres first — it can't create a persistent account against the
in-memory demo store, since the script and your running server would each
have their own separate copy of the data. See "Using Supabase" above.
Already have a buyer/dealer account you'd rather promote instead of
creating a new one? The script does that too if the email already exists.

**2. Encryption for dealer KYC data (required before real dealer data)**
Dealer verification submissions (PAN, Aadhaar, bank details, document
content) are encrypted at rest with AES-256-GCM. The app runs fine without
this set — it falls back to an insecure development key and prints a loud
warning — but you must set a real key before any real dealer data touches
this app:
```bash
openssl rand -base64 32
```
Paste the output into `backend/.env` as `ENCRYPTION_KEY`. Store it in your
hosting provider's secret manager for any real deployment — losing this key
makes existing encrypted data permanently unrecoverable.

Rejected dealer applications have their encrypted KYC data purged
automatically (see `routes/verification.js` and `routes/dealers.js`) —
only the fact that an application was made and declined is kept, not the
documents themselves. See `/privacy` on the running site for the full
policy this implements.

**3. WhatsApp dealer-registration alerts (recommended)**
1. Set `ADMIN_WHATSAPP_NUMBER` in `backend/.env` to your own number
   (country code + digits, no `+` or spaces — e.g. `919876500000`).
2. That's it for the zero-cost path: whenever a dealer registers, they get a
   "Send documents on WhatsApp" button that opens a pre-filled chat to your
   number.
3. Optional — for it to happen automatically with no click required, sign up
   for [Meta's WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
   (free tier available) and set `WHATSAPP_ACCESS_TOKEN` +
   `WHATSAPP_PHONE_NUMBER_ID` in `backend/.env`.

**4. RC/VIN verification (optional)**
Works out of the box as a mock verifier. To use a real government-records
lookup, sign up with a provider (e.g. Surepass, Signzy, IDfy, Setu, or a
direct VAHAN integration if you have access), then set
`RC_VERIFICATION_API_URL` and `RC_VERIFICATION_API_KEY` in `backend/.env`.
Response formats differ by provider — you'll likely need to adjust
`parseProviderResponse()` in `backend/lib/rcVerification.js` to match yours.

## Dealer microsites (AI-generated, subdomain-hosted)

A verified dealer can generate their own branded microsite at
`/dealer/website` — describe a style in a prompt ("premium and minimal,
dark green and gold"), get a full page (hero, about, highlights, live
inventory, contact) generated from their real business data, edit anything,
then publish it to its own subdomain, e.g. `primemotors.trustdrive.in`.

**How the AI part works**
Set `ANTHROPIC_API_KEY` in `backend/.env` for real AI-written copy. Without
it, a deterministic template generator still produces a complete, on-brand
site using the dealer's real name/city/prompt keywords — the feature works
either way. Either path only ever produces plain text for a small, fixed
set of fields (headline, about text, etc.) — never raw HTML — so AI output
can't inject anything into a page served to the public. A dealer's actual
car listings are never AI-generated; they're always pulled live from real,
RC-verified inventory when the site renders.

**Testing subdomains locally**
Real subdomains need a real domain + wildcard DNS, which only exists once
you're deployed (see below). To test the actual subdomain routing on your
own machine first:

1. Generate and publish a site at `/dealer/website` — note the subdomain
   it's using (e.g. `prime-motors-hyderabad`).
2. Add a line to your hosts file mapping that subdomain to localhost:
   - **Mac/Linux**: `sudo nano /etc/hosts`, add a line:
     `127.0.0.1 prime-motors-hyderabad.localhost`
   - **Windows**: open Notepad as Administrator, open
     `C:\Windows\System32\drivers\etc\hosts`, add the same line.
3. Visit `http://prime-motors-hyderabad.localhost:5173` (same port as your
   normal dev server) — you should see the dealer's site, not the main app.

**Deploying for real**
Once you own a real domain and it's pointed at your hosting provider:
1. Add a wildcard DNS record: `*.yourdomain.com` → your frontend deployment.
   Check your host supports this — Vercel requires a paid plan for wildcard
   domains; some free tiers don't support it at all.
2. Set `VITE_PUBLIC_DOMAIN=yourdomain.com` in the frontend's environment.
3. That's it — the app detects the subdomain from the browser's hostname at
   runtime, no per-dealer deployment needed.



## What maps to what in the architecture diagram

| Diagram box                | Implementation                                      |
|-----------------------------|------------------------------------------------------|
| Buyer App / Website          | `frontend/` (React + Vite)                          |
| API Gateway                  | `backend/server.js` (CORS, JSON body parsing, a simple in-memory rate limiter, route mounting) |
| Authentication                | `backend/routes/auth.js` + `middleware/auth.js` (JWT), custom email/password |
| Dealer Service                | `backend/routes/dealers.js`                          |
| Vehicle Service               | `backend/routes/vehicles.js`                         |
| Search Service                | `backend/routes/search.js`                           |
| Verification Service          | `backend/routes/verification.js` + `backend/lib/rcVerification.js` (real API-key-based lookup, falls back to a mock when no key is set) |
| Lead Management Service       | `backend/routes/leads.js` (WhatsApp deep link generated per buyer enquiry) |
| Review Service                | `backend/routes/reviews.js`                          |
| Notification Service          | `backend/lib/whatsapp.js` — notifies you on WhatsApp when a dealer registers (auto via Meta Cloud API if configured, else a `wa.me` link) |
| Analytics Service             | `backend/routes/analytics.js`                        |
| Database Layer                | `backend/lib/store.js` — routes to `memoryStore.js` (default) or `prismaStore.js` + `prisma/schema.prisma` when `DATABASE_URL` is set |
| Dealer Dashboard              | `frontend/src/pages/DealerDashboard.jsx`             |
| Admin Dashboard               | `frontend/src/pages/AdminDashboard.jsx`              |
| *(new)* Dealer AI Microsites  | `backend/routes/dealerSites.js` + `backend/lib/aiSiteGenerator.js` (generation), `frontend/src/pages/DealerSiteBuilder.jsx` (editor), `frontend/src/components/microsite/` (public rendering + subdomain routing) |

## Notes on production-readiness

This is a working demo, not a production deployment:
- Postgres persistence is wired up via Prisma (see above) — the remaining gap is moving `leads`/`notifications` fan-out onto a real queue (SQS/Bull) as the diagram implies with a dedicated Notification Service, instead of a synchronous call.
- Auth is custom JWT + bcrypt (`routes/auth.js`), with brute-force lockout on login (`lib/loginThrottle.js` — 5 failed attempts locks out for 15 minutes, tracked by both email and IP). Still worth a managed auth provider (Clerk, Auth0, Supabase Auth) before real user volume, for password-reset flows and social login, which aren't built here.
- Dealer KYC data (PAN, Aadhaar, bank details, document content) is encrypted at rest with AES-256-GCM (`lib/encryption.js`) — set a real `ENCRYPTION_KEY` before any real dealer data touches this. Rejected applications have their KYC data purged automatically.
- RC/VIN verification is pluggable via `RC_VERIFICATION_API_KEY` — still defaults to a mock until you set one. Double-check `parseProviderResponse()` in `backend/lib/rcVerification.js` against your chosen provider's actual response shape before trusting it in production.
- Dealer/vehicle photos are stored as base64 data directly on the record — fine for a demo, but swap for real object storage (S3, or Supabase Storage since you're likely already on Supabase for the database) before you have real dealer volume, since it'll bloat your database.
- Add HTTPS termination and a real, Redis-backed rate limiter for production traffic.
