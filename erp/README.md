# SUXUS ERP — Daily Operations

The SUXUS Daily Operations Book (Excel), rebuilt as a web app for **erp.suxus.shop**.
Next.js 16 · shadcn/ui (Radix + Tailwind 4) · Drizzle ORM · PostgreSQL (Supabase).

## What works now (all 4 phases)

| Area | What you get |
|---|---|
| **Login** | Each person picks their name and types a 4–6 digit PIN. *Partner* sees everything; *Staff* does daily entry. |
| **Dashboard** | Collected today, metres sold, open / overdue orders, balance to collect, 30-day income chart, deliveries due, low stock. |
| **Fabric Sales (POS)** | Scan barcode / type code → metres (quick buttons 1, 1.25, 1.6 …) → payment mode → **Save & print** 80 mm bill (TVS RP 3150). Stock warning, discount, Sold By, WhatsApp bill. |
| **Stitching Orders** | Shop fabric / outside fabric / alteration. Delivery date auto (+2 days, Express +1). Link a fabric bill (FS-…) — counted once. Advance + payments, deliver, **board view** (drag Booked → Cut → Stitching → Ready → Delivered), WhatsApp “ready for pickup”, printed bill. |
| **Customers** | Search by name / phone / code, profile with orders, bills, measurements, balance due. |
| **Measurements** | Fields change per garment (shirt, pant, churidar, blouse, frock …), “copy last”. |
| **Fabric photos** | Up to 4 per fabric (camera or gallery), resized on the phone to ≤1600 px WebP (~300 KB) + 300 px thumbnail, uploaded straight to Supabase Storage with progress and Retry; reorder / set main; thumbnails in lists and search; swipe + zoom viewer; Share on WhatsApp. |
| **Fabric Stock** | Auto codes (LIN-001, PV-002 …), sold & balance metres live from bills, stock value, **barcode labels** (50×25 mm). |
| **Staff** | Roles, pay type, piece rate, incentive %, app login + PIN. |
| **Settings** | Shop details on bills, every dropdown list, piece rates, fabric code prefixes, **Import Excel**. |
| **Bulk / Institution orders** | Schools, hospitals, companies. One line per size with a **size grid** helper (22, 24, 26 … in one go), advance + payments, discount, GST %, **A4 invoice** with amount in words, WhatsApp. |
| **Cash Book** | Every bill, order/bulk payment, purchase, supplier payment and wage payout is posted automatically. Add rent, electricity, capital introduced, owner withdrawal by hand. Running balance, opening/closing for any period, cash-in-hand, filters by category and mode. |
| **Purchases** | Supplier bills with qty × rate, GST 0/5/12/18 %, amount paid at purchase. |
| **Suppliers** | Phone / UPI / bank / GST with copy buttons, purchases, payments, setup-expense history, balance due, **Pay supplier**. |
| **Tailor Wages** | Pieces × piece rate (Settings → Piece rates, else the tailor's own rate). Finished orders without a wage entry are listed for one-click entry. Balance per tailor, **Pay tailor**. |

| **Setup Expenses** | Renovation, sign board, catalogues, supplier advances… by category, with “paid by” (partner or Business Account), bill received flag, negative amounts for returns. Business-paid items go to the cash book. |
| **Opening Stock & Assets** | Machines, tables, shelves and stock each partner brought in, with fair value. |
| **Capital Account** | Automatic: setup paid + assets brought + capital introduced per partner, share %, withdrawals, net capital. |
| **Incentive** | Per month: business brought (stitching + bulk + fabric sold) and money **collected**, slab rate or own %, incentive; record & pay (cash book). Slabs editable in Settings. |
| **Summary** | Any date range: income by type, running expenses, surplus, cash in/out, pending to collect / to pay, stock, setup, partner shares. Printable. |
| **Excel export / backup** | One click downloads every table as a sheet (same layout as the Daily Operations Book) — Summary page or Settings → Import / Backup. |

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

1. **Supabase** → project (region *Mumbai / ap-south-1*) → **Connect** (top bar) → copy two URIs and put your
   database password in place of `[YOUR-PASSWORD]` (if the password has `@ # / : ?` etc., reset it to letters+numbers):
   - **Transaction pooler** (port **6543**) → `DATABASE_URL`
   - **Session pooler** (port **5432**, host `…pooler.supabase.com`) → `DATABASE_URL_DIRECT`
     (do not use the “Direct connection” `db.xxx.supabase.co` one — Vercel cannot reach it)
2. **Vercel** → Add New → Project → import this repo → **Root Directory: `erp`** → Environment Variables:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | transaction pooler URI (6543) |
   | `DATABASE_URL_DIRECT` | session pooler URI (5432) |
   | `ERP_SECRET` | long random string (e.g. `openssl rand -hex 32`, or 40+ random letters/numbers) |
   | `ERP_SETUP_CODE` | any code you choose — asked once on the first-run screen |
   | `SUPABASE_SERVICE_ROLE_KEY` | for **fabric photos**: Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) or legacy `service_role`. The photo bucket `fabric-photos` is created automatically. |
3. Deploy. `vercel.json` runs the migrations (creates all tables, blocks Supabase's public Data API with RLS)
   and pins the server to Singapore (`sin1`), next to the Supabase database (ap-southeast-1). If the database region changes, change `regions` in `erp/vercel.json` to match.
4. Open the site → enter the setup code → create your partner login → Settings → Import / Backup → upload the Excel.
5. Vercel → Project → Settings → Domains → add `erp.suxus.shop`. In Cloudflare DNS (suxus.shop) add the
   **CNAME `erp`** record Vercel shows, with **Proxy status: DNS only** (grey cloud).

Never paste passwords or connection strings in chat or commit them — only in Vercel's Environment Variables.
Supabase free projects pause after 7 days without activity and have no downloadable backups — use
Settings → Import / Backup → Download .xlsx weekly.

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
