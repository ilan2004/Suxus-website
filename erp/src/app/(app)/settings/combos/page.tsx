import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { features } from "@/lib/db/features";
import { comboSettingsRows, pantMetres } from "@/lib/combo-server";
import { PageHeader } from "@/components/app/page-header";
import { CombosView } from "./combos-view";

export const metadata = { title: "Combinations" };

/** Settings → Combinations: trouser suggestions for a shirt fabric — on / off, slow-moving stock, per-fabric corrections. Partners only. */
export default async function CombosSettingsPage() {
  await requireUser({ can: "prices" });
  const feat = await features();
  const [controls, rows, req] = await Promise.all([getSetting("combo"), comboSettingsRows(), getSetting("fabricRequirement")]);
  return (
    <>
      <PageHeader
        title="Combinations"
        ml="ഷർട്ട് + പാൻറ്റ് കോംബോ"
        description="When a customer picks a shirt fabric, 2–3 trouser fabrics from our stock that go with it. Colour rules only — no AI, no cost."
      />
      <CombosView controls={controls} rows={rows} ready={feat.combo} minMtr={pantMetres(req)} />
    </>
  );
}
