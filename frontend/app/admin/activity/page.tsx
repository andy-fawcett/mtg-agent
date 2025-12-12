'use client';

import { useEffect, useState } from 'react';

interface AdminAction {
  id: string;
  admin_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

export default function ActivityLog() {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActions();
  }, []);

  async function loadActions() {
    try {
      const response = await fetch('/api/admin/activity?limit=100', {
        credentials: 'include',
      });
      const data = await response.json();
      setActions(data.actions);
    } catch (error) {
      console.error('Failed to load activity log:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action: AdminAction): string {
    const details = action.details || {};

    switch (action.action_type) {
      case 'user_tier_change':
        return `Changed ${details.email}'s tier from ${details.oldTier} to ${details.newTier}`;
      case 'user_role_change':
        return `Changed ${details.email}'s role from ${details.oldRole} to ${details.newRole}`;
      case 'user_suspend':
        return `Suspended ${details.email} (${details.sessionsDeleted} sessions terminated)`;
      case 'user_unsuspend':
        return `Unsuspended ${details.email}`;
      case 'user_delete':
        return `Deleted user ${details.email}`;
      case 'config_update':
        return `Updated ${details.key} from ${details.oldValue} to ${details.newValue}`;
      case 'emergency_mode':
        return `${details.enabled ? 'Enabled' : 'Disabled'} emergency mode`;
      case 'flush_cache':
        return 'Flushed Redis cache';
      default:
        return action.action_type;
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Activity Log</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {actions.map((action) => (
              <tr key={action.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(action.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {action.admin_email}
                </td>
                <td className="px-6 py-4 text-sm">
                  {formatAction(action)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
