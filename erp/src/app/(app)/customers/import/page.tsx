import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/page-header";
import { ContactImportView } from "./contact-import-view";

export const metadata = { title: "Import contacts" };

export default async function ContactImportPage() {
  const session = await requireUser();
  const db = await getDb();
  const t = schema.contactImports;
  const c = schema.customers;
  const [contacts, customerPhones] = await Promise.all([
    db.select({ id: t.id, name: t.name, phone: t.phone, rawPhone: t.rawPhone, status: t.status, customerId: t.customerId }).from(t).orderBy(asc(t.name), asc(t.id)),
    db.select({ id: c.id, p: sql<string>`right(regexp_replace(coalesce(${c.phone}, ''), '[^0-9]', '', 'g'), 10)` }).from(c),
  ]);
  return (
    <>
      <PageHeader
        title="Import contacts"
        ml="കോൺടാക്ട് ചേർക്കുക"
        description="Upload your phone's contacts once, then add customers from the list a few at a time. The list is saved — pick up where you left off."
      />
      <ContactImportView contacts={contacts} customerPhones={customerPhones.filter((x) => x.p.length === 10).map((x) => [x.p, x.id] as [string, number])} canClear={session.role === "partner"} />
    </>
  );
}
