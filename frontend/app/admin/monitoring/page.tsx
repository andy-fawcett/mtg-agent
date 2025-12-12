'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  database: {
    healthy: boolean;
    latencyMs: number;
  };
  redis: {
    healthy: boolean;
  };
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
  };
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadHealth();
    checkEmergencyMode();
    const interval = setInterval(loadHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadHealth() {
    try {
      const response = await fetch('/api/admin/monitoring/health', {
        credentials: 'include',
      });
      const data = await response.json();
      setHealth(data.health);
    } catch (error) {
      console.error('Failed to load health:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkEmergencyMode() {
    try {
      // Check if rate limits are set to 0 (emergency mode)
      const response = await fetch('/api/admin/config', {
        credentials: 'include',
      });
      const data = await response.json();
      const freeTierConfig = data.config.find((c: any) => c.key === 'rate_limit.free.requests_per_day');
      setEmergencyMode(freeTierConfig?.value === '0');
    } catch (error) {
      console.error('Failed to check emergency mode:', error);
    }
  }

  async function toggleEmergencyMode() {
    setActionLoading('emergency');
    try {
      const response = await fetch('/api/admin/actions/emergency-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !emergencyMode }),
      });

      if (response.ok) {
        setEmergencyMode(!emergencyMode);
        alert(emergencyMode ? 'Emergency mode disabled' : 'Emergency mode enabled - all rate limits set to 0');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to toggle emergency mode');
      }
    } catch (error) {
      console.error('Failed to toggle emergency mode:', error);
      alert('Failed to toggle emergency mode');
    } finally {
      setActionLoading(null);
    }
  }

  async function flushCache() {
    if (!confirm('Are you sure you want to flush the Redis cache?')) {
      return;
    }

    setActionLoading('cache');
    try {
      const response = await fetch('/api/admin/actions/flush-cache', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        alert('Cache flushed successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to flush cache');
      }
    } catch (error) {
      console.error('Failed to flush cache:', error);
      alert('Failed to flush cache');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!health) {
    return <div>Failed to load system health</div>;
  }

  const uptimeHours = Math.floor(health.uptime / 3600);
  const uptimeMins = Math.floor((health.uptime % 3600) / 60);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">System Monitoring</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Database</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={health.database.healthy ? 'text-green-600' : 'text-red-600'}>
                {health.database.healthy ? '✓ Healthy' : '✗ Down'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Latency:</span>
              <span className={health.database.latencyMs > 500 ? 'text-yellow-600' : 'text-green-600'}>
                {health.database.latencyMs}ms
              </span>
            </div>
          </div>
        </div>

        {/* Redis */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Redis</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={health.redis.healthy ? 'text-green-600' : 'text-red-600'}>
                {health.redis.healthy ? '✓ Healthy' : '✗ Down'}
              </span>
            </div>
          </div>
        </div>

        {/* System */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">System</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span>{uptimeHours}h {uptimeMins}m</span>
            </div>
            <div className="flex justify-between">
              <span>Memory:</span>
              <span>
                {(health.memory.heapUsed / 1024 / 1024).toFixed(1)} MB / {(health.memory.heapTotal / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow mt-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>

        {emergencyMode && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <p className="text-sm text-red-700">
              <strong>Emergency Mode Active!</strong> All rate limits are set to 0. Users cannot make requests.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={toggleEmergencyMode}
            disabled={actionLoading !== null}
            className={`px-6 py-3 rounded font-semibold transition-colors ${
              emergencyMode
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {actionLoading === 'emergency'
              ? 'Loading...'
              : emergencyMode
                ? 'Disable Emergency Mode'
                : 'Enable Emergency Mode'}
          </button>

          <button
            onClick={flushCache}
            disabled={actionLoading !== null}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === 'cache' ? 'Flushing...' : 'Flush Redis Cache'}
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p><strong>Emergency Mode:</strong> Sets all rate limits to 0, effectively blocking all user requests. Use in case of abuse or system issues.</p>
          <p><strong>Flush Cache:</strong> Clears all Redis cache data including rate limit counters and session data. Use with caution.</p>
        </div>
      </div>
    </div>
  );
}
