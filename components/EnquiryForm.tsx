"use client";

import type { FormEvent } from "react";
import { business, waLink } from "@/lib/site";

const TYPES = ["School", "Hospital", "Hotel", "Corporate", "College", "Madrasa", "Event / group", "Other"];

type Props = {
  subject?: string;
  defaultType?: string;
};

/* Builds a ready-to-send WhatsApp message (default) or email from the fields.
   Nothing is stored on a server. */
export function EnquiryForm({ subject = "Uniform enquiry", defaultType = "" }: Props) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;

    const title = `SUXUS | Heritage Tailor — ${subject}`;
    const lines = [title];
    form.querySelectorAll<HTMLInputElement>("[name]").forEach((el) => {
      const v = el.value.trim();
      if (v) lines.push(`${el.dataset.label}: ${v}`);
    });
    const body = lines.join("\n");

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "email") {
      window.location.href = `mailto:${business.email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    } else {
      window.open(waLink(body), "_blank", "noopener");
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field full">
        <label htmlFor="f-inst">Institution or name</label>
        <input id="f-inst" name="institution" data-label="Institution" required autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="f-type">Type</label>
        <select id="f-type" name="type" data-label="Type" defaultValue={defaultType} required>
          <option value="" disabled>
            Choose…
          </option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-person">Contact person</label>
        <input id="f-person" name="person" data-label="Contact person" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="f-phone">Phone</label>
        <input id="f-phone" name="phone" data-label="Phone" type="tel" inputMode="tel" required autoComplete="tel" />
      </div>
      <div className="field">
        <label htmlFor="f-count">Approx. students or staff</label>
        <input id="f-count" name="count" data-label="Approx. number" type="number" min={1} inputMode="numeric" />
      </div>
      <div className="field full">
        <label htmlFor="f-when">Needed by</label>
        <input id="f-when" name="when" data-label="Needed by" placeholder="e.g. before June reopening" />
      </div>
      <div className="field full">
        <label htmlFor="f-msg">Anything else</label>
        <textarea id="f-msg" name="message" data-label="Message" />
      </div>
      <div className="full">
        <div className="actions">
          <button className="btn" type="submit" value="whatsapp">
            Send on WhatsApp
          </button>
          <button className="btn ghost" type="submit" value="email">
            Send by email
          </button>
        </div>
        <p className="form-note">
          Opens WhatsApp (95673 56072) or your email app with the details filled in. Price is confirmed on
          enquiry.
        </p>
      </div>
    </form>
  );
}
