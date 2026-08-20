import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card ">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Opalook
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline dark:text-muted-foreground/70">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
