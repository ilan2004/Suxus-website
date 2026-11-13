import { redirect } from "next/navigation";
import { hasAnyLoginUser } from "@/lib/auth";
import { SetupForm } from "./setup-form";
import { Logo } from "@/components/app/logo";

export const metadata = { title: "First-time setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyLoginUser()) redirect("/login");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 inline-flex rounded-xl bg-sidebar p-3 text-sidebar-foreground">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-semibold">Welcome to SUXUS ERP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create the first partner login. You can add staff logins later from the Staff page.
          <span className="ml block">ആദ്യത്തെ പാർട്ണർ ലോഗിൻ ഉണ്ടാക്കുക.</span>
        </p>
        <SetupForm />
      </div>
    </div>
  );
}
