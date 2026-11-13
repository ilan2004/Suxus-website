import { redirect } from "next/navigation";
import { getSession, hasAnyLoginUser, loginUsers } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/app/logo";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  if (!(await hasAnyLoginUser())) redirect("/setup");
  const users = await loginUsers();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo />
        <div>
          <p className="font-display text-4xl leading-tight font-semibold text-white">
            Every bill, order and metre —<br />
            <span className="text-gold">in one place.</span>
          </p>
          <p className="ml mt-3 !text-base !text-sidebar-muted">ബില്ല്, ഓർഡർ, സ്റ്റോക്ക്, കണക്ക് — എല്ലാം ഒറ്റ സ്ഥലത്ത്.</p>
        </div>
        <p className="text-xs text-sidebar-muted">Kadoor Complex, Pallikkal Bazar</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-gold/10" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex rounded-xl bg-sidebar p-3 text-sidebar-foreground">
              <Logo />
            </div>
          </div>
          <h1 className="font-display text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose your name and enter your PIN <span className="ml">പേര് തിരഞ്ഞെടുത്ത് പിൻ നൽകുക</span>
          </p>
          <LoginForm users={users.map((u) => ({ id: u.id, name: u.name, role: u.role ?? "" }))} />
        </div>
      </div>
    </div>
  );
}
