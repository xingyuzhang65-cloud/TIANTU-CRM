import { useState, useEffect } from 'react';
import { api } from './api';

export default function CreateLeadModal({ onClose, onSuccess }) {
  const [enums, setEnums] = useState({ logistics_types: [], target_markets: [] });
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_mobile: '',
    email: '',
    source: '',
    logistics_type: '',
    target_market: '',
    country: '',
    product_interest: '',
  });
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    api.getEnums().then((res) => { if (res) setEnums(res); });
  }, []);

  const update = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDuplicate(null);
  };

  const handleSubmit = async () => {
    if (!form.company_name.trim() || !form.contact_mobile.trim()) {
      alert('公司名称和手机号为必填项');
      return;
    }
    setLoading(true);
    try {
      const res = await api.createLead(form);
      if (res.ok) {
        onSuccess();
      } else if (res.duplicate) {
        setDuplicate(res);
      } else {
        alert(res.msg || '创建失败');
      }
    } catch (e) {
      alert('请求失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimFromDuplicate = async () => {
    if (!duplicate || duplicate.in_pool !== 'public') return;
    setClaiming(true);
    const res = await api.claimLead(duplicate.existing_lead_id, {
      user_id: 1,
      user_name: '张晓明',
    });
    if (res.ok) {
      onSuccess();
    } else {
      alert(res.msg || '认领失败');
    }
    setClaiming(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-800">新建线索</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Duplicate Warning (PRD 3.1) */}
        {duplicate && (
          <div className={`mx-6 mt-4 p-4 rounded-xl border ${
            duplicate.in_pool === 'private' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <p className="text-sm font-medium mb-2">
              {duplicate.in_pool === 'private' ? '⛔' : '⚠️'} {duplicate.msg}
            </p>
            {duplicate.in_pool === 'public' && (
              <button
                onClick={handleClaimFromDuplicate}
                disabled={claiming}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
              >
                {claiming ? '认领中...' : '直接认领'}
              </button>
            )}
            <button
              onClick={() => setDuplicate(null)}
              className="ml-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
            >
              继续新建
            </button>
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公司名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => update('company_name', e.target.value)}
              placeholder="请输入企业全称"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系人</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                placeholder="联系人姓名"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                手机号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.contact_mobile}
                onChange={(e) => update('contact_mobile', e.target.value)}
                placeholder="11位手机号"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                物流偏好 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.logistics_type}
                onChange={(e) => update('logistics_type', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择</option>
                {enums.logistics_types?.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标市场</label>
              <select
                value={form.target_market}
                onChange={(e) => update('target_market', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择</option>
                {enums.target_markets?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="联系邮箱"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => update('source', e.target.value)}
                placeholder="展会/社媒/独立站等"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">意向产品/备注</label>
            <textarea
              value={form.product_interest}
              onChange={(e) => update('product_interest', e.target.value)}
              placeholder="客户的物流需求或意向产品描述..."
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? '检测中...' : '创建线索'}
          </button>
        </div>
      </div>
    </div>
  );
}
