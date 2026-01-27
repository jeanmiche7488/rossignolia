'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Filter } from 'lucide-react';

interface UserFilterProps {
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  currentTenant?: string;
}

export function UserFilter({ tenants, currentTenant }: UserFilterProps) {
  const router = useRouter();
  const selectedTenant = currentTenant || 'all';

  const handleFilterChange = (tenantId: string) => {
    if (tenantId === 'all') {
      router.push('/admin/users');
    } else {
      router.push(`/admin/users?tenant=${tenantId}`);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="tenant-filter" className="text-sm font-medium">
          Filtrer par tenant:
        </Label>
      </div>
      <Select
        id="tenant-filter"
        value={selectedTenant}
        onChange={(e) => handleFilterChange(e.target.value)}
        className="w-64"
      >
        <option value="all">Tous les tenants</option>
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name} ({tenant.slug})
          </option>
        ))}
      </Select>
    </div>
  );
}
