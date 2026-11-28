"use client";

import { useEffect, useState } from "react";
import { MeasureDiagram } from "@/components/MeasureDiagram";
import { ERP_URL, waLink } from "@/lib/site";
import { convert, fieldsFor, fmt, inRange, type Field, type Garment, type PantModel, type PocketChoice, type SleeveType, type Unit } from "@/lib/order";

type Fabric = { code: string; name: string; colour: string | null; pattern: string | null; kind: "Shirting" | "Suiting"; rate: number; thumb: string | null; photo: string | null };
type Step = "what" | "fabric" | "style" | "measure" | "contact" | "review" | "done";
const STEPS: { s: Step; en: string; ml: string }[] = [
  { s: "what", en: "Garment", ml: "വസ്ത്രം" },
  { s: "fabric", en: "Fabric", ml: "തുണി" },
  { s: "style", en: "Style", ml: "സ്റ്റൈൽ" },
  { s: "measure", en: "Measure", ml: "അളവ്" },
  { s: "contact", en: "Address", ml: "വിലാസം" },
  { s: "review", en: "Check", ml: "പരിശോധിക്കുക" },
];

type Draft = {
  shirt: boolean;
  pant: boolean;
  shirtQty: number;
  pantQty: number;
  shirtFabric: string | null;
  pantFabric: string | null;
  sleeve: SleeveType;
  pocket: PocketChoice;
  model: PantModel;
  unit: Unit;
  m: Record<string, string>;
  name: string;
  phone: string;
  address: string;
  pincode: string;
  note: string;
};
const EMPTY: Draft = { shirt: true, pant: false, shirtQty: 1, pantQty: 1, shirtFabric: null, pantFabric: null, sleeve: "full", pocket: "one", model: "Regular", unit: "in", m: {}, name: "", phone: "", address: "", pincode: "", note: "" };
const DRAFT_KEY = "suxus_order_draft";

const mk = (g: Garment, k: string) => `${g}.${k}`;
const parse = (s: string | undefined) => {
  const n = Number((s ?? "").replace(",", ".").trim());
  return s && Number.isFinite(n) && n > 0 ? n : null;
};

export function OrderWizard() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState<Step>("what");
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [fabErr, setFabErr] = useState(false);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<number | null>(null);
  const [hp, setHp] = useState("");

  // a half-filled order survives a reload (this phone only)
  useEffect(() => {
    try {
      const s = localStorage.getItem(DRAFT_KEY);
      if (s) setD({ ...EMPTY, ...JSON.parse(s) });
    } catch {
      /* private window */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* private window */
    }
  }, [d]);
  useEffect(() => {
    fetch(`${ERP_URL}/api/public/fabrics`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setFabErr(true);
        setFabrics(j.fabrics);
        // "Order this fabric" from the fabrics page: that cloth is already chosen for its garment
        const want = new URLSearchParams(window.location.search).get("fabric");
        const f = (j.fabrics as Fabric[]).find((x) => x.code === want);
        if (f) {
          setD((x) => (f.kind === "Suiting" ? { ...x, shirt: false, pant: true, pantFabric: f.code } : { ...x, shirt: true, pant: false, shirtFabric: f.code }));
          setStep("fabric");
        }
      })
      .catch(() => setFabErr(true));
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTried(false);
  }, [step]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const garments: Garment[] = [...(d.shirt ? (["Shirt"] as const) : []), ...(d.pant ? (["Pant"] as const) : [])];
  const fields = garments.flatMap((g) => fieldsFor(g, d.sleeve));
  const fab = (code: string | null) => fabrics?.find((f) => f.code === code) ?? null;

  const bad = (f: Field) => {
    const v = parse(d.m[mk(f.garment, f.key)]);
    return v == null ? "missing" : !inRange(f, v, d.unit) ? "range" : null;
  };
  const okStep = (s: Step): boolean => {
    if (s === "what") return d.shirt || d.pant;
    if (s === "fabric") return (!d.shirt || !!fab(d.shirtFabric)) && (!d.pant || !!fab(d.pantFabric));
    if (s === "style") return true;
    if (s === "measure") return fields.every((f) => !bad(f));
    if (s === "contact") return d.name.trim().length >= 2 && /^(\+?91)?[6-9]\d{9}$/.test(d.phone.replace(/[\s-]/g, "")) && d.address.trim().length >= 10 && /^[1-9]\d{5}$/.test(d.pincode.trim());
    return true;
  };
  const idx = STEPS.findIndex((x) => x.s === step);
  const next = () => {
    if (!okStep(step)) return setTried(true);
    setStep(STEPS[idx + 1].s);
  };
  const back = () => idx > 0 && setStep(STEPS[idx - 1].s);

  const switchUnit = (u: Unit) => {
    if (u === d.unit) return;
    const m = Object.fromEntries(Object.entries(d.m).map(([k, v]) => [k, parse(v) == null ? v : fmt(convert(parse(v)!, d.unit, u))]));
    setD((x) => ({ ...x, unit: u, m }));
  };

  const submit = async () => {
    setSending(true);
    setSendErr(null);
    const nums = (g: Garment) => Object.fromEntries(fieldsFor(g, d.sleeve).map((f) => [f.key, parse(d.m[mk(g, f.key)])]));
    const items = [
      ...(d.shirt ? [{ garment: "Shirt", fabricCode: d.shirtFabric, qty: d.shirtQty, sleeve: d.sleeve, pocket: d.pocket, m: nums("Shirt") }] : []),
      ...(d.pant ? [{ garment: "Pant", fabricCode: d.pantFabric, qty: d.pantQty, model: d.model, m: nums("Pant") }] : []),
    ];
    try {
      const r = await fetch(`${ERP_URL}/api/public/web-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name.trim(), phone: d.phone.replace(/[\s-]/g, ""), address: d.address.trim(), pincode: d.pincode.trim(), note: d.note.trim() || undefined, unit: d.unit, items, website: hp }),
      });
      const j = await r.json();
      if (!j.ok) {
        setSendErr(
          j.error === "fabric"
            ? "One of the fabrics has just gone out of stock — please choose another. തിരഞ്ഞെടുത്ത തുണി ഇപ്പോൾ സ്റ്റോക്കിലില്ല."
            : j.error === "limit"
              ? "Too many orders from this network today — please WhatsApp us. ദയവായി WhatsApp ചെയ്യുക."
              : "Please check your details and try again. വിവരങ്ങൾ ഒന്നുകൂടി പരിശോധിക്കുക.",
        );
        if (j.error === "fabric") setStep("fabric");
        return;
      }
      setOrderNo(j.id);
      setStep("done");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* private window */
      }
    } catch {
      setSendErr("Could not send — check your internet and try again. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.");
    } finally {
      setSending(false);
    }
  };

  if (step === "done")
    return (
      <div className="ow-done" data-testid="order-done">
        <span className="label">Order received</span>
        <h2>Thank you, {d.name.split(" ")[0]}.</h2>
        <p className="ml-line" lang="ml">
          നിങ്ങളുടെ ഓർഡർ കിട്ടി. ഞങ്ങൾ ഉടൻ വിളിച്ച് വിലയും അളവും ഉറപ്പിക്കും.
        </p>
        <p className="mt-s">
          Your order number is <b>#{orderNo}</b>. We will call or WhatsApp you to confirm the price and your measurements, then send it by courier.
        </p>
        <div className="actions mt-m">
          <a className="btn gold" href={waLink(`SUXUS | Heritage Tailor — my website order #${orderNo}`)} target="_blank" rel="noopener">
            WhatsApp us about order #{orderNo}
          </a>
        </div>
      </div>
    );

  return (
    <div className="ow">
      <ol className="ow-steps" aria-label="Order steps">
        {STEPS.map((x, i) => (
          <li key={x.s} aria-current={x.s === step ? "step" : undefined} className={i < idx ? "done" : undefined}>
            <span className="n">{i + 1}</span>
            <span className="t">{x.en}</span>
          </li>
        ))}
      </ol>

      {step === "what" && (
        <section className="ow-panel" data-testid="step-what">
          <h2>What would you like stitched?</h2>
          <p className="ml-line" lang="ml">
            എന്ത് തയ്ക്കണം?
          </p>
          <div className="ow-choices">
            {(
              [
                ["shirt", "Shirt", "ഷർട്ട്"],
                ["pant", "Pant", "പാന്റ്"],
              ] as const
            ).map(([k, en, ml]) => (
              <div key={k} className={`ow-choice${d[k] ? " on" : ""}`}>
                <button type="button" onClick={() => set(k, !d[k])} aria-pressed={d[k]} data-testid={`pick-${k}`}>
                  <span className="tick" aria-hidden="true">
                    {d[k] ? "✓" : ""}
                  </span>
                  <b>{en}</b> <span lang="ml">{ml}</span>
                </button>
                {d[k] && (
                  <label className="ow-qty">
                    How many{" "}
                    <select value={k === "shirt" ? d.shirtQty : d.pantQty} onChange={(e) => set(k === "shirt" ? "shirtQty" : "pantQty", Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </div>
          {tried && !okStep("what") && <p className="ow-err">Choose a shirt, a pant or both.</p>}
        </section>
      )}

      {step === "fabric" && (
        <section className="ow-panel" data-testid="step-fabric">
          <h2>Choose the fabric</h2>
          <p className="ml-line" lang="ml">
            ഞങ്ങളുടെ സ്റ്റോക്കിലുള്ള തുണി തിരഞ്ഞെടുക്കുക.
          </p>
          {fabErr && <p className="ow-err">Could not load the fabrics. Please try again in a minute, or WhatsApp us.</p>}
          {!fabrics && !fabErr && <p className="muted">Loading today&apos;s fabrics…</p>}
          {fabrics &&
            garments.map((g) => {
              const list = fabrics.filter((f) => (g === "Shirt" ? f.kind === "Shirting" : f.kind === "Suiting"));
              const chosen = g === "Shirt" ? d.shirtFabric : d.pantFabric;
              return (
                <div key={g} className="ow-fabgroup">
                  <h3>
                    {g === "Shirt" ? "Shirt fabric" : "Pant fabric"} <span lang="ml">{g === "Shirt" ? "ഷർട്ട് തുണി" : "പാന്റ് തുണി"}</span>
                  </h3>
                  {list.length === 0 ? (
                    <p className="muted">None in stock right now — please WhatsApp us.</p>
                  ) : (
                    <ul className="fab-grid">
                      {list.map((f) => (
                        <li key={f.code} className={`fab-card ow-fab${chosen === f.code ? " on" : ""}`}>
                          <button type="button" className="fab-open" onClick={() => set(g === "Shirt" ? "shirtFabric" : "pantFabric", f.code)} aria-pressed={chosen === f.code} data-testid={`fab-${f.code}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="fab-img" src={f.thumb ?? f.photo ?? ""} alt={`${f.name} fabric`} loading="lazy" />
                            {chosen === f.code && <span className="fab-kind">✓ Chosen</span>}
                          </button>
                          <div className="fab-body">
                            <span className="fab-code">{f.code}</span>
                            <h3>{f.name}</h3>
                            <p className="fab-rate">{f.rate > 0 ? <>₹{f.rate.toLocaleString("en-IN")} <span>/ metre</span></> : <span>Ask for the rate</span>}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          {tried && !okStep("fabric") && <p className="ow-err">Choose a fabric for each garment.</p>}
        </section>
      )}

      {step === "style" && (
        <section className="ow-panel" data-testid="step-style">
          <h2>Style</h2>
          {d.shirt && (
            <>
              <h3 className="mt-s">
                Shirt sleeve <span lang="ml">കൈ</span>
              </h3>
              <Chips
                value={d.sleeve}
                onChange={(v) => set("sleeve", v)}
                items={[
                  ["full", "Full sleeve", "ഫുൾ കൈ"],
                  ["half", "Half sleeve", "ഹാഫ് കൈ"],
                ]}
                testid="sleeve"
              />
              <h3 className="mt-s">
                Pocket <span lang="ml">പോക്കറ്റ്</span>
              </h3>
              <Chips
                value={d.pocket}
                onChange={(v) => set("pocket", v)}
                items={[
                  ["none", "No pocket", "ഇല്ല"],
                  ["one", "One (left)", "ഒന്ന് (ഇടത്)"],
                  ["two", "Two, flap & button", "രണ്ട് — ഫ്ലാപ്പും ബട്ടണും"],
                ]}
                testid="pocket"
              />
            </>
          )}
          {d.pant && (
            <>
              <h3 className="mt-s">
                Pant model <span lang="ml">പാന്റ് മോഡൽ</span>
              </h3>
              <Chips
                value={d.model}
                onChange={(v) => set("model", v)}
                items={[
                  ["Regular", "Regular", "റെഗുലർ"],
                  ["Loose", "Loose", "ലൂസ്"],
                ]}
                testid="model"
              />
            </>
          )}
        </section>
      )}

      {step === "measure" && (
        <section className="ow-panel" data-testid="step-measure">
          <div className="ow-rule">
            <b>Measure your best-fitting {garments.map((g) => g.toLowerCase()).join(" and ")} — not your body.</b>
            <p lang="ml">
              ശരീരത്തിൽ ടേപ്പ് ചുറ്റിയല്ല അളക്കേണ്ടത്. നിങ്ങൾക്ക് നന്നായി ഫിറ്റ് ആകുന്ന പഴയ {d.shirt ? "ഷർട്ട്" : ""}
              {d.shirt && d.pant ? " / " : ""}
              {d.pant ? "പാന്റ്" : ""} ബട്ടൺ ഇട്ട് നിരപ്പായ പ്രതലത്തിൽ വിരിച്ച്, ചിത്രത്തിലെ ചുവന്ന അമ്പടയാളം പോലെ അളക്കുക.
            </p>
          </div>
          <div className="ow-unit" role="radiogroup" aria-label="Unit">
            <span>Unit</span>
            {(
              [
                ["in", "Inches"],
                ["cm", "Centimetres"],
              ] as const
            ).map(([u, t]) => (
              <button key={u} type="button" role="radio" aria-checked={d.unit === u} onClick={() => switchUnit(u)} data-testid={`unit-${u}`}>
                {t}
              </button>
            ))}
          </div>
          {garments.map((g) => (
            <div key={g}>
              <h3 className="ow-ghead">
                {g === "Shirt" ? `Shirt — ${d.sleeve === "full" ? "full" : "half"} sleeve` : `Pant — ${d.model}`} <span lang="ml">{g === "Shirt" ? "ഷർട്ട്" : "പാന്റ്"}</span>
              </h3>
              <div className="ow-cards">
                {fieldsFor(g, d.sleeve).map((f, i) => {
                  const raw = d.m[mk(g, f.key)] ?? "";
                  const v = parse(raw);
                  const err = tried ? bad(f) : v != null && !inRange(f, v, d.unit) ? "range" : null;
                  return (
                    <article key={f.key} className={`ow-card${err ? " err" : ""}`} data-testid={`card-${g}-${f.key}`}>
                      <div className="ow-pic">
                        <MeasureDiagram diagram={f.diagram} field={f.key} num={i + 1} />
                      </div>
                      <div className="ow-info">
                        <span className="ow-num">{String(i + 1).padStart(2, "0")}</span>
                        <h4>
                          {f.en} <span lang="ml">{f.ml}</span>
                        </h4>
                        <p className="ow-se">
                          <span className="s">Start</span> {f.start.en} · <span lang="ml">{f.start.ml}</span>
                        </p>
                        <p className="ow-se">
                          <span className="e">End</span> {f.end.en} · <span lang="ml">{f.end.ml}</span>
                        </p>
                        <p className="ow-how" lang="ml">
                          {f.how}
                        </p>
                        <label className="ow-input">
                          <input
                            inputMode="decimal"
                            value={raw}
                            onChange={(e) => setD((x) => ({ ...x, m: { ...x.m, [mk(g, f.key)]: e.target.value } }))}
                            placeholder={d.unit === "in" ? "e.g. 11.5" : "e.g. 29"}
                            aria-label={`${f.en} in ${d.unit === "in" ? "inches" : "centimetres"}`}
                            data-testid={`in-${g}-${f.key}`}
                          />
                          <span>{d.unit === "in" ? "inch" : "cm"}</span>
                        </label>
                        {f.calc && v != null && !err && (
                          <p className="ow-calc" data-testid={`calc-${g}-${f.key}`}>
                            {f.calc.label}: <b>{fmt(f.calc.of(v, d.unit))} {d.unit === "in" ? "inch" : "cm"}</b>
                          </p>
                        )}
                        {err === "missing" && <p className="ow-err">Please enter this measurement.</p>}
                        {err === "range" && <p className="ow-err">This looks too {v != null && v < convert(f.range[0], "in", d.unit) ? "small" : "big"} — please measure again (unit: {d.unit === "in" ? "inches" : "cm"}).</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {step === "contact" && (
        <section className="ow-panel" data-testid="step-contact">
          <h2>Where should we send it?</h2>
          <p className="ml-line" lang="ml">
            കൊറിയർ അയയ്ക്കാനുള്ള വിലാസം.
          </p>
          <div className="ow-form">
            <label>
              Name <span lang="ml">പേര്</span>
              <input value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={80} data-testid="c-name" />
            </label>
            <label>
              Phone / WhatsApp <span lang="ml">ഫോൺ</span>
              <input value={d.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" maxLength={16} placeholder="98xxxxxxxx" data-testid="c-phone" />
            </label>
            <label className="wide">
              Address — house, street, place, district <span lang="ml">വിലാസം</span>
              <textarea value={d.address} onChange={(e) => set("address", e.target.value)} rows={3} autoComplete="street-address" maxLength={400} data-testid="c-address" />
            </label>
            <label>
              PIN code
              <input value={d.pincode} onChange={(e) => set("pincode", e.target.value)} inputMode="numeric" autoComplete="postal-code" maxLength={6} data-testid="c-pin" />
            </label>
            <label className="wide">
              Anything else? (optional) <span lang="ml">മറ്റെന്തെങ്കിലും</span>
              <textarea value={d.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={400} />
            </label>
            <label className="ow-hp" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </label>
          </div>
          {tried && !okStep("contact") && <p className="ow-err">Please fill in your name, a 10-digit phone number, the address and a 6-digit PIN code.</p>}
        </section>
      )}

      {step === "review" && (
        <section className="ow-panel" data-testid="step-review">
          <h2>Check your order</h2>
          <p className="ml-line" lang="ml">
            ഓർഡർ ഒന്ന് പരിശോധിക്കുക. തിരുത്താൻ &quot;Change&quot; അമർത്തുക.
          </p>
          {garments.map((g) => {
            const f = fab(g === "Shirt" ? d.shirtFabric : d.pantFabric);
            return (
              <div key={g} className="ow-review">
                <h3>
                  {(g === "Shirt" ? d.shirtQty : d.pantQty) > 1 ? `${g === "Shirt" ? d.shirtQty : d.pantQty} × ` : ""}
                  {g === "Shirt" ? `Shirt — ${d.sleeve} sleeve, pocket: ${d.pocket === "two" ? "two with flap & button" : d.pocket === "one" ? "one (left)" : "none"}` : `Pant — ${d.model}`}{" "}
                  <button type="button" className="ow-link" onClick={() => setStep("style")}>
                    Change
                  </button>
                </h3>
                <p>
                  Fabric: <b>{f?.code}</b> {f?.name} {f && f.rate > 0 ? `· ₹${f.rate}/m` : ""}{" "}
                  <button type="button" className="ow-link" onClick={() => setStep("fabric")}>
                    Change
                  </button>
                </p>
                <table className="ow-table">
                  <tbody>
                    {fieldsFor(g, d.sleeve).map((x, i) => {
                      const v = parse(d.m[mk(g, x.key)]);
                      return (
                        <tr key={x.key}>
                          <td>
                            {i + 1}. {x.en} <span lang="ml">{x.ml}</span>
                          </td>
                          <td>
                            {v != null ? `${fmt(v)} ${d.unit}` : "—"}
                            {x.calc && v != null ? ` → ${fmt(x.calc.of(v, d.unit))}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button type="button" className="ow-link" onClick={() => setStep("measure")}>
                  Change measurements
                </button>
              </div>
            );
          })}
          <div className="ow-review">
            <h3>
              Send to{" "}
              <button type="button" className="ow-link" onClick={() => setStep("contact")}>
                Change
              </button>
            </h3>
            <p>
              <b>{d.name}</b> · {d.phone}
              <br />
              {d.address}, PIN {d.pincode}
            </p>
          </div>
          <p className="muted small">No payment now. We will call or WhatsApp you to confirm the price (fabric + stitching + courier) before we cut the cloth.</p>
          {sendErr && <p className="ow-err">{sendErr}</p>}
        </section>
      )}

      <div className="ow-nav">
        {idx > 0 && (
          <button type="button" className="btn ghost" onClick={back}>
            Back
          </button>
        )}
        {step !== "review" ? (
          <button type="button" className="btn" onClick={next} data-testid="next">
            Next — {STEPS[idx + 1]?.en}
          </button>
        ) : (
          <button type="button" className="btn gold" onClick={() => void submit()} disabled={sending} data-testid="send">
            {sending ? "Sending…" : "Place the order"}
          </button>
        )}
      </div>
    </div>
  );
}

function Chips<T extends string>({ value, onChange, items, testid }: { value: T; onChange: (v: T) => void; items: [T, string, string][]; testid: string }) {
  return (
    <div className="ow-chips" role="radiogroup" data-testid={testid}>
      {items.map(([v, en, ml]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} data-value={v}>
          {en} <span lang="ml">{ml}</span>
        </button>
      ))}
    </div>
  );
}
