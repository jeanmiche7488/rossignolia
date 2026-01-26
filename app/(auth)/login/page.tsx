import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirectedFrom?: string };
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already logged in, redirect
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'SUPER_ADMIN') {
      redirect('/admin');
    } else {
      redirect('/stock');
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 to-gray-800 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold mb-4">Rossignolia</h1>
          <p className="text-xl text-gray-300 mb-6">
            Plateforme SaaS d'Intelligence Logistique
          </p>
          <p className="text-gray-400">
            Transformez vos données brutes en actions financières concrètes grâce à l'IA.
          </p>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold">Rossignolia</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Plateforme SaaS d'Intelligence Logistique
            </p>
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold mb-2">Connexion</h2>
            <p className="text-muted-foreground text-sm">
              Connectez-vous à votre compte pour accéder à la plateforme
            </p>
          </div>

          <LoginForm redirectedFrom={searchParams.redirectedFrom} />
        </div>
      </div>
    </div>
  );
}
