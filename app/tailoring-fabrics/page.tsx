import type { Metadata } from "next";
import { Hanger, Scissors, Trousers } from "@/components/illustrations";
import { Photo } from "@/components/Photo";
import { PageHero, SectionHead, WhatsAppButton } from "@/components/Site";
import { priceNote, waLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gents Tailoring & Fabrics in Pallikkal",
  description:
    "Gents shirts and trousers, linen, shirting and suiting fabrics, alterations, wedding group dress, Onam dress codes and event T-shirts. Tailor at Pallikkal Bazar, Malappuram.",
  alternates: { canonical: "/tailoring-fabrics/" },
};

const tailoring = [
  { Icon: Trousers, t: "Shirts & trousers", d: "Gents shirts and trousers, cut by our cutting master." },
  { Icon: Scissors, t: "Alterations", d: "Length, fit and small repairs on garments you already own." },
  { Icon: Hanger, t: "Wedding group dress", d: "Matching outfits for the wedding party, in one shade." },
];

export default function TailoringFabrics() {
  return (
    <>
      <PageHero index="04" label="Tailoring & Fabrics" title="Good cloth, cut well." ml="തയ്യലും തുണിത്തരങ്ങളും.">
        <p>Choose your fabric in our showroom. Our tailors stitch it in the same building.</p>
      </PageHero>

      <section className="section paper">
        <div className="wrap grid">
          <div className="c-5">
            <span className="label">01 / Fabrics</span>
            <h2>One shade at a time.</h2>
            <p className="mt-s">
              Shirting, linen and suiting fabrics, displayed so you can see each shade on its own — not lost in a
              crowded rack.
            </p>
            <p className="muted small">{priceNote}. Fabric rates change through the year.</p>
          </div>
          <div className="c-6 s-7">
            <Photo src="/images/fabric-cubes.jpg" alt="Shirting and suiting fabrics in display cubes" caption="Shirting, linen & suiting" shape="wide" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead num="02" label="Tailoring" title="Stitched in our own unit." ml="ഞങ്ങളുടെ സ്വന്തം യൂണിറ്റിൽ തയ്ച്ചത്." />
          <div className="cards">
            {tailoring.map((x, i) => (
              <article className="card" key={x.t}>
                <x.Icon />
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{x.t}</h3>
                <p className="muted">{x.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark" id="festival">
        <div className="wrap grid">
          <div className="c-6">
            <span className="label">03 / Festivals & events</span>
            <h2>Dress codes for Onam, Eid and every group.</h2>
            <p className="ml-line" lang="ml">
              ഓണം, പെരുന്നാൾ, ഇവന്റുകൾ — ഗ്രൂപ്പ് ഡ്രസ്സ്.
            </p>
          </div>
          <div className="c-5 s-8">
            <ul className="ticks">
              <li>
                <strong>Festival dress codes.</strong> Onam and Eid sets for families and offices.
              </li>
              <li>
                <strong>Event T-shirts.</strong> For clubs, tournaments and organisers.
              </li>
            </ul>
            <div className="actions mt-m">
              <a
                className="btn gold"
                href={waLink("SUXUS | Heritage Tailor — I need a quick quote for group dress / event T-shirts.")}
                target="_blank"
                rel="noopener"
              >
                Quick quote on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="wrap">
          <SectionHead num="04" label="Gallery" title="From the showroom and the unit." />
          <div className="gallery">
            <Photo src="/images/showroom.jpg" alt="SUXUS showroom" caption="Showroom" />
            <Photo src="/images/tailors-at-work.jpg" alt="Tailors at work in the SUXUS stitching unit" caption="Stitching unit" />
            <Photo src="/images/cutting-table.jpg" alt="Krishnankutty at the cutting table" caption="Cutting table" />
            <Photo src="/images/fabric-detail.jpg" alt="Fabric detail" caption="Fabric" />
            <Photo src="/images/logo-embroidery.jpg" alt="Logo embroidery close-up" caption="Embroidery" />
          </div>
          <div className="mt-m">
            <WhatsAppButton label="Ask about a fabric" />
          </div>
        </div>
      </section>
    </>
  );
}
