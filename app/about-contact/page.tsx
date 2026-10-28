import type { Metadata } from "next";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Photo } from "@/components/Photo";
import { MapEmbed, PageHero, SectionHead } from "@/components/Site";
import { business, fullAddress } from "@/lib/site";

export const metadata: Metadata = {
  title: "About & Contact — Tailor at Pallikkal Bazar",
  description:
    "SUXUS, Heritage Tailor at Kadoor Complex, Pallikkal Bazar, Malappuram 673635. Call 98461 86713 or 95673 56072, WhatsApp, or email Info@suxus.shop.",
  alternates: { canonical: "/about-contact/" },
};

export default function AboutContact() {
  return (
    <>
      <PageHero index="06" label="About & Contact" title="A heritage tailor in Pallikkal." ml={business.malayalamLine}>
        <p>
          SUXUS grew from a cutting table. Today it is a stitching unit with its own tailors, and a fabric showroom in
          the same building.
        </p>
      </PageHero>

      <section className="section">
        <div className="wrap grid">
          <div className="c-3">
            <span className="label">01 / Story</span>
          </div>
          <div className="c-8">
            <p className="lead">
              Our cutting master, Krishnankutty, has spent about 35 years cutting cloth. That experience is the base of
              everything we make — a single shirt, or a thousand school uniforms.
            </p>
            <p className="mt-s">
              We stitch for families in and around Pallikkal, and for schools, hospitals, hotels, colleges and
              madrasas across Malappuram, Kondotty, Chelari and Ramanattukara.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead num="02" label="Team" title="The people you'll meet." />
          <div className="grid">
            <div className="c-4 person">
              <Photo src="/images/krishnankutty.jpg" alt="Krishnankutty, cutting master, at the cutting table" />
              <h3>Krishnankutty</h3>
              <p className="role">Cutting master</p>
              <p className="muted small">About 35 years of cutting experience. Looks after the stitching unit.</p>
              <p className="small">
                <a href={`tel:${business.phones[0].tel}`}>{business.phones[0].display}</a>
              </p>
            </div>
            <div className="c-4 person">
              <Photo src="/images/sahim.jpg" alt="Sahim KT" />
              <h3>Sahim KT</h3>
              <p className="role">Orders & institutions</p>
              <p className="muted small">Marketing, institutional orders and accounts.</p>
              <p className="small">
                <a href={`tel:${business.phones[1].tel}`}>{business.phones[1].display}</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section paper">
        <div className="wrap">
          <SectionHead num="03" label="Contact" title="Visit, call or message." ml="ഞങ്ങളെ ബന്ധപ്പെടുക." />
          <div className="grid">
            <div className="c-5">
              <dl className="contact-list">
                <div>
                  <dt>Address</dt>
                  <dd>{fullAddress}</dd>
                </div>
                <div>
                  <dt>Hours</dt>
                  {/* TODO: add confirmed shop hours */}
                  <dd>Call or WhatsApp for today&apos;s hours.</dd>
                </div>
                {business.phones.map((p) => (
                  <div key={p.tel}>
                    <dt>{p.role}</dt>
                    <dd>
                      <a href={`tel:${p.tel}`}>{p.display}</a> · {p.who}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener">
                      95673 56072
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <a href={`mailto:${business.email}`}>{business.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Social</dt>
                  <dd>
                    <a href={business.instagram} target="_blank" rel="noopener">
                      Instagram {business.instagramHandle}
                    </a>
                    <br />
                    <a href={business.facebook} target="_blank" rel="noopener">
                      Facebook — SUXUS Page
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Google</dt>
                  <dd>
                    <a href={business.googleProfile} target="_blank" rel="noopener">
                      SUXUS – Tailor, Kadoor Complex
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="c-6 s-7">
              <MapEmbed />
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="enquiry">
        <div className="wrap">
          <SectionHead num="04" label="Enquiry" title="Send us a message." />
          <div className="grid">
            <div className="c-8 s-5">
              <EnquiryForm subject="Enquiry" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
