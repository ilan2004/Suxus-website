# SUXUS ERP — Daily Operations

The SUXUS Daily Operations Book (Excel), rebuilt as a web app for **erp.suxus.shop**.
Next.js 16 · shadcn/ui (Radix + Tailwind 4) · Drizzle ORM · PostgreSQL (Supabase).

## What works now (Phases 1–3)

| Area | What you get |
|---|---|
| **Login** | Each person picks their name and types a 4–6 digit PIN. *Partner* sees everything; *Staff* does daily entry. |
| **Dashboard** | Collected today, metres sold, open / overdue orders, balance to collect, 30-day income chart, deliveries due, low stock. |
| **Fabric Sales (POS)** | Scan barcode / type code → metres (quick buttons 1, 1.25, 1.6 …) → payment mode → **Save & print** 80 mm bill (TVS RP 3150). Stock warning, discount, Sold By, WhatsApp bill. |
| **Stitching Orders** | Shop fabric / outside fabric / alteration. Delivery date auto (+2 days, Express +1). Link a fabric bill (FS-…) — counted once. Advance + payments, deliver, **board view** (drag Booked → Cut → Stitching → Ready → Delivered), WhatsApp “ready for pickup”, printed bill. |
| **Customers** | Search by name / phone / code, profile with orders, bills, measurements, balance due. |
| **Measurements** | Fields change per garment (shirt, pant, churidar, blouse, frock …), “copy last”. |
| **Fabric Stock** | Auto codes (LIN-001, PV-002 …), sold & balance metres live from bills, stock value, **barcode labels** (50×25 mm). |
| **Staff** | Roles, pay type, piece rate, incentive %, app login + PIN. |
| **Settings** | Shop details on bills, every dropdown list, piece rates, fabric code prefixes, **Import Excel**. |
| **Bulk / Institution orders** | Schools, hospitals, companies. One line per size with a **size grid** helper (22, 24, 26 … in one go), advance + payments, discount, GST %, **A4 invoice** with amount in words, WhatsApp. |
| **Cash Book** | Every bill, order/bulk payment, purchase, supplier payment and wage payout is posted automatically. Add rent, electricity, capital introduced, owner withdrawal by hand. Running balance, opening/closing for any period, cash-in-hand, filters by category and mode. |
| **Purchases** | Supplier bills with qty × rate, GST 0/5/12/18 %, amount paid at purchase. |
| **Suppliers** | Phone / UPI / bank / GST with copy buttons, purchases, payments, setup-expense history, balance due, **Pay supplier**. |
| **Tailor Wages** | Pieces × piece rate (Settings → Piece rates, else the tailor's own rate). Finished orders without a wage entry are listed for one-click entry. Balance per tailor, **Pay tailor**. |

Coming next (Phase 4): Incentive, Setup Expenses, Opening Stock, Capital Account, Summary report, Excel export.

## Run it on a computer

```bash
cd erp
npm install
npm run dev            # http://localhost:3100
```

With no `DATABASE_URL`, the app uses a built-in local Postgres (PGlite) saved in `erp/.data/` — nothing to install.
The first visit opens **/setup** to create the first partner login. Then go to **Settings → Import Excel** and upload
`SUXUS-Daily-Operations-Book.xlsx` to bring in staff, suppliers, setup expenses, opening stock and all dropdown lists.

## Go live on erp.suxus.shop (Supabase + Vercel)

1. **Supabase** → New project (region *Mumbai*). Project Settings → Database → *Connection string* → copy the
   **Transaction pooler** URI (port 6543) and the **Session pooler / direct** URI (port 5432).
2. **Vercel** → Add New Project → import this GitHub repo → **Root Directory: `erp`**.
   Environment variables:
   - `DATABASE_URL` = transaction pooler URI
   - `DATABASE_URL_DIRECT` = session / direct URI (used only to create tables on deploy)
   - `ERP_SECRET` = a long random string (`openssl rand -hex 32`)
3. Deploy. Tables are created automatically (`vercel-build` runs the migrations, then builds).
4. Vercel → Settings → Domains → add `erp.suxus.shop`, then add the CNAME record it shows at your DNS provider.

Never paste the database password in chat or commit it — only in Vercel's environment variables.

## Moving to a Hostinger VPS later

The app only needs Node 22 and any PostgreSQL. On the VPS:

```bash
pg_dump "$SUPABASE_DIRECT_URL" --no-owner --no-acl -Fc -f suxus.dump      # from Supabase
pg_restore -d "$VPS_DATABASE_URL" --no-owner suxus.dump                   # into the VPS Postgres
```

Then set `DATABASE_URL` to the VPS database, `npm ci && npm run build && npm start` (port 3100) behind Nginx.

## Developer notes

- Schema: `src/lib/db/schema.ts` → `npm run db:generate` creates a migration in `drizzle/`.
- Defaults copied from the Excel “Lists” sheet: `src/lib/defaults.ts`. Measurement fields: `src/lib/measurements.ts`.
- Business rules from the Excel are kept: delivery date +2/+1, fabric bought for stitching is excluded from fabric income
  (counted in the order), stock = purchased − sold, numbering FS-0001 / SO-0001 / BO-0001.
- All changes are recorded in `audit_log` (who, what, when).
