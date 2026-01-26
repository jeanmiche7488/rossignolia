'use client';

import { Button } from '@/components/ui/button';
import { createBrowserClient } from '@/lib/db/supabase-client';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Button 
      variant="ghost" 
      onClick={handleSignOut} 
      className="gap-2 transition-all hover:bg-slate-100 hover:scale-105"
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </Button>
  );
}
