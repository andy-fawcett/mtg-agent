'use client';

import { useEffect, useState } from 'react';

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  category: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await fetch('/api/admin/config', {
        credentials: 'include',
      });
      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item: ConfigItem) {
    setEditingKey(item.key);
    setEditValue(item.value);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  async function saveEdit(key: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/config/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: editValue }),
      });

      if (response.ok) {
        // Update local state
        setConfig(config.map(item =>
          item.key === key ? { ...item, value: editValue } : item
        ));
        setEditingKey(null);
        setEditValue('');
        alert('Configuration updated successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to update configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  const categories = Array.from(new Set(config.map(c => c.category)));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">System Configuration</h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-700">
          <strong>Warning:</strong> Changing configuration values will affect the system immediately.
          Make sure you understand the impact before making changes.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-semibold mb-4 capitalize">{category.replace('_', ' ')}</h3>
          <div className="space-y-3">
            {config
              .filter(c => c.category === category)
              .map((item) => (
                <div key={item.key} className="border-b pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.key}</div>
                      <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                    </div>
                    <div className="ml-4 flex gap-2 items-center">
                      {editingKey === item.key ? (
                        <>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="border rounded px-3 py-1 text-sm w-32"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(item.key)}
                            disabled={saving}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-3 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={item.value}
                            readOnly
                            className="border rounded px-3 py-1 text-sm w-32 bg-gray-50"
                          />
                          <button
                            onClick={() => startEdit(item)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
