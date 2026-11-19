import { asc } from "drizzle-orm";
import { can } from "@/lib/permissions";
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
    db.select({ id: t.id, name: t.name, phone: t.phone, phone2: t.phone2, rawPhone: t.rawPhone, status: t.status, customerId: t.customerId }).from(t).orderBy(asc(t.name), asc(t.id)),
    db.select({ id: c.id, phone: c.phone, alt: c.altPhone }).from(c),
  ]);
  return (
    <>
      <PageHeader
        title="Import contacts"
        ml="കോൺടാക്ട് ചേർക്കുക"
        description="Upload your phone's contacts once, then add customers from the list a few at a time. The list is saved — pick up where you left off."
      />
      <ContactImportView contacts={contacts} customerPhones={customerPhones.flatMap((x) => [x.phone, x.alt].filter((p): p is string => !!p).map((p) => [p, x.id] as [string, number]))} canClear={can(session.role, "delete")} />
    </>
  );
}
