import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Get tenant info if not SUPER_ADMIN
  let tenant = null;
  if (profile.tenant_id) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', profile.tenant_id)
      .single();
    tenant = tenantData;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={profile} tenant={tenant} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-200 bg-white">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-slate-900">
                {profile.role === 'SUPER_ADMIN' ? 'Administration' : tenant?.name || 'Rossignolia'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                {profile.full_name || profile.email}
              </div>
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
