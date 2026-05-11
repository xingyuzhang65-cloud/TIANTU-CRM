import { useState } from 'react';
import LeadListPage from './LeadListPage';
import ConfigPanel from './ConfigPanel';

const TABS = [
  { key: 'leads', label: '线索管理', icon: '📋' },
  { key: 'public', label: '公海池', icon: '🌊' },
  { key: 'config', label: '系统配置', icon: '⚙️' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('leads');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">跨境物流CRM系统</h1>
            <p className="text-blue-200 text-sm mt-1">线索与公海池模块 v1.0</p>
          </div>
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-blue-700 shadow'
                    : 'bg-blue-800 text-blue-200 hover:bg-blue-700'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'leads' && <LeadListPage pool="all" />}
        {activeTab === 'public' && <LeadListPage pool="public" />}
        {activeTab === 'config' && <ConfigPanel />}
      </main>
    </div>
  );
}
