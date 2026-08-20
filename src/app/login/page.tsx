import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Opalook</h1>
          <p className="text-sm text-muted-foreground">
            La moulinette d&apos;optimisation des catégories e-commerce.
            Connecte-toi pour accéder à tes projets.
          </p>
        </div>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </main>
  );
}
