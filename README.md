# RISX.Offshore

RISX is a crypto-based challenge gaming prototype with a static frontend, Vercel serverless API routes, Supabase-backed payment/run storage, and NOWPayments checkout flow.

This is a first generation challenge based loosely off the famous prop firm challenges and the blown up ego of crypto gamers that claim they can go from a few cents to thousands. This challenge integrates decision making, high stress, skill, and tests and challenges your own psychological temptains. The system and challenge parameters are set to lay on top of original games and integrate with crypto casinos. 


///////RISX ENGINE AND CASINO PLATFORM FOR SALE////////

RISX engine + custom built platform thats ready to launch is for sale, full site + assets and etc. system is working, automatic payments and token minting, admin panel and active logging, crypto payments + entry token minting, etc etc. Its ready to go live. I am not able to launch due to crypto gaming being illegal in my location.  i will give integration or launch help with licensing or buy out. 

Reach me here for buyout/licensing or play through ---> risx.main@gmail.com

White-label resale rights included.

## Stack

- Frontend: plain HTML/CSS/JS
- Hosting: Vercel
- Server routes: `api/*.js`
- Database: Supabase
- Payments: NOWPayments
- Build output: `dist/`

## Full Deploy Steps

### 1. Clone and install

```bash
npm install
```

### 2. Create a Supabase project

Create a new Supabase project and keep:

- Project URL
- Anon/public key
- Service role key

### 3. Apply the schema migration

Run the SQL from:

- [supabase/migrations/20260403_soft_launch.sql](/Users/topdawg/Desktop/RISX.Offshore/supabase/migrations/20260403_soft_launch.sql)

You can apply it in the Supabase SQL editor or through the Supabase CLI if you use one.

### 4. Create a NOWPayments account

From NOWPayments, collect:

- API key
- IPN/webhook secret

Set your webhook endpoint to:

```text
https://YOUR-DOMAIN/api/payment-webhook
```

If you want the provider to send an explicit callback URL on invoice creation, also set `NOWPAYMENTS_IPN_CALLBACK_URL` to the same URL.

### 5. Configure Vercel project

Import this repo into Vercel.

This project uses:

- Build command: `npm run build`
- Output directory: `dist`

That config already exists in [vercel.json](/Users/topdawg/Desktop/RISX.Offshore/vercel.json).

### 6. Add environment variables in Vercel

Add the server-side secrets listed in the `Environment Variables` section below.

### 7. Set frontend Supabase runtime values

The browser app expects public Supabase runtime values before `app.js` loads. Right now [challenge.html](/Users/topdawg/Desktop/RISX.Offshore/challenge.html:1043) includes hardcoded `window.RISX_SUPABASE_URL` and `window.RISX_SUPABASE_ANON_KEY`.

Before production launch, replace those values with your own project values or inject them during your build/deploy process.

Required browser runtime values:

- `window.RISX_SUPABASE_URL`
- `window.RISX_SUPABASE_ANON_KEY`

### 8. Deploy

Deploy from Vercel UI or CLI. After deploy:

1. Open the landing page
2. Open `challenge.html`
3. Create a payment
4. Confirm webhook delivery
5. Verify payment recovery and restart flow
6. Test admin login

### 9. Post-deploy smoke test

Recommended minimum test pass:

1. Create a new payment ID
2. Verify unlock
3. Start a run
4. Play a few rounds
5. Refresh and confirm balance persists
6. Close and reopen browser tab and confirm run recovery
7. Fail a run and verify restart pricing
8. Verify a paid-but-consumed payment ID resumes correctly
9. Submit a claim from a winning run

## Supabase Schema Notes

The migration creates a soft-launch authoritative storage model. Main tables:

- `payments`: one row per payment attempt/invoice
- `runs`: challenge runs, current state, result, metadata
- `claims`: payout claim records for winning runs
- `unlock_tokens`: one-time unlock token consumption ledger
- `admin_audit`: admin action audit trail
- `idempotency_keys`: request dedupe for create-payment flow

Important schema behavior:

- `payments.payment_id` is unique when present
- `payments.order_id` is unique
- `runs.run_id` is unique
- `runs.payment_id` has a unique partial index for non-empty values
- `claims.run_id` is unique, so one claim per run
- `unlock_tokens.jti` is unique
- Browser roles are denied write access to authoritative tables by RLS
- Server routes use the Supabase service role for writes

Run state is stored primarily in:

- `runs.status`
- `runs.metadata`
- `unlock_tokens.metadata`

Current recovery logic uses `runs` plus consumed `unlock_tokens` metadata to rebuild resume state when local browser storage is missing.

## Environment Variables

Set these in Vercel.

### Required

- `SUPABASE_URL`
  Supabase project URL used by server routes.

- `SUPABASE_SERVICE_ROLE_KEY`
  Service role key used by server routes for authoritative writes.

- `NOWPAYMENTS_API_KEY`
  NOWPayments API key used to create and verify payments.

- `NOWPAYMENTS_IPN_SECRET`
  Secret used to validate NOWPayments webhook signatures.

- `RISX_ADMIN_KEY_CURRENT`
  Signing key for unlock tokens and resume tokens.

- `ADMIN_TOKEN`
  Secret used by admin session/auth helpers.

- `ADMIN_PASSWORD_HASH`
  Admin password hash in the format expected by [api/admin/_auth.js](/Users/topdawg/Desktop/RISX.Offshore/api/admin/_auth.js:63):
  `scrypt:<salt>:<hexDigest>`

### Optional but Recommended

- `RISX_ADMIN_KEY_PREVIOUS`
  Previous signing key used during key rotation so older tokens can still validate during rollout.

- `NOWPAYMENTS_IPN_CALLBACK_URL`
  Explicit callback URL included in payment creation requests.
  Example:
  `https://YOUR-DOMAIN/api/payment-webhook`

- `RISX_SUPABASE_URL`
  Alternate server-side fallback for Supabase URL if you do not use `SUPABASE_URL`.

### Notes

- Server-side Supabase lookup falls back through `SUPABASE_URL`, `RISX_SUPABASE_URL`, and some framework-style alternatives in [api/_supabaseAdmin.js](/Users/topdawg/Desktop/RISX.Offshore/api/_supabaseAdmin.js:7).
- Browser-side Supabase config is not read from Vercel server env automatically. It must be injected into the page.

## Tier Config

Tier config currently lives in [app.js](/Users/topdawg/Desktop/RISX.Offshore/app.js:744) and payment pricing mirrors it in [api/create-payment.js](/Users/topdawg/Desktop/RISX.Offshore/api/create-payment.js:4).

Current tier values:

### `beginner`

- Entry: `$10`
- Restart: `$7`
- Prize: `$65`
- Start credits: `250`
- Goal credits: `10,000`
- Mercy all-in threshold: `50`
- Mines max bet: `15%`
- Crash max bet: `15%`
- Plinko max bet: `15%`
- Mines minimum count: `3`
- Mines max cashout multiplier: `8`
- Plinko max multiplier: `40`

### `intermediate`

- Entry: `$25`
- Restart: `$18`
- Prize: `$175`
- Start credits: `500`
- Goal credits: `25,000`
- Mercy all-in threshold: `75`
- Mines max bet: `12%`
- Crash max bet: `12%`
- Plinko max bet: `15%`
- Mines minimum count: `4`
- Mines max cashout multiplier: `7.5`
- Plinko max multiplier: `30`

### `pro`

- Entry: `$50`
- Restart: `$35`
- Prize: `$1,000`
- Start credits: `750`
- Goal credits: `50,000`
- Mercy all-in threshold: `100`
- Mines max bet: `12%`
- Crash max bet: `12%`
- Plinko max bet: `20%`
- Mines minimum count: `5`
- Mines max cashout multiplier: `6`
- Plinko max multiplier: `25`
- Locked by default: `true`
- Lock reason: `Invite Only`

### If you change tier pricing

Keep these in sync:

- [app.js](/Users/topdawg/Desktop/RISX.Offshore/app.js:744) for gameplay and UI
- [api/create-payment.js](/Users/topdawg/Desktop/RISX.Offshore/api/create-payment.js:4) for invoice pricing

If you change only one side, checkout pricing and game rules will drift.

## Admin Notes

Admin functions include:

- Admin login/logout
- Key status check
- Key rotation verification
- Manual minting
- Claim review actions

Relevant files:

- [api/admin/_auth.js](/Users/topdawg/Desktop/RISX.Offshore/api/admin/_auth.js)
- [api/admin/_mint.js](/Users/topdawg/Desktop/RISX.Offshore/api/admin/_mint.js)
- [api/admin/status.js](/Users/topdawg/Desktop/RISX.Offshore/api/admin/status.js)
- [api/admin/rotate-key.js](/Users/topdawg/Desktop/RISX.Offshore/api/admin/rotate-key.js)

## Recovery / Persistence Notes

Current architecture is improved but not yet fully server-authoritative.

What is persisted today:

- Payment records in Supabase
- Run records in Supabase
- Consumed unlock token recovery metadata in Supabase
- Local browser run mirror for faster reload/reopen recovery

Operationally important limitation:

- If the latest client balance never syncs to the server before the user clears site data, recovery can only restore the most recent server-known balance.

## Build

Build locally with:

```bash
npm run build
```

The build:

1. Creates `dist/`
2. Copies HTML and CSS
3. Minifies `app.js` and `payments.js`
4. Rewrites HTML to use minified assets

## Upgrade Reminder

When the deployment plan is upgraded, split token-consume logic back out of [`/api/verify-token`](/Users/topdawg/Desktop/RISX.Offshore/api/verify-token.js) into a dedicated `/api/unlock-consume` route for cleaner API separation.
