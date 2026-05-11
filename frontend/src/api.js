const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json();
}

export const api = {
  // 线索列表 (PRD 5.1 多维度筛选)
  getLeads(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads/list${qs ? '?' + qs : ''}`);
  },

  // 线索详情
  getLead(id) {
    return request(`/leads/${id}`);
  },

  // 创建线索 (PRD 3.1 含强制判重)
  createLead(data) {
    return request('/leads/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 认领线索 (PRD 3.2 含每日/总量限制)
  claimLead(id, data) {
    return request(`/leads/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 添加跟进 (PRD 3.3)
  addFollowUp(id, data) {
    return request(`/leads/${id}/follow-up`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 线索转化 (PRD 3.4)
  convertLead(id, data) {
    return request(`/leads/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 批量放入公海 (PRD 5.2)
  batchToPool(ids) {
    return request('/leads/batch-to-pool', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  // 手动分配
  reassignLead(id, data) {
    return request(`/leads/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 手动触发回收
  reclaimLeads() {
    return request('/leads/reclaim', { method: 'POST' });
  },

  // 系统配置
  getConfig() {
    return request('/config');
  },

  updateConfig(data) {
    return request('/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // 枚举值
  getEnums() {
    return request('/enums');
  },
};
