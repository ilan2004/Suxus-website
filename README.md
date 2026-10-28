# SUXUS — Heritage Tailor website

Next.js (App Router) site for suxus.shop. Minimal Swiss layout in the SUXUS palette
(dark green #153D33, gold #C8A96A, cream). Exported as static HTML.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # writes the static site to ./out — upload that folder to the host
```

## Where to edit

| What | File |
| --- | --- |
| Phones, email, address, social links, map | `lib/site.ts` |
| Offer banner (Onam, Eid, reopening, weddings) | `offer` in `lib/site.ts` — set `active: true` |
| Pages | `app/<page>/page.tsx` |
| Styles | `app/globals.css` |

## Illustrations and animation

Animation uses [Motion](https://motion.dev) (`motion/react`). The line illustrations are the
site's own set in `components/illustrations/` — Shirt, Trousers, Coat, Waistcoat, TieShirt,
Cap, Hanger, FabricBolt, Scissors, NeedleThread, Spool, ChatBubble, Parcel — each draws itself
in when scrolled into view. Use one anywhere with `<Shirt />` etc.

- `StitchingShirt` — home hero: tape measure, chalk outline, a needle sewing the shirt, then
  collar, pocket, buttons and the SUXUS label. Has a Replay button.
- `SizeRack` — School Uniforms: sample shirts in sizes 20–46 swing onto a rail.
- `Seam` (in `components/Motion.tsx`) — a stitch sewn across the page above the closing WhatsApp band.

Visitors who turn on "reduce motion" on their phone see the finished drawings without animation.

## Photos and catalogues

Pages show labelled placeholders until the real files exist:

- `public/images/`: `showroom.jpg`, `fabric-cubes.jpg`, `fabric-detail.jpg`, `uniforms-hangers.jpg`,
  `logo-embroidery.jpg`, `tailors-at-work.jpg`, `cutting-table.jpg`, `krishnankutty.jpg`, `sahim.jpg`
  (compress to roughly 200 KB each for fast loading on 4G).
- `public/catalogues/`: `suxus-catalogue-v2.pdf`, `suxus-workwear.pdf`, `suxus-plain-suiting.pdf`, `suxus-schoolwear.pdf`.

## Still to fill in

- Exact Facebook Page URL (`business.facebook` in `lib/site.ts`).
- Shop hours (About & Contact page).
- Google Analytics / Search Console tag once the domain is live.

Site rules from the brief: no fixed prices, no individual measuring for school children,
no supplier names, no branded garments for sale.
