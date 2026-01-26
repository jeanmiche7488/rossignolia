'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Truck,
  Shield,
  Settings,
  Users,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  user: {
    role: string;
    tenant_id: string | null;
  };
  tenant: {
    name: string;
  } | null;
}

export function Sidebar({ user, tenant }: SidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const userNavItems = [
    {
      title: 'Accueil',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Stock Health',
      href: '/stock',
      icon: Package,
      badge: 'Actif',
    },
    {
      title: 'Demand Planning',
      href: '/demand-planning',
      icon: TrendingUp,
      badge: 'Bientôt',
      disabled: true,
    },
    {
      title: 'Transport Control',
      href: '/transport',
      icon: Truck,
      badge: 'Bientôt',
      disabled: true,
    },
    {
      title: 'Supplier Risk',
      href: '/supplier-risk',
      icon: Shield,
      badge: 'Bientôt',
      disabled: true,
    },
    {
      title: 'Paramètres',
      href: '/settings',
      icon: Settings,
    },
  ];

  const adminNavItems = [
    {
      title: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      title: 'Tenants',
      href: '/admin/tenants',
      icon: Building2,
    },
    {
      title: 'Utilisateurs',
      href: '/admin/users',
      icon: Users,
    },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="w-64 border-r bg-slate-950">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ROSSIGNOLIA</h2>
              <p className="text-xs text-blue-400">Logistic Intelligence</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4 flex flex-col">
          <div className="flex-1 space-y-1">
            {navItems.filter(item => item.title !== 'Paramètres').map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const isDisabled = item.disabled;

            return (
              <Link
                key={item.href}
                href={isDisabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive && !isDisabled
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : isDisabled
                    ? 'text-slate-500 cursor-not-allowed opacity-50'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
                onClick={(e) => {
                  if (isDisabled) {
                    e.preventDefault();
                  }
                }}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      item.badge === 'Actif'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          </div>
          {/* Settings at bottom */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            {navItems.filter(item => item.title === 'Paramètres').map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const isDisabled = item.disabled;

              return (
                <Link
                  key={item.href}
                  href={isDisabled ? '#' : item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive && !isDisabled
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : isDisabled
                      ? 'text-slate-500 cursor-not-allowed opacity-50'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        item.badge === 'Actif'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}
