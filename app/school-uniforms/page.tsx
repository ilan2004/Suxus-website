import type { Metadata } from "next";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Photo } from "@/components/Photo";
import { PageHero, SchoolSteps, SectionHead } from "@/components/Site";
import { priceNote, priceNoteMl } from "@/lib/site";

export const metadata: Metadata = {
  title: "School Uniforms in Malappuram — Size-Fixing Camp",
  description:
    "School uniform stitching for Pallikkal, Malappuram, Kondotty and Chelari. Free size-fixing camp with sample garments in sizes 20–46, embroidered school logo, delivery before reopening.",
  alternates: { canonical: "/school-uniforms/" },
};

const provide = [
  ["Sample garments in sizes 20–46", "LKG to Plus Two, brought to your school."],
  ["Sizes kept on record", "Next year's order starts from this year's list."],
  ["Fabric options", "Shirting and bottom fabrics in your school colours."],
  ["Embroidered school logo", "Your crest stitched on the pocket or sleeve."],
  ["Delivery before reopening", "We plan the stitching around your calendar."],
];

export default function SchoolUniforms() {
  return (
    <>
      <PageHero index="02" label="School Uniforms" title="Right sizes, before reopening." ml="സ്കൂൾ യൂണിഫോം — സ്കൂൾ തുറക്കുന്നതിന് മുമ്പ്.">
        <p>
          We run a free size-fixing camp at your school. Children try on sample garments, sizes are fixed, and
          everything is stitched in our own unit.
        </p>
      </PageHero>

      <section className="section paper">
        <div className="wrap grid">
          <div className="c-5">
            <Photo src="/images/uniforms-hangers.jpg" alt="Finished school uniforms on hangers" caption="Finished uniforms" />
          </div>
          <div className="c-6 s-7">
            <span className="label">01 / The size-fixing camp</span>
            <h2>No tape measure. Just samples.</h2>
            <p className="ml-line" lang="ml">
              ഓരോ കുട്ടിയെയും അളക്കേണ്ടതില്ല. സാമ്പിൾ ഇട്ടുനോക്കി സൈസ് ഉറപ്പിക്കാം.
            </p>
            <p className="mt-s">
              We bring a full set of sample garments in sizes 20 to 46, covering LKG to Plus Two. Each child tries
              them on, the right size is noted against their name, and the list is kept on record.
            </p>
            <p>It is quicker for the school, easier for the children, and the fit is checked on the body.</p>
            <dl className="facts mt-m">
              <div>
                <dt>Sizes</dt>
                <dd>20–46</dd>
              </div>
              <div>
                <dt>Classes</dt>
                <dd>LKG–+2</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="wrap">
          <SectionHead num="02" label="Process" title="Four steps, from enquiry to delivery." ml="നാല് ഘട്ടങ്ങൾ." />
          <SchoolSteps />
        </div>
      </section>

      <section className="section">
        <div className="wrap grid">
          <div className="c-3">
            <span className="label">03 / What you get</span>
          </div>
          <div className="c-8">
            <ul className="ticks">
              {provide.map(([t, d]) => (
                <li key={t}>
                  <strong>{t}.</strong> <span className="muted">{d}</span>
                </li>
              ))}
            </ul>
            <p className="note mt-m">
              {priceNote}. Fabric rates change, so we confirm the price once fabric and quantity are fixed.{" "}
              <span lang="ml">{priceNoteMl}.</span>
            </p>
          </div>
        </div>
      </section>

      <section className="section paper" id="enquiry">
        <div className="wrap">
          <SectionHead num="04" label="Enquiry" title="Book a size-fixing camp." ml="സൈസ് ഫിക്സിങ് ക്യാമ്പ് ബുക്ക് ചെയ്യൂ." />
          <div className="grid">
            <div className="c-8 s-5">
              <EnquiryForm subject="School uniform enquiry" defaultType="School" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
