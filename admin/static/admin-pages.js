(function () {
  const prefix = '/TIANTU-CRM/admin';
  const originalFetch = window.fetch.bind(window);
  const jsonResponse = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }));

  const seedLeads = [
    { id: 1, company_name: '深圳思科达电子有限公司', contact_name: '陈总', contact_mobile: '13800138001', logistics_type: 'FBA', target_market: '美国', lead_status: 1, lead_status_label: '私海跟进中', owner: '张晓明', owner_id: 1, follow_count: 5, source: '展会', country: '中国', latest_follow: { content: '已确认 Q3 发货计划，报价方案已发送。', created_by: '张晓明' } },
    { id: 2, company_name: '广州恒通服装贸易有限公司', contact_name: '李经理', contact_mobile: '13800138002', logistics_type: '空派', target_market: '欧洲', lead_status: 0, lead_status_label: '公海待认领', owner: null, owner_id: null, follow_count: 0, source: '独立站', country: '中国', latest_follow: { content: '新建线索，等待首次联系。', created_by: '系统' } },
    { id: 3, company_name: '义乌欧凯进出口有限公司', contact_name: '王芳', contact_mobile: '13800138003', logistics_type: '海派', target_market: '欧洲', lead_status: 1, lead_status_label: '私海跟进中', owner: '李强', owner_id: 2, follow_count: 4, source: '社媒', country: '中国', latest_follow: { content: '需要中欧班列与卡航组合方案。', created_by: '李强' } },
    { id: 4, company_name: '杭州锐思科技有限公司', contact_name: '赵总', contact_mobile: '13800138004', logistics_type: '海派', target_market: '日韩', lead_status: 0, lead_status_label: '公海待认领', owner: null, owner_id: null, follow_count: 0, source: '海关数据', country: '中国', latest_follow: { content: '新建线索，等待认领。', created_by: '系统' } },
    { id: 5, company_name: '东莞联达塑胶制品有限公司', contact_name: '孙经理', contact_mobile: '13800138005', logistics_type: '海派', target_market: '欧洲', lead_status: 0, lead_status_label: '公海待认领', owner: null, owner_id: null, follow_count: 0, source: '转介绍', country: '中国', latest_follow: { content: '客户关注欧洲海派时效。', created_by: '系统' } },
    { id: 6, company_name: '宁波远洋国际贸易有限公司', contact_name: '周董', contact_mobile: '13800138006', logistics_type: '海派', target_market: '美国', lead_status: 1, lead_status_label: '私海跟进中', owner: '张晓明', owner_id: 1, follow_count: 8, source: '展会', country: '中国', latest_follow: { content: '关注鹿特丹 DDP 条款与清关能力。', created_by: '张晓明' } },
    { id: 7, company_name: 'AmazonSeller-DE GmbH', contact_name: 'Michael Braun', contact_mobile: '+49-176-1234567', logistics_type: 'FBA', target_market: '欧洲', lead_status: 0, lead_status_label: '公海待认领', owner: null, owner_id: null, follow_count: 0, source: '独立站', country: '德国', latest_follow: { content: '德国站卖家线索，等待认领。', created_by: '系统' } },
  ];

  const seedCustomers = [
    { id: 2, customer_name: '义乌欧凯进出口有限公司', company_name: '义乌欧凯进出口有限公司', contact_name: '王芳', mobile: '13800138003', masked_mobile: '138****8003', hot_contact: { name: '王芳', mobile: '138****8003' }, source: '已登记', tags: ['A', '直客'], follow_status: 'INTERESTED', follow_status_label: '有意向', ownership_status: 'MY_CUSTOMER', ownership_label: '我的客户', owner: '李强', owner_id: 2, latest_follow: { content: '确认圣诞季备货计划，需提前预订舱位', created_by: '李强' }, credit: { balance_due: 350000, days_aged: 25 }, latest_order: { tracking_number: 'OKE202604001DE', status: 'departed' } },
    { id: 3, customer_name: '宁波远洋国际贸易有限公司', company_name: '宁波远洋国际贸易有限公司', contact_name: '周董', mobile: '13800138006', masked_mobile: '138****8006', hot_contact: { name: '周董', mobile: '138****8006' }, source: '已登记', tags: ['B', '同行'], follow_status: 'QUOTED', follow_status_label: '报价', ownership_status: 'MY_CUSTOMER', ownership_label: '我的客户', owner: '张晓明', owner_id: 1, latest_follow: { content: '鹿特丹查验延误，正在协调处理', created_by: '张晓明' }, credit: { balance_due: 280000, days_aged: 55 }, latest_order: { tracking_number: 'NBY202605001NL', status: 'customs' } },
    { id: 5, customer_name: '广州恒通服装贸易有限公司', company_name: '广州恒通服装贸易有限公司', contact_name: '李经理', mobile: '13800138002', masked_mobile: '138****8002', hot_contact: { name: '李经理', mobile: '138****8002' }, source: '已登记', tags: ['C', '直客'], follow_status: 'TEMP_HOLD', follow_status_label: '暂时搁置', ownership_status: 'MY_CUSTOMER', ownership_label: '我的客户', owner: '张晓明', owner_id: 1, latest_follow: { content: '欠款已超账期，需跟进近期无新单原因', created_by: '财务部' }, credit: { balance_due: 95000, days_aged: 72 }, latest_order: { tracking_number: 'HTF202605001NL', status: 'departed' } },
    { id: 8, customer_name: '深圳星链跨境电商有限公司', company_name: '深圳星链跨境电商有限公司', contact_name: '林小姐', mobile: '13800138008', masked_mobile: '138****8008', hot_contact: { name: '林小姐', mobile: '138****8008' }, source: '独立开发', tags: ['C', '直客'], follow_status: 'INITIAL_VISIT', follow_status_label: '初访', ownership_status: 'MY_CUSTOMER', ownership_label: '我的客户', owner: '张晓明', owner_id: 1, latest_follow: { content: '确认 TikTok Shop 美国小包试跑需求', created_by: '张晓明' }, credit: { balance_due: 0, days_aged: 0 }, latest_order: null },
    { id: 6, customer_name: '杭州锐思科技有限公司', company_name: '杭州锐思科技有限公司', contact_name: '赵总', mobile: '13800138004', masked_mobile: '138****8004', hot_contact: { name: '赵总', mobile: '138****8004' }, source: '已登记', tags: ['C', '同行'], follow_status: 'INTERESTED', follow_status_label: '有意向', ownership_status: 'MY_CUSTOMER', ownership_label: '我的客户', owner: '李强', owner_id: 2, latest_follow: { content: '客户对时效和在线轨迹追踪功能认可', created_by: '李强' }, credit: null, latest_order: null },
  ];

  function read(key, seed) {
    try { return JSON.parse(localStorage.getItem(key)) || seed; } catch (_) { return seed; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  let leads = read('tiantu_admin_leads', seedLeads);
  let customers = read('tiantu_admin_customers', seedCustomers);

  window.fetch = function (input, init = {}) {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.href);
    const path = url.pathname.replace(prefix, '') || '/';
    const method = (init.method || 'GET').toUpperCase();

    if (path === '/api/leads/list') return jsonResponse({ ok: true, leads, total: leads.length });
    if (/^\/api\/leads\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop());
      return jsonResponse({ ok: true, lead: leads.find((item) => item.id === id) || leads[0], activities: [] });
    }
    if (path === '/api/leads/create' && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const item = { ...body, id: Date.now(), lead_status: 0, lead_status_label: '公海待认领', owner: null, owner_id: null, follow_count: 0, latest_follow: { content: '浏览器本地新建线索', created_by: '张晓明' } };
      leads = [item, ...leads]; write('tiantu_admin_leads', leads);
      return jsonResponse({ ok: true, lead: item });
    }
    if (/^\/api\/leads\/\d+\/claim$/.test(path) && method === 'POST') {
      const id = Number(path.split('/')[3]);
      leads = leads.map((item) => item.id === id ? { ...item, lead_status: 1, lead_status_label: '私海跟进中', owner: '张晓明', owner_id: 1 } : item);
      write('tiantu_admin_leads', leads); return jsonResponse({ ok: true, message: '领取成功' });
    }
    if (/^\/api\/leads\/\d+\/follow-up$/.test(path) && method === 'POST') return jsonResponse({ ok: true, message: '跟进记录已保存到演示数据' });
    if (/^\/api\/leads\/\d+\/convert$/.test(path) && method === 'POST') return jsonResponse({ ok: true, message: '线索已转化' });
    if (path === '/api/crm/customers') {
      const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
      const records = keyword ? customers.filter((item) => item.customer_name.toLowerCase().includes(keyword) || item.contact_name.toLowerCase().includes(keyword)) : customers;
      return jsonResponse({ ok: true, records, total: records.length, page: 1, page_size: 20, tab_counts: { my: customers.length, pool: 3, expiring: 1, closed: 1, all: customers.length + 5 }, selected_all_token: 'pages-demo' });
    }
    if (path === '/api/reminders/list') return jsonResponse({ ok: true, reminders: [], total: 0 });
    if (path.startsWith('/api/') && method !== 'GET') return jsonResponse({ ok: true, message: '演示操作已保存到当前浏览器' });
    return originalFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href^="/"], link[href^="/"], img[src^="/"]').forEach(function (node) {
      const attr = node.hasAttribute('href') ? 'href' : 'src';
      const value = node.getAttribute(attr);
      if (value.startsWith('/static/')) node.setAttribute(attr, prefix + value);
      else if (!value.startsWith('/api/')) node.setAttribute(attr, prefix + (value === '/' ? '/' : value));
    });
    document.querySelectorAll('[onclick]').forEach(function (node) {
      const value = node.getAttribute('onclick');
      node.setAttribute('onclick', value.replace(/location\.href='\//g, "location.href='" + prefix + '/'));
    });
    const badge = document.createElement('div');
    badge.textContent = '静态演示版 · 数据保存在当前浏览器';
    badge.style.cssText = 'position:fixed;right:16px;bottom:14px;z-index:9999;background:#111827;color:#fff;padding:7px 11px;border-radius:6px;font-size:12px;box-shadow:0 4px 14px #0003';
    document.body.appendChild(badge);
  });
})();
