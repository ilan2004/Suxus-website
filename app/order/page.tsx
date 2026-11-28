import type { Metadata } from "next";
import { OrderWizard } from "@/components/OrderWizard";
import { PageHero } from "@/components/Site";

export const metadata: Metadata = {
  title: "Order a shirt or pant online — measured from your own garment",
  description:
    "Choose a fabric from the SUXUS showroom, measure your best-fitting shirt or pant at home with our picture guide, and we stitch it and send it by courier. Pallikkal Bazar, Malappuram.",
  alternates: { canonical: "/order/" },
};

export default function OrderPage() {
  return (
    <>
      <PageHero index="07" label="Order online" title="Your perfect fit, from the shirt you already love." ml="നിങ്ങൾക്ക് ഇഷ്ടമുള്ള ഷർട്ടിന്റെ അളവിൽ പുതിയത്.">
        <p>Pick our fabric, measure your best-fitting shirt or pant laid flat — our picture guide shows every step — and we stitch it and send it by courier.</p>
      </PageHero>
      <section className="section paper">
        <div className="wrap">
          <OrderWizard />
        </div>
      </section>
    </>
  );
}
