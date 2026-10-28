# SUXUS — Heritage Tailor website

Next.js (App Router) site for suxus.shop. Minimal Swiss layout in the SUXUS palette
(dark green #153D33, gold #C8A96A, cream). Exported as static HTML.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # writes the static site to ./out
npm run deploy  # build + publish to Cloudflare (wrangler.jsonc)
```

### Cloudflare

`wrangler.jsonc` serves `./out` as static assets. In Cloudflare's Git build settings use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

The `name` in `wrangler.jsonc` must match the Worker's name in the Cloudflare dashboard.

## Where to edit

| What | File |
| --- | --- |
| Phones, email, address, social links, map | `lib/site.ts` |
| Offer banner (Onam, Eid, reopening, weddings) | `offer` in `lib/site.ts` — set `active: true` |
| Pages | `app/<page>/page.tsx` |
| Styles | `app/globals.css` |

## Illustrations and animation

- **Rough.js** gives every illustration a hand-drawn look, like a tailor's chalk or pencil sketch
  (`lib/sketch.ts`). The sketch is generated at build time, so it is in the HTML and identical on every load.
- **GSAP** (with DrawSVG and ScrollTrigger) animates the lines being drawn as you scroll (`lib/gsap.ts`).

The illustration set lives in `components/illustrations/`: Shirt, Trousers, Coat, Waistcoat,
TieShirt, Cap, Hanger, FabricBolt, Scissors, NeedleThread, Spool, ChatBubble, Parcel.
Use one anywhere with `<Shirt />` etc. To add a new one, draw it with `<P d="…" i={n} />`
(lines), `<C>` (circles), `<Dot>` and `<Stitch>` (dashed seams) inside `<Illo>`; `i` is the drawing order.

- `StitchingShirt`: home hero. A tape measure unrolls, chalk sketches the pattern, a needle sews
  the outline, then the collar, pocket, buttons and SUXUS label are added. Has a Replay button.
- `SizeRack`: School Uniforms. Sample shirts in sizes 20–46 drop onto a rail and swing.
- `Seam` and `Reveal` (`components/Motion.tsx`): a stitch sewn across the page on scroll, and headings that fade up.

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
