import { useState, useEffect } from 'react';
import { api } from './api';

const FOLLOW_STATUS_OPTIONS = ['未联系', '初步沟通', '意向强烈', '暂无意向', '无效信息'];

export default function LeadDetailModal({ leadId, onClose, onRefresh, showToast }) {
  const [lead, setLead] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [followForm, setFollowForm] = useState({ status: '初步沟通', content: '', next_follow_at: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.getLead(leadId);
      if (res.ok) {
        setLead(res.lead);
        setFollowUps(res.follow_ups || []);
      }
      setLoading(false);
    })();
  }, [leadId]);

  const handleAddFollowUp = async () => {
    if (!followForm.content.trim()) {
      showToast('请输入跟进内容', true);
      return;
    }
    setSubmitting(true);
    const res = await api.addFollowUp(leadId, {
      ...followForm,
      next_follow_at: followForm.next_follow_at || null,
      created_by: '张晓明',
    });
    if (res.ok) {
      showToast('跟进记录已保存');
      setShowFollowUpForm(false);
      setFollowForm({ status: '初步沟通', content: '', next_follow_at: '' });
      // Reload
      const detailRes = await api.getLead(leadId);
      if (detailRes.ok) {
        setLead(detailRes.lead);
        setFollowUps(detailRes.follow_ups || []);
      }
      onRefresh();
    } else {
      showToast(res.msg, true);
    }
    setSubmitting(false);
  };

  const handleConvert = async (type) => {
    setSubmitting(true);
    const res = await api.convertLead(leadId, {
      convert_type: type,
      operator: '张晓明',
    });
    showToast(res.msg, !res.ok);
    if (res.ok) {
      onClose();
      onRefresh();
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-red-500">线索不存在</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{lead.company_name}</h3>
            <p className="text-sm text-gray-500">
              {lead.lead_status_label} · 创建于 {lead.created_at?.slice(0, 10)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            &times;
          </button>
        </div>

        {/* Lead Info */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">联系人</span>
              <p className="font-medium">{lead.contact_name || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">手机号</span>
              <p className="font-medium font-mono">{lead.contact_mobile}</p>
            </div>
            <div>
              <span className="text-gray-500">邮箱</span>
              <p className="font-medium">{lead.email || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">物流偏好</span>
              <p className="font-medium">{lead.logistics_type || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">目标市场</span>
              <p className="font-medium">{lead.target_market || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">来源</span>
              <p className="font-medium">{lead.source || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">归属销售</span>
              <p className="font-medium">{lead.owner || '无(公海)'}</p>
            </div>
            <div>
              <span className="text-gray-500">跟进次数</span>
              <p className="font-medium">{lead.follow_count}</p>
            </div>
            <div>
              <span className="text-gray-500">回收倒计时</span>
              {lead.reclaim_countdown_hours !== null ? (
                <p className={`font-bold font-mono ${lead.reclaim_countdown_hours < 24 ? 'text-red-500' : 'text-orange-500'}`}>
                  剩 {lead.reclaim_countdown_hours} 小时
                </p>
              ) : (
                <p className="text-gray-400">-</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {lead.lead_status === 1 && (
          <div className="px-6 py-3 border-b flex gap-3">
            <button
              onClick={() => setShowFollowUpForm(!showFollowUpForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
            >
              + 添加跟进
            </button>
            <button
              onClick={() => setShowConvertConfirm(true)}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium disabled:opacity-50"
            >
              一键转化
            </button>
          </div>
        )}

        {/* Follow-up Form */}
        {showFollowUpForm && (
          <div className="p-6 border-b bg-blue-50">
            <h4 className="font-medium text-sm text-blue-800 mb-3">新增跟进记录</h4>
            <div className="space-y-3">
              <select
                value={followForm.status}
                onChange={(e) => setFollowForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {FOLLOW_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <textarea
                value={followForm.content}
                onChange={(e) => setFollowForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="跟进内容描述..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">下次跟进时间:</label>
                <input
                  type="datetime-local"
                  value={followForm.next_follow_at}
                  onChange={(e) => setFollowForm((f) => ({ ...f, next_follow_at: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddFollowUp}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '保存中...' : '保存跟进'}
                </button>
                <button
                  onClick={() => setShowFollowUpForm(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Convert Confirmation */}
        {showConvertConfirm && (
          <div className="p-6 border-b bg-green-50">
            <h4 className="font-medium text-sm text-green-800 mb-3">确认转化</h4>
            <p className="text-sm text-green-700 mb-3">该线索即将转化，请选择目标类型：</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConvert('customer')}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                转为客户
              </button>
              <button
                onClick={() => handleConvert('opportunity')}
                disabled={submitting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                转为商机
              </button>
              <button
                onClick={() => setShowConvertConfirm(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Follow-up History */}
        <div className="p-6">
          <h4 className="font-medium text-gray-800 mb-3">跟进记录 ({followUps.length})</h4>
          {followUps.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">暂无跟进记录</p>
          ) : (
            <div className="space-y-3">
              {followUps.map((fu) => (
                <div key={fu.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {fu.status}
                    </span>
                    <span className="text-xs text-gray-400">{fu.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <p className="text-sm text-gray-700">{fu.content}</p>
                  <div className="mt-2 text-xs text-gray-400 flex justify-between">
                    <span>跟进人: {fu.created_by}</span>
                    {fu.next_follow_at && (
                      <span>下次跟进: {fu.next_follow_at?.slice(0, 16).replace('T', ' ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
