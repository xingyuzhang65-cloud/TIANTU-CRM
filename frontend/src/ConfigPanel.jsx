import { useState, useEffect } from 'react';
import { api } from './api';

const CONFIG_META = {
  reclaim_no_follow_days: {
    label: 'N: 未跟进回收天数',
    description: '线索进入私海后，若N天内无有效跟进记录，自动回笼至公海',
    icon: '📅',
    unit: '天',
  },
  reclaim_no_convert_days: {
    label: 'M: 未转化回收天数',
    description: '线索进入私海后，若M天未转为商机或客户，自动回笼至公海',
    icon: '🔄',
    unit: '天',
  },
  claim_daily_limit: {
    label: 'X: 每人每日认领上限',
    description: '销售每日可在公海认领的线索最大数量',
    icon: '📊',
    unit: '条/天',
  },
  claim_private_limit: {
    label: 'Y: 私海持有线索上限',
    description: '销售私海持有的线索总数上限，防止盲目囤积',
    icon: '🔒',
    unit: '条',
  },
};

export default function ConfigPanel() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.getConfig();
      if (res.ok) setConfig(res.config);
      setLoading(false);
    })();
  }, []);

  const handleEdit = (key, value) => {
    setEditing((e) => ({ ...e, [key]: value }));
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await api.updateConfig(config);
    if (res.ok) {
      alert('配置已更新，下次回收检测生效');
    } else {
      alert('更新失败: ' + res.msg);
    }
    setSaving(false);
  };

  const handleReclaim = async () => {
    if (!confirm('确定要立即执行全量回收检测吗？')) return;
    const res = await api.reclaimLeads();
    if (res.ok) {
      alert(`回收完成，共回收 ${res.reclaimed} 条线索至公海\n当前参数: N=${res.params.N_days}天, M=${res.params.M_days}天`);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">加载中...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">系统配置</h2>

      {/* Config Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {Object.entries(CONFIG_META).map(([key, meta]) => (
          <div key={key} className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <h4 className="font-medium text-gray-800">{meta.label}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <input
                type="number"
                min="1"
                max="365"
                value={config[key] || ''}
                onChange={(e) => handleEdit(key, parseInt(e.target.value) || 0)}
                className="w-24 border rounded-lg px-3 py-2 text-center text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-gray-500 text-sm">{meta.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button
          onClick={handleReclaim}
          className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-medium shadow-sm"
        >
          立即执行回收
        </button>
      </div>

      <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border">
        <h4 className="font-medium text-gray-800 mb-4">配置说明</h4>
        <div className="space-y-3 text-sm text-gray-600">
          <p><strong>N (未跟进回收天数)</strong>: 默认7天。销售认领线索后，需在N天内完成首次有效跟进（含文字描述的跟进记录），否则线索自动回笼公海。</p>
          <p><strong>M (未转化回收天数)</strong>: 默认30天。线索在私海超过M天仍未转化为商机或客户，自动回笼公海，释放资源。</p>
          <p><strong>X (每人每日认领上限)</strong>: 默认5条。防止个别销售过度认领，确保公海资源合理分配。</p>
          <p><strong>Y (私海持有上限)</strong>: 默认50条。防止销售囤积线索不跟进，确保线索高效流转。</p>
          <p className="text-gray-400 mt-2">后台每60秒自动扫描一次，满足条件的线索将被自动回收至公海。</p>
        </div>
      </div>
    </div>
  );
}
