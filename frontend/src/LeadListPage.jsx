import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import CreateLeadModal from './CreateLeadModal';
import LeadDetailModal from './LeadDetailModal';

const LOGISTICS_TYPE_COLORS = {
  FBA: 'bg-purple-100 text-purple-700',
  空派: 'bg-sky-100 text-sky-700',
  海派: 'bg-blue-100 text-blue-700',
  一件代发: 'bg-amber-100 text-amber-700',
  小包: 'bg-green-100 text-green-700',
};

const STATUS_CONFIG = {
  0: { label: '公海', color: 'bg-gray-100 text-gray-600', icon: '🌊' },
  1: { label: '私海', color: 'bg-blue-100 text-blue-700', icon: '🔒' },
  2: { label: '已转化', color: 'bg-green-100 text-green-700', icon: '✅' },
};

export default function LeadListPage({ pool = 'all' }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enums, setEnums] = useState({});
  const [filters, setFilters] = useState({ pool });
  const [selected, setSelected] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [stats, setStats] = useState({ total: 0, publicCount: 0, privateCount: 0, convertedCount: 0 });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (params.pool === 'all') delete params.pool;
      const res = await api.getLeads(params);
      if (res.ok) {
        setLeads(res.leads);
        setStats({
          total: res.total,
          publicCount: res.leads.filter((l) => l.lead_status === 0).length,
          privateCount: res.leads.filter((l) => l.lead_status === 1).length,
          convertedCount: res.leads.filter((l) => l.lead_status === 2).length,
        });
      }
    } catch (e) {
      showToast('加载失败: ' + e.message, true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadEnums = useCallback(async () => {
    try {
      const res = await api.getEnums();
      if (res) setEnums(res);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { loadEnums(); }, [loadEnums]);
  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => {
    setFilters((f) => ({ ...f, pool }));
  }, [pool]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  };

  const handleBatchToPool = async () => {
    if (selected.size === 0) return showToast('请先选择线索', true);
    const res = await api.batchToPool([...selected]);
    if (res.ok) {
      showToast(res.msg);
      setSelected(new Set());
      loadLeads();
    } else {
      showToast(res.msg, true);
    }
  };

  const handleClaim = async (leadId) => {
    const res = await api.claimLead(leadId, { user_id: 1, user_name: '张晓明' });
    showToast(res.msg, !res.ok);
    if (res.ok) loadLeads();
  };

  const title = pool === 'public' ? '公海池' : '线索管理';

  return (
    <div>
      {/* Toast notifications */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce">
          {error}
        </div>
      )}
      {success && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {success}
        </div>
      )}

      {/* Page Title & Actions */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <div className="flex gap-3">
          {pool !== 'public' && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
            >
              + 新建线索
            </button>
          )}
          <button onClick={loadLeads} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100">
            刷新
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '线索总数', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
          { label: '公海待认领', value: stats.publicCount, color: 'text-gray-600', bg: 'bg-white' },
          { label: '私海跟进中', value: stats.privateCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '已转化', value: stats.convertedCount, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((card, i) => (
          <div key={i} className={`${card.bg} rounded-xl p-4 shadow-sm border`}>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border flex flex-wrap gap-4 items-center">
        <span className="text-sm text-gray-500 font-medium">筛选:</span>
        <select
          value={filters.target_market || ''}
          onChange={(e) => setFilters((f) => ({ ...f, target_market: e.target.value || undefined }))}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">全部市场</option>
          {(enums.target_markets || []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={filters.logistics_type || ''}
          onChange={(e) => setFilters((f) => ({ ...f, logistics_type: e.target.value || undefined }))}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">全部物流类型</option>
          {(enums.logistics_types || []).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filters.pool || 'all'}
          onChange={(e) => setFilters((f) => ({ ...f, pool: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">全部池</option>
          <option value="public">公海</option>
          <option value="private">私海</option>
        </select>
        <input
          type="text"
          placeholder="搜索公司名/手机号..."
          value={filters.keyword || ''}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value || undefined }))}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        {(filters.target_market || filters.logistics_type || filters.keyword) && (
          <button
            onClick={() => setFilters({ pool: filters.pool })}
            className="text-sm text-red-500 hover:underline"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* Batch Actions */}
      {selected.size > 0 && pool !== 'public' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="text-sm text-blue-700 font-medium">已选 {selected.size} 条</span>
          <button
            onClick={handleBatchToPool}
            className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
          >
            一键放入公海
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:underline">
            取消选择
          </button>
        </div>
      )}

      {/* Leads Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-20 text-gray-400">暂无数据</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-10 p-4">
                  <input type="checkbox" checked={selected.size === leads.length} onChange={toggleAll} />
                </th>
                <th className="p-4 text-left font-medium text-gray-600">公司名称</th>
                <th className="p-4 text-left font-medium text-gray-600">联系人</th>
                <th className="p-4 text-left font-medium text-gray-600">手机号</th>
                <th className="p-4 text-left font-medium text-gray-600">物流偏好</th>
                <th className="p-4 text-left font-medium text-gray-600">目标市场</th>
                <th className="p-4 text-left font-medium text-gray-600">状态</th>
                <th className="p-4 text-left font-medium text-gray-600">归属</th>
                <th className="p-4 text-left font-medium text-gray-600">回收倒计时</th>
                <th className="p-4 text-left font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => {
                const cfg = STATUS_CONFIG[lead.lead_status] || { label: '-', color: '', icon: '' };
                const isUrgent = lead.reclaim_countdown_hours !== null && lead.reclaim_countdown_hours < 24;
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setShowDetail(lead.id)}
                        className="text-blue-600 hover:underline font-medium text-left"
                      >
                        {lead.company_name}
                      </button>
                    </td>
                    <td className="p-4 text-gray-600">{lead.contact_name || '-'}</td>
                    <td className="p-4 text-gray-600 font-mono">{lead.contact_mobile}</td>
                    <td className="p-4">
                      {lead.logistics_type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LOGISTICS_TYPE_COLORS[lead.logistics_type] || 'bg-gray-100 text-gray-600'}`}>
                          {lead.logistics_type}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-600">{lead.target_market || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{lead.owner || <span className="text-gray-400">-</span>}</td>
                    <td className="p-4">
                      {lead.lead_status === 1 && lead.reclaim_countdown_hours !== null ? (
                        <span className={`font-mono font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                          剩 {lead.reclaim_countdown_hours}h
                        </span>
                      ) : lead.lead_status === 2 ? (
                        <span className="text-green-500">已转化</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {lead.lead_status === 0 && (
                          <button
                            onClick={() => handleClaim(lead.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                          >
                            认领
                          </button>
                        )}
                        {lead.lead_status === 1 && (
                          <button
                            onClick={() => setShowDetail(lead.id)}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                          >
                            跟进
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetail(lead.id)}
                          className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
                        >
                          详情
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateLeadModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); loadLeads(); }}
        />
      )}
      {showDetail && (
        <LeadDetailModal
          leadId={showDetail}
          onClose={() => setShowDetail(null)}
          onRefresh={loadLeads}
          showToast={showToast}
        />
      )}
    </div>
  );
}
