import Link from "next/link";
import type { ReactNode } from "react";
import { business, fullAddress, nav, offer, waLink } from "@/lib/site";
import { PhoneIcon, WhatsAppIcon } from "./Icons";
import { Brand } from "./Logo";

export function OfferBanner() {
  if (!offer.active) return null;
  return (
    <div className="offer" role="note">
      {offer.text} {offer.href && <Link href={offer.href}>{offer.linkText}</Link>}
    </div>
  );
}

export function WhatsAppButton({ label = "Chat on WhatsApp", className = "btn" }) {
  return (
    <a className={className} href={waLink()} target="_blank" rel="noopener">
      <WhatsAppIcon />
      {label}
    </a>
  );
}

export function CallButton({ index = 1, className = "btn ghost" }) {
  const p = business.phones[index];
  return (
    <a className={className} href={`tel:${p.tel}`}>
      <PhoneIcon />
      Call {p.display}
    </a>
  );
}

export function WhatsAppFloat() {
  return (
    <a className="wa-float" href={waLink()} target="_blank" rel="noopener" aria-label="Chat with SUXUS on WhatsApp">
      <WhatsAppIcon />
      <span>WhatsApp</span>
    </a>
  );
}

/* Every page ends with this: WhatsApp plus both phone numbers. */
export function CtaBand() {
  return (
    <section className="cta-band" aria-labelledby="cta-title">
      <div className="wrap grid">
        <div className="c-7">
          <span className="label">Talk to us</span>
          <h2 id="cta-title">Most questions are answered on WhatsApp.</h2>
          <p className="ml-line" lang="ml">
            വാട്സ്ആപ്പിൽ ഒരു മെസ്സേജ് അയക്കൂ — ഞങ്ങൾ മറുപടി നൽകും.
          </p>
        </div>
        <div className="c-5">
          <div className="actions">
            <WhatsAppButton className="btn gold" />
            <CallButton className="btn ghost" />
          </div>
          <p className="phones">
            {business.phones.map((p, i) => (
              <span key={p.tel}>
                {i > 0 && <br />}
                {p.who} ({p.role.toLowerCase()}): <a href={`tel:${p.tel}`}>{p.display}</a>
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="grid">
          <div className="c-4">
            <Brand />
            <p>{business.strip}</p>
            <p className="ml" lang="ml">
              {business.malayalamLine}
            </p>
          </div>
          <div className="c-3">
            <h3>Pages</h3>
            <ul>
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="c-3">
            <h3>Visit</h3>
            <address style={{ fontStyle: "normal" }}>
              Kadoor Complex
              <br />
              Pallikkal Bazar, Pallikkal
              <br />
              Malappuram, Kerala 673635
            </address>
            <p className="mt-s">
              <a href={business.googleProfile} target="_blank" rel="noopener">
                Google Maps →
              </a>
            </p>
          </div>
          <div className="c-2">
            <h3>Contact</h3>
            <ul>
              {business.phones.map((p) => (
                <li key={p.tel}>
                  <a href={`tel:${p.tel}`}>{p.display}</a>
                </li>
              ))}
              <li>
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </li>
              <li>
                <a href={business.instagram} target="_blank" rel="noopener">
                  Instagram
                </a>
              </li>
              <li>
                <a href={business.facebook} target="_blank" rel="noopener">
                  Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} SUXUS · Heritage Tailor</span>
          <span>{fullAddress}</span>
        </div>
      </div>
    </footer>
  );
}

export function PageHero({
  index,
  label,
  title,
  ml,
  children,
}: {
  index: string;
  label: string;
  title: ReactNode;
  ml?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div className="wrap grid">
        <div className="c-3">
          <span className="label">
            {index} — {label}
          </span>
        </div>
        <div className="c-8">
          <h1>{title}</h1>
          {ml && (
            <p className="ml-line" lang="ml">
              {ml}
            </p>
          )}
          {children && <div className="lead">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ num, label, title, ml }: { num: string; label: string; title: ReactNode; ml?: string }) {
  return (
    <div className="grid sec-head">
      <div className="c-3">
        <span className="label">
          {num} / {label}
        </span>
      </div>
      <div className="c-8">
        <h2>{title}</h2>
        {ml && (
          <p className="ml-line" lang="ml">
            {ml}
          </p>
        )}
      </div>
    </div>
  );
}

export function SchoolSteps() {
  const steps = [
    { t: "Enquiry", d: "Call or WhatsApp us with your school name and student numbers." },
    { t: "Free size-fixing camp", d: "We bring sample garments to your school. Children try them on." },
    { t: "Fabric and price confirmed", d: "You choose the fabric. We confirm the price in writing." },
    { t: "Stitched and delivered", d: "Uniforms are stitched in our unit and delivered before reopening." },
  ];
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.t}>
          <h3>{s.t}</h3>
          <p className="muted small">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

export function MapEmbed() {
  return (
    <div className="map">
      <iframe
        src={business.mapEmbed}
        title="SUXUS at Kadoor Complex, Pallikkal Bazar on Google Maps"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
