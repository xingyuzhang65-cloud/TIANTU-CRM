const KEY = 'tiantu_crm_app_state_v2';
const now = () => new Date().toISOString();
const afterDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const search = (rows, params, fields) => { const keyword = String(params.keyword || '').trim().toLowerCase(); return keyword ? rows.filter(row => fields.some(field => String(row[field] || '').toLowerCase().includes(keyword))) : rows; };

export function createDemoStore(initial) {
  let data = initial;
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved?.version === 2) data = { ...initial, ...saved.data }; } catch {}
  data.activities ||= Object.fromEntries(data.customers.map(c => [c.id, c.latest_follow ? [{ id: 1, activity_type: 'call', content: c.latest_follow.content, created_by: c.owner || '销售团队', created_at: c.latest_follow.created_at || now() }] : []]));
  data.follows ||= {};
  data.reminders ||= [{ id: 1, lead_id: 2, content: '广州恒通服装贸易有限公司：新分配线索待首次触达', is_completed: false }, { id: 2, customer_id: 3, content: '宁波远洋国际贸易有限公司：账龄 55 天，请关注回款', is_completed: false }];
  const persist = () => localStorage.setItem(KEY, JSON.stringify({ version: 2, data }));
  const ok = (value = {}) => ({ ok: true, ...value });
  const error = msg => ({ ok: false, msg });
  const nextId = rows => Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
  async function handle(config) {
    const request = new URL(config.url, 'http://local');
    const url = request.pathname, method = (config.method || 'get').toLowerCase(), params = config.params || {};
    const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
    const value = key => body[key] ?? request.searchParams.get(key);
    const user = data.users.find(u => u.id === Number(String(config.headers?.Authorization || '').split('-')[2])) || data.users[0];
    let match;
    if (url === '/api/reminders/list') return ok({ reminders: data.reminders.map(r => ({ ...r, is_snoozed: !!r.snoozed_until && new Date(r.snoozed_until).getTime() > Date.now() })) });
    if ((match = url.match(/^\/api\/reminders\/(\d+)\/snooze$/))) { const reminder = data.reminders.find(r => r.id === Number(match[1])); if (reminder) reminder.snoozed_until = new Date(Date.now() + Number(value('delay_hours') || 24) * 3600000).toISOString(); persist(); return ok(); }
    if (url === '/api/analytics/summary') {
      const revenue = data.customers.reduce((sum, c) => sum + Number(c.avg_monthly_revenue || 0), 0);
      const balance = data.customers.reduce((sum, c) => sum + Number(c.credit?.balance_due || 0), 0);
      return ok({ cards: [{ value: data.customers.length }, { value: data.orders.filter(o => o.status !== 'delivered').length }, { value: `${(revenue / 10000).toFixed(1)}万` }, { value: `${(balance / 10000).toFixed(1)}万` }], stage_counts: { developing: data.customers.filter(c => ['new', 'contacted', 'nurturing'].includes(c.lifecycle_status)).length, quoted: data.customers.filter(c => c.lifecycle_status === 'negotiating').length, cooperating: data.customers.filter(c => c.lifecycle_status === 'active').length, churned: data.customers.filter(c => c.lifecycle_status === 'disqualified').length }, monthly_trend: { labels: ['1月', '2月', '3月', '4月', '5月'], revenue: [420, 380, 510, 590, 680] } });
    }
    if (url === '/api/leads/list') return ok({ leads: search(data.leads.filter(l => params.pool === 'public' ? l.lead_status === 'public' : params.pool === 'private' ? l.lead_status === 'private' : true), params, ['company_name', 'contact_name', 'contact_mobile']) });
    if ((match = url.match(/^\/api\/customers\/(\d+)$/))) {
      const customer = data.customers.find(c => c.id === Number(match[1]));
      const ownershipLabels = { MY_CUSTOMER: '我的客户', COMPANY_POOL: '公司池', EXPIRING_PROTECTION: '即将掉保', CLOSED_CUSTOMER: '成交客户' };
      return customer ? ok({ customer: { ...customer, ownership_label: ownershipLabels[customer.ownership_status] || customer.ownership_label }, credit: customer.credit || null, activities: data.activities[customer.id] || [], orders: data.orders.filter(o => o.company_name === customer.company_name), opportunities: data.quotations.filter(q => q.company_name === customer.company_name).map(q => ({ ...q, title: q.route_detail, stage: q.status, amount: q.total_price, win_rate: q.status === 'accepted' ? 100 : 55 })) }) : error('未找到客户');
    }
    if ((match = url.match(/^\/api\/leads\/(\d+)$/))) {
      const lead = data.leads.find(l => l.id === Number(match[1]));
      return lead ? ok({ lead: { ...lead }, follow_ups: [...(data.follows[match[1]] || [])] }) : error('未找到线索');
    }
    if ((match = url.match(/^\/api\/customer\/(\d+)\/add-activity$/))) {
      const customer = data.customers.find(c => c.id === Number(match[1]));
      if (!customer || !String(value('content') || '').trim()) return error('请填写跟进内容');
      const entries = data.activities[customer.id] ||= [], images = value('image_urls');
      const activity = { id: nextId(entries), activity_type: value('activity_type') || 'call', content: value('content'), created_by: value('created_by') || user.name, created_at: now(), image_urls: Array.isArray(images) ? images : images ? JSON.parse(images) : [] };
      entries.unshift(activity); customer.latest_follow = activity; customer.last_followup_at = activity.created_at; customer.next_follow_date = value('next_follow_date'); customer.protect_expire_at = afterDays(30);
      if (customer.ownership_status === 'EXPIRING_PROTECTION') customer.ownership_status = 'MY_CUSTOMER';
      persist(); return ok({ msg: '跟进已保存', activity });
    }
    if ((match = url.match(/^\/api\/leads\/(\d+)\/follow-up$/))) {
      const lead = data.leads.find(l => l.id === Number(match[1]));
      if (!lead || !String(body.content || '').trim()) return error('请填写跟进内容');
      const entries = data.follows[lead.id] ||= [], follow = { ...body, id: nextId(entries), created_at: now(), created_by: user.name };
      entries.unshift(follow); lead.latest_follow = follow; lead.follow_count = (lead.follow_count || 0) + 1; persist(); return ok({ msg: '跟进已保存' });
    }
    if ((match = url.match(/^\/api\/customer\/(\d+)\/stage$/))) {
      const customer = data.customers.find(c => c.id === Number(match[1])), status = value('stage');
      const labels = { new: ['初访', 'INITIAL_VISIT'], negotiating: ['报价', 'QUOTED'], active: ['成交', 'CLOSED'], disqualified: ['暂时搁置', 'TEMP_HOLD'] };
      if (!customer || !labels[status]) return error('客户阶段无效');
      customer.lifecycle_status = status; [customer.follow_status_label, customer.follow_status] = labels[status];
      customer.lifecycle_label = { new: '开发中', negotiating: '已报价', active: '合作中', disqualified: '已流失' }[status];
      if (status === 'active') { customer.ownership_status = 'CLOSED_CUSTOMER'; customer.closed_at = now(); }
      else if (customer.ownership_status === 'CLOSED_CUSTOMER') customer.ownership_status = 'MY_CUSTOMER';
      persist(); return ok({ msg: '阶段已更新' });
    }
    if (url === '/api/crm/customers/claim') { for (const c of data.customers.filter(c => body.ids?.includes(c.id))) { c.ownership_status = 'MY_CUSTOMER'; c.owner = user.name; c.protect_expire_at = afterDays(30); } persist(); return ok({ msg: '认领成功' }); }
    if ((match = url.match(/^\/api\/leads\/(\d+)\/claim$/))) { const lead = data.leads.find(l => l.id === Number(match[1])); if (!lead) return error('未找到线索'); lead.lead_status = 'private'; lead.owner = user.name; persist(); return ok({ msg: '认领成功' }); }
    if (url === '/api/leads/create') {
      if (data.leads.some(l => l.company_name === body.company_name || l.contact_mobile === body.contact_mobile)) return error('公司或手机号已存在，请先查看现有线索');
      const lead = { ...body, id: nextId(data.leads), lead_status: 'private', owner: user.name, created_at: now(), follow_count: 0 }; data.leads.unshift(lead); persist(); return ok({ msg: '线索已创建', lead_id: lead.id });
    }
    if ((match = url.match(/^\/api\/leads\/(\d+)\/convert$/))) {
      const lead = data.leads.find(l => l.id === Number(match[1])); if (!lead || lead.lead_status === 'converted') return error('该线索已转化或不存在');
      const c = { ...lead, id: nextId(data.customers), phone: lead.contact_mobile, lifecycle_status: 'new', lifecycle_label: '开发中', follow_status: 'INITIAL_VISIT', follow_status_label: '初访', ownership_status: 'MY_CUSTOMER', customer_type: body.customer_type || '直客', protect_expire_at: afterDays(30) };
      data.customers.unshift(c); lead.lead_status = 'converted'; persist(); return ok({ msg: '已转为客户', customer_id: c.id });
    }
    if (url === '/api/inquiries/list') return ok({ inquiries: search(data.inquiries.filter(i => !params.status || params.status === 'all' || i.status === params.status), params, ['company_name', 'inquiry_no']) });
    if (url === '/api/inquiries/create') { const i = { ...body, id: nextId(data.inquiries), inquiry_no: `INQ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(nextId(data.inquiries)).padStart(3, '0')}`, status: 'pricing', status_label: '核价中', created_at: now() }; data.inquiries.unshift(i); persist(); return ok({ msg: '询价已提交', inquiry_id: i.id }); }
    if (url === '/api/orders/list') return ok({ orders: search(data.orders.filter(o => params.filter === 'air' ? o.route_detail?.includes('空') : params.filter === 'lastmile' ? ['arrived', 'delivered'].includes(o.status) : params.filter === 'sea' ? !o.route_detail?.includes('空') : true), params, ['company_name', 'tracking_number', 'cargo_desc']) });
    if ((match = url.match(/^\/api\/orders\/(\d+)\/subscribe$/))) { const o = data.orders.find(o => o.id === Number(match[1])); if (o) o.subscribed = true; persist(); return ok({ msg: '订阅已保存' }); }
    if (url === '/api/v1/crm/moments' && method === 'post') { const media = typeof body.media_urls === 'string' ? JSON.parse(body.media_urls || '[]') : body.media_urls || []; data.moments.unshift({ ...body, media_urls: media, id: nextId(data.moments), user_id: user.id, user: { id: user.id, name: user.name }, created_at: now(), like_count: 0, user_liked: false, comments: [] }); persist(); return ok({ msg: '动态已发布' }); }
    if ((match = url.match(/^\/api\/v1\/crm\/moments\/(\d+)\/like$/))) { const m = data.moments.find(m => m.id === Number(match[1])); if (!m) return error('动态不存在'); m.user_liked = !m.user_liked; m.like_count += m.user_liked ? 1 : -1; persist(); return ok({ action: m.user_liked ? 'liked' : 'unliked', like_count: m.like_count, user_liked: m.user_liked }); }
    if ((match = url.match(/^\/api\/v1\/crm\/moments\/(\d+)\/comment$/))) { const m = data.moments.find(m => m.id === Number(match[1])); if (!m) return error('动态不存在'); (m.comments ||= []).push({ id: nextId(m.comments || []), comment_text: body.comment_text, user: { id: user.id, name: user.name }, created_at: now() }); persist(); return ok({ comments: m.comments }); }
    if (url === '/api/config' && method === 'post') { if (Object.values(body).some(v => !/^\d+$/.test(String(v)) || Number(v) < 1)) return error('配置参数请输入正整数'); Object.assign(data.runtimeConfig, body); persist(); return ok({ msg: '配置已保存' }); }
    if (url === '/api/leads/reclaim') { let reclaimed = 0; for (const lead of data.leads) if (lead.lead_status === 'private' && (Date.now() - new Date(lead.latest_follow?.created_at || lead.created_at).getTime()) / 86400000 >= Number(data.runtimeConfig.reclaim_no_follow_days || 7)) { lead.lead_status = 'public'; lead.owner = ''; reclaimed++; } persist(); return ok({ reclaimed }); }
    return null;
  }
  return { data, handle, persist };
}
