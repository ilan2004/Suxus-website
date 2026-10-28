import Link from "next/link";
import { Photo } from "@/components/Photo";
import { MapEmbed, SchoolSteps, SectionHead, WhatsAppButton } from "@/components/Site";
import { business, fullAddress } from "@/lib/site";

const services = [
  {
    n: "01",
    t: "Uniforms",
    ml: "യൂണിഫോം",
    d: "School, hospital, hotel, college, madrasa and company uniforms, stitched in bulk in our own unit. Your logo embroidered.",
    href: "/school-uniforms/",
    link: "School uniforms",
  },
  {
    n: "02",
    t: "Fabrics",
    ml: "തുണിത്തരങ്ങൾ",
    d: "Shirting, linen and suiting fabrics in our new showroom. Choose one shade at a time, in daylight.",
    href: "/tailoring-fabrics/",
    link: "See the showroom",
  },
  {
    n: "03",
    t: "Tailoring",
    ml: "തയ്യൽ",
    d: "Gents shirts and trousers, alterations, wedding group dress and festival dress codes. Cut by hand.",
    href: "/tailoring-fabrics/",
    link: "Tailoring",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap grid">
          <div className="c-7">
            <span className="label">Pallikkal Bazar · Malappuram</span>
            <h1>
              SUXUS
              <span className="visually-hidden"> — Heritage Tailor, uniforms and fabrics in Pallikkal, Malappuram</span>
            </h1>
            <p className="lead mt-s">
              Heritage Tailor. About 35 years at the cutting table. Uniforms, fabrics and tailoring under one roof.
            </p>
            <p className="ml-line" lang="ml">
              {business.malayalamLine}
            </p>
            <p className="services-strip">{business.strip}</p>
            <div className="actions">
              <Link className="btn" href="/school-uniforms/#enquiry">
                Uniform enquiry
              </Link>
              <WhatsAppButton className="btn ghost" />
            </div>
          </div>
          <div className="c-5 hero-figure">
            <Photo src="/images/showroom.jpg" alt="The SUXUS fabric showroom at Kadoor Complex" caption="The showroom" priority />
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="wrap">
          <SectionHead num="01" label="What we do" title="Three things, done carefully." ml="മൂന്ന് കാര്യങ്ങൾ, ശ്രദ്ധയോടെ." />
          <div className="cards">
            {services.map((s) => (
              <article className="card" key={s.t}>
                <span className="num">{s.n}</span>
                <h3>{s.t}</h3>
                <p className="ml-line" lang="ml">
                  {s.ml}
                </p>
                <p className="muted">{s.d}</p>
                <Link className="arrow-link" href={s.href}>
                  {s.link}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <SectionHead
            num="02"
            label="For schools"
            title="School uniforms in four steps."
            ml="നാല് ഘട്ടങ്ങളിൽ സ്കൂൾ യൂണിഫോം."
          />
          <SchoolSteps />
          <div className="grid mt-m">
            <div className="c-6">
              <p className="note">
                No individual measuring. Sizes are fixed at a free camp with sample garments, then kept on record for
                next year.
              </p>
            </div>
            <div className="c-6">
              <Link className="btn gold" href="/school-uniforms/">
                How the size-fixing camp works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap grid">
          <div className="c-6">
            <Photo src="/images/fabric-cubes.jpg" alt="Fabric display cubes in the SUXUS showroom" caption="Fabric display" />
          </div>
          <div className="c-5 s-8">
            <span className="label">03 / The showroom</span>
            <h2>Come and feel the cloth.</h2>
            <p className="ml-line" lang="ml">
              ഷോറൂം സന്ദർശിക്കൂ.
            </p>
            <p className="mt-s">
              Our new fabric showroom sits in the same building as the stitching unit. Pick a shirting or suiting
              fabric, and our cutting master takes it from there.
            </p>
            <p className="muted small">Price confirmed on enquiry — fabric rates change through the year.</p>
            <Link className="arrow-link mt-s" href="/tailoring-fabrics/">
              Tailoring and fabrics
            </Link>
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="wrap">
          <SectionHead num="04" label="Find us" title="Kadoor Complex, Pallikkal Bazar." />
          <MapEmbed />
          <div className="grid mt-s">
            <p className="c-6 muted small">{fullAddress}</p>
            <p className="c-6 small">
              <a className="arrow-link" href={business.googleProfile} target="_blank" rel="noopener">
                Open in Google Maps
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
