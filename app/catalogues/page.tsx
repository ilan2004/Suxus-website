import type { Metadata } from "next";
import { DownloadIcon } from "@/components/Icons";
import { PageHero, WhatsAppButton } from "@/components/Site";

export const metadata: Metadata = {
  title: "Catalogues — Uniforms, Work-wear & Suiting",
  description:
    "Download SUXUS catalogues: the main SUXUS catalogue, work-wear, plain and suiting fabrics, and school-wear. Heritage Tailor, Pallikkal, Malappuram.",
  alternates: { canonical: "/catalogues/" },
};

// Put the PDF files in public/catalogues/ with these names.
const catalogues = [
  { t: "SUXUS Catalogue", d: "The full range — uniforms, fabrics and tailoring. Version 2.", file: "suxus-catalogue-v2.pdf" },
  { t: "Work-wear", d: "Hospital, hotel and corporate staff uniforms.", file: "suxus-workwear.pdf" },
  { t: "Plain & Suiting", d: "Shirting, linen and suiting fabrics.", file: "suxus-plain-suiting.pdf" },
  { t: "School-wear", d: "School uniform styles, sizes 20–46.", file: "suxus-schoolwear.pdf" },
];

export default function Catalogues() {
  return (
    <>
      <PageHero index="05" label="Catalogues" title="Catalogues to download." ml="കാറ്റലോഗുകൾ ഡൗൺലോഡ് ചെയ്യാം.">
        <p>PDF catalogues to share with your committee or management. Prices are confirmed on enquiry.</p>
      </PageHero>

      <section className="section">
        <div className="wrap grid">
          <div className="c-8 s-5">
            <ul className="downloads">
              {catalogues.map((c, i) => (
                <li key={c.file}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{c.t}</h3>
                  <p className="muted small">{c.d}</p>
                  <a className="btn ghost" href={`/catalogues/${c.file}`} download>
                    <DownloadIcon />
                    PDF
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-m muted">Prefer it on your phone? We can send any catalogue on WhatsApp.</p>
            <div className="mt-s">
              <WhatsAppButton label="Send me a catalogue" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
