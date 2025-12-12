'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  date: string;
  total_requests: number;
  total_cost_cents: string;
  total_tokens: string;
  unique_users: number;
}

export default function AnalyticsPage() {
  const [usage, setUsage] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadUsage();
  }, [days]);

  async function loadUsage() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/usage?days=${days}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        // Reverse to show oldest first for chart display
        setUsage(data.usage.reverse());
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  // Calculate totals
  const totalRequests = usage.reduce((sum, day) => sum + day.total_requests, 0);
  const totalCostCents = usage.reduce((sum, day) => sum + parseInt(day.total_cost_cents || '0'), 0);
  const totalTokens = usage.reduce((sum, day) => sum + parseInt(day.total_tokens || '0'), 0);
  const avgDailyRequests = usage.length > 0 ? Math.round(totalRequests / usage.length) : 0;

  // Calculate max values for chart scaling
  const maxRequests = Math.max(...usage.map(d => d.total_requests), 1);
  const maxCostCents = Math.max(...usage.map(d => parseInt(d.total_cost_cents || '0')), 1);
  const maxTokens = Math.max(...usage.map(d => parseInt(d.total_tokens || '0')), 1);

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatCost(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatNumber(num: number | string) {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded ${days === d
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Total Requests</div>
          <div className="text-3xl font-bold mt-2">{formatNumber(totalRequests)}</div>
          <div className="text-xs text-gray-400 mt-1">Avg: {avgDailyRequests}/day</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Total Cost</div>
          <div className="text-3xl font-bold mt-2">{formatCost(totalCostCents)}</div>
          <div className="text-xs text-gray-400 mt-1">Last {days} days</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Total Tokens</div>
          <div className="text-3xl font-bold mt-2">{formatNumber(totalTokens)}</div>
          <div className="text-xs text-gray-400 mt-1">Input + Output</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Active Users</div>
          <div className="text-3xl font-bold mt-2">
            {usage.length > 0 ? usage[usage.length - 1].unique_users : 0}
          </div>
          <div className="text-xs text-gray-400 mt-1">Latest day</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Requests Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Daily Requests</h3>
          <div className="h-48 flex items-end gap-2">
            {usage.map((day, i) => {
              const height = (day.total_requests / maxRequests) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-48 flex items-end relative group">
                    <div
                      className="w-full bg-blue-600 hover:bg-blue-700 transition-colors"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap left-1/2 transform -translate-x-1/2 z-10">
                      {day.total_requests} requests
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 transform rotate-45 origin-left whitespace-nowrap">
                    {formatDate(day.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Daily Cost</h3>
          <div className="h-48 flex items-end gap-2">
            {usage.map((day, i) => {
              const costCents = parseInt(day.total_cost_cents || '0');
              const height = (costCents / maxCostCents) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-48 flex items-end relative group">
                    <div
                      className="w-full bg-green-600 hover:bg-green-700 transition-colors"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap left-1/2 transform -translate-x-1/2 z-10">
                      {formatCost(costCents)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 transform rotate-45 origin-left whitespace-nowrap">
                    {formatDate(day.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tokens Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Daily Tokens</h3>
          <div className="h-48 flex items-end gap-2">
            {usage.map((day, i) => {
              const tokens = parseInt(day.total_tokens || '0');
              const height = (tokens / maxTokens) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-48 flex items-end relative group">
                    <div
                      className="w-full bg-purple-600 hover:bg-purple-700 transition-colors"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap left-1/2 transform -translate-x-1/2 z-10">
                      {formatNumber(tokens)} tokens
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 transform rotate-45 origin-left whitespace-nowrap">
                    {formatDate(day.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white p-6 rounded-lg shadow mt-6">
        <h3 className="text-lg font-semibold mb-4">Usage Details</h3>
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr className="text-left">
              <th className="pb-2">Date</th>
              <th className="pb-2 text-right">Requests</th>
              <th className="pb-2 text-right">Cost</th>
              <th className="pb-2 text-right">Tokens</th>
              <th className="pb-2 text-right">Users</th>
            </tr>
          </thead>
          <tbody>
            {usage.slice().reverse().map((day, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2">{formatDate(day.date)}</td>
                <td className="py-2 text-right">{day.total_requests}</td>
                <td className="py-2 text-right">{formatCost(parseInt(day.total_cost_cents || '0'))}</td>
                <td className="py-2 text-right">{formatNumber(day.total_tokens)}</td>
                <td className="py-2 text-right">{day.unique_users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
