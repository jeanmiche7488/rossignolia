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
  FileText,
} from 'lucide-react';

interface SidebarProps {
  user: {
    role: string;
    tenant_id: string | null;
    permissions?: Record<string, unknown> | null;
  };
  tenant: {
    name: string;
  } | null;
  enabledModules?: string[];
}

export function Sidebar({ user, tenant, enabledModules = [] }: SidebarProps) {
  const pathname = usePathname();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Check user permissions
  const userPermissions = (user.permissions as any) || { modules: {} };

  const checkModuleAccess = (moduleCode: string) => {
    // Module must be enabled for tenant
    if (!enabledModules.includes(moduleCode)) {
      return { enabled: false, hasRead: false, hasWrite: false };
    }
    
    // Check user permissions
    const modulePerms = userPermissions.modules?.[moduleCode];
    if (!modulePerms) {
      // Default: read access if module is enabled
      return { enabled: true, hasRead: true, hasWrite: false };
    }
    
    return {
      enabled: true,
      hasRead: modulePerms.read === true,
      hasWrite: modulePerms.write === true,
    };
  };

  const allUserNavItems = [
    {
      title: 'Accueil',
      href: '/dashboard',
      icon: LayoutDashboard,
      moduleCode: null,
    },
    {
      title: 'Stock Health',
      href: '/stock',
      icon: Package,
      moduleCode: 'stock',
    },
    {
      title: 'Demand Planning',
      href: '/demand-planning',
      icon: TrendingUp,
      moduleCode: 'demand-planning',
    },
    {
      title: 'Transport Control',
      href: '/transport',
      icon: Truck,
      moduleCode: 'transport',
    },
    {
      title: 'Supplier Risk',
      href: '/supplier-risk',
      icon: Shield,
      moduleCode: 'supplier-risk',
    },
    {
      title: 'Paramètres',
      href: '/settings',
      icon: Settings,
      moduleCode: null,
    },
  ];

  // Filter and configure nav items based on enabled modules and permissions
  const userNavItems = allUserNavItems.map((item) => {
    if (!item.moduleCode) {
      return { ...item, badge: undefined, disabled: false };
    }

    const access = checkModuleAccess(item.moduleCode);
    
    if (!access.enabled) {
      return {
        ...item,
        badge: 'Non activé',
        disabled: true,
      };
    }

    if (!access.hasRead) {
      return {
        ...item,
        badge: 'Accès refusé',
        disabled: true,
      };
    }

    return {
      ...item,
      badge: access.hasWrite ? 'Actif' : 'Lecture seule',
      disabled: false,
    };
  });

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
    {
      title: 'Prompts système',
      href: '/admin/prompts',
      icon: FileText,
    },
  ];

  const navItems = isSuperAdmin ? adminNavItems : userNavItems;

  // Helper function to check if a nav item is active
  const isNavItemActive = (href: string, currentPath: string) => {
    // For /admin, only match exactly or paths that start with /admin/ but not /admin/tenants, /admin/users, or /admin/prompts
    if (href === '/admin') {
      return currentPath === '/admin' || 
             (currentPath.startsWith('/admin/') && 
              !currentPath.startsWith('/admin/tenants') && 
              !currentPath.startsWith('/admin/users') &&
              !currentPath.startsWith('/admin/prompts'));
    }
    // For other items, match exactly or if path starts with href + '/'
    return currentPath === href || currentPath?.startsWith(href + '/');
  };

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
            const isActive = isNavItemActive(item.href, pathname || '');
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
              const isActive = isNavItemActive(item.href, pathname || '');
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
