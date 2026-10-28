import type { Metadata } from "next";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Photo } from "@/components/Photo";
import { PageHero, SectionHead } from "@/components/Site";
import { priceNote } from "@/lib/site";

export const metadata: Metadata = {
  title: "Hospital, Hotel & Corporate Uniforms — Malappuram",
  description:
    "Staff uniforms for hospitals, hotels, companies, colleges and madrasas near Pallikkal, Kondotty and Ramanattukara. Logo embroidery, repeat orders from recorded sizes, or stitching of your own fabric.",
  alternates: { canonical: "/institutional-uniforms/" },
};

const types = [
  { t: "Hospitals", d: "Doctors' coats, scrubs and nursing staff uniforms." },
  { t: "Hotels", d: "Front office, service and kitchen uniforms." },
  { t: "Corporate", d: "Office shirts and trousers in your colours." },
  { t: "Colleges & madrasas", d: "Student and staff uniforms, full supply or your fabric." },
];

export default function Institutional() {
  return (
    <>
      <PageHero
        index="03"
        label="Institutional & Corporate"
        title="Neat staff uniforms, ready to repeat."
        ml="ആശുപത്രി, ഹോട്ടൽ, സ്ഥാപനങ്ങൾക്ക് യൂണിഫോം."
      >
        <p>Uniforms for hospitals, hotels, companies, colleges and madrasas. Your logo on the pocket. Your sizes on file.</p>
      </PageHero>

      <section className="section paper">
        <div className="wrap">
          <SectionHead num="01" label="Who we stitch for" title="Uniform types." />
          <div className="cards four">
            {types.map((x, i) => (
              <article className="card" key={x.t}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{x.t}</h3>
                <p className="muted">{x.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid">
          <div className="c-6">
            <Photo src="/images/logo-embroidery.jpg" alt="Close-up of logo embroidery on a uniform pocket" caption="Logo embroidery" shape="square" />
          </div>
          <div className="c-5 s-8">
            <span className="label">02 / How it works</span>
            <ul className="ticks">
              <li>
                <strong>Logo embroidery.</strong> <span className="muted">Your institution&apos;s logo, stitched on the pocket.</span>
              </li>
              <li>
                <strong>Sizes kept on record.</strong>{" "}
                <span className="muted">Repeat orders and new joiners without re-measuring the whole team.</span>
              </li>
              <li>
                <strong>Fabric options.</strong> <span className="muted">Choose from our showroom, by shade and weight.</span>
              </li>
            </ul>
            <p className="note mt-m">{priceNote}.</p>
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <SectionHead num="03" label="Two ways to order" title="Full supply, or your own fabric." ml="തുണി ഞങ്ങൾ നൽകാം, അല്ലെങ്കിൽ നിങ്ങളുടെ തുണി തയ്ച്ചു നൽകാം." />
          <div className="cards two">
            <article className="card">
              <span className="num">A</span>
              <h3>Full supply</h3>
              <p className="muted">We source the fabric, stitch, embroider and deliver. One order, one point of contact.</p>
            </article>
            <article className="card">
              <span className="num">B</span>
              <h3>Stitching only</h3>
              <p className="muted">You supply the fabric. We cut, stitch and embroider to your recorded sizes.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section paper" id="enquiry">
        <div className="wrap">
          <SectionHead num="04" label="Enquiry" title="Tell us about your team." />
          <div className="grid">
            <div className="c-8 s-5">
              <EnquiryForm subject="Institutional uniform enquiry" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
