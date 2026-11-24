import { redirect } from "next/navigation";
import { Shell } from "@/components/app/shell";
import { getSession, hasAnyLoginUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect((await hasAnyLoginUser()) ? "/login" : "/setup");
  }
  return <Shell user={{ name: session.name, fullName: session.fullName, role: session.role }}>{children}</Shell>;
}
