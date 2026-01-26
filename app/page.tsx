import { createServerComponentClient } from '@/lib/db/supabase-server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated, redirect to login
  if (!user) {
    redirect('/login');
  }

  // If authenticated, get profile and redirect based on role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'SUPER_ADMIN') {
    redirect('/admin');
  } else {
    redirect('/dashboard');
  }
}
