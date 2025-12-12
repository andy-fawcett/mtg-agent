'use client';

import { useEffect, useState } from 'react';

interface Analytics {
  totalUsers: number;
  usersByTier: Array<{ tier: string; count: string }>;
  chatsToday: number;
  costTodayCents: number;
  tokensToday: {
    input: number;
    output: number;
  };
}

interface TopUser {
  id: string;
  email: string;
  tier: string;
  total_cost: string;
  total_requests: string;
}

interface Alert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export default function AdminOverview() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load analytics
      const analyticsRes = await fetch('/api/admin/analytics/overview', {
        credentials: 'include',
      });
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData.analytics);

      // Load top users
      const topUsersRes = await fetch('/api/admin/analytics/top-users?metric=cost&limit=5', {
        credentials: 'include',
      });
      const topUsersData = await topUsersRes.json();
      setTopUsers(topUsersData.topUsers);

      // Load alerts
      const alertsRes = await fetch('/api/admin/alerts', {
        credentials: 'include',
      });
      const alertsData = await alertsRes.json();
      setAlerts(alertsData.alerts);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!analytics) {
    return <div>Failed to load analytics</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Admin Overview</h1>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className={`border-l-4 p-4 mb-8 ${
          alerts.some(a => a.severity === 'critical')
            ? 'bg-red-50 border-red-400'
            : 'bg-yellow-50 border-yellow-400'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                System Alerts ({alerts.length})
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  {alerts.map((alert, idx) => (
                    <li key={idx}>{alert.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Total Users</div>
          <div className="text-3xl font-bold mt-2">{analytics.totalUsers}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Chats Today</div>
          <div className="text-3xl font-bold mt-2">{analytics.chatsToday}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Cost Today</div>
          <div className="text-3xl font-bold mt-2">
            ${(analytics.costTodayCents / 100).toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-500">Tokens Today</div>
          <div className="text-3xl font-bold mt-2">
            {(analytics.tokensToday.input + analytics.tokensToday.output).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.tokensToday.input.toLocaleString()} in / {analytics.tokensToday.output.toLocaleString()} out
          </div>
        </div>
      </div>

      {/* User Breakdown */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-lg font-semibold mb-4">Users by Tier</h3>
        <div className="space-y-2">
          {analytics.usersByTier.map((tier) => (
            <div key={tier.tier} className="flex justify-between items-center">
              <span className="capitalize">{tier.tier}</span>
              <span className="font-semibold">{tier.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Top Users by Cost</h3>
        <div className="space-y-2">
          {topUsers.map((user) => (
            <div key={user.id} className="flex justify-between items-center border-b pb-2">
              <div>
                <span className="font-medium">{user.email}</span>
                <span className="ml-2 text-sm text-gray-500">({user.tier})</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">${(parseFloat(user.total_cost) / 100).toFixed(2)}</div>
                <div className="text-sm text-gray-500">{user.total_requests} requests</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
