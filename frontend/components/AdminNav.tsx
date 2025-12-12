'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminNav() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  async function loadAlerts() {
    try {
      const response = await fetch('/api/admin/alerts', {
        credentials: 'include',
      });
      const data = await response.json();
      setAlertCount(data.count || 0);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }

  const navItems = [
    { href: '/admin', label: 'Overview', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { href: '/admin/monitoring', label: 'Monitoring', icon: '🔍', badge: alertCount },
    { href: '/admin/activity', label: 'Activity Log', icon: '📝' },
    { href: '/admin/config', label: 'Config', icon: '⚙️' },
  ];

  return (
    <nav className="bg-gray-800 text-white w-64 min-h-screen p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Admin Dashboard</h2>
        <Link href="/chat" className="text-sm text-gray-400 hover:text-white">
          ← Back to Chat
        </Link>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-4 py-2 rounded-lg hover:bg-gray-700 transition ${
                pathname === item.href ? 'bg-gray-700' : ''
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
