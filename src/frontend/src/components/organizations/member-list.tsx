'use client';

import { Badge } from '@/components/atoms/badge';

interface Member {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: string;
}

const roleVariants: Record<string, 'info' | 'success' | 'default' | 'warning'> = {
  owner: 'info',
  admin: 'success',
  member: 'default',
  viewer: 'warning',
};

export function MemberList({ members }: { members: Member[] }): React.ReactNode {
  if (members.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-surface-500">No members found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10 text-xs font-medium text-primary-400">
              {member.firstName.charAt(0)}
              {member.lastName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-surface-200">
                {member.firstName} {member.lastName}
              </p>
              <p className="text-xs text-surface-500">{member.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={roleVariants[member.role] ?? 'default'} size="sm">
              {member.role}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
