import axios from 'axios';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const DEMO_PASSWORDS_KEY = 'crm_demo_passwords';
const IS_PAGES = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
const now = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

let users = [
  { id: 1, username: '13800138000', password: '123456', name: '张晓明', phone: '13800138000', role: 'sales' },
  { id: 2, username: '13800138001', password: '123456', name: '陈思', phone: '13800138001', role: 'sales' },
  { id: 3, username: 'admin', password: '123456', name: '系统管理员', phone: '', role: 'admin' },
];

const leads = [
  { id: 1, company_name: '深圳思科达电子有限公司', contact_name: '陈思', contact_mobile: '13800138001', lead_status: 'private', target_market: '美国', logistics_type: 'FBA', follow_count: 5, owner: '张晓明', created_at: daysAgo(30), latest_follow: { content: '确认 Q3 美森快船月度包舱计划', created_at: daysAgo(1) } },
  { id: 2, company_name: '广州恒通服装贸易有限公司', contact_name: '李经理', contact_mobile: '13800138002', lead_status: 'public', target_market: '欧洲', logistics_type: '空派', follow_count: 0, owner: '', created_at: daysAgo(14), latest_follow: { content: '新分配线索，待首次触达', created_at: daysAgo(2) } },
  { id: 3, company_name: 'AmazonSeller-DE GmbH', contact_name: 'Michael Braun', contact_mobile: '+49-176-1234567', lead_status: 'public', target_market: '欧洲', logistics_type: 'FBA', follow_count: 1, owner: '', created_at: daysAgo(10), latest_follow: { content: '客户关注德国 FBA 入仓时效', created_at: daysAgo(3) } },
];

const customers = [
  { id: 1, company_name: '深圳思科达电子有限公司', contact_name: '陈思', phone: '13800138001', country: '中国', customer_type: '直客', lifecycle_status: 'active', lifecycle_label: '合作中', customer_level: 'A', main_category: '带电产品', shipping_frequency: 'weekly', usual_routes: '盐田-洛杉矶, 美森快船', avg_monthly_revenue: 285000, avg_monthly_volume: 45.5, volume_mom: 8, monthly_order_count: 12, order_frequency_tag: 'Weekly', cooperation_since: '2023-06-01', owner: '张晓明', ownership_status: 'MY_CUSTOMER', protect_expire_at: '2026-08-30', created_at: daysAgo(400), latest_follow: { content: '客户确认下月增加 2 个 HQ 柜', created_at: daysAgo(1) }, latest_order: { tracking_number: 'TTUS260812001' }, credit: { credit_score: 760, credit_limit: 800000, balance_due: 350000, days_aged: 25, payment_terms: 'NET30', risk_notes: '优质客户，回款及时' } },
  { id: 2, company_name: '义乌欧凯进出口有限公司', contact_name: '王芳', phone: '13800138003', country: '中国', customer_type: '直客', lifecycle_status: 'negotiating', lifecycle_label: '已报价', customer_level: 'A', main_category: '日用百货', shipping_frequency: 'daily', usual_routes: '中欧班列, 卡航', avg_monthly_revenue: 420000, avg_monthly_volume: 120, volume_mom: 12, monthly_order_count: 26, order_frequency_tag: 'Daily', owner: '李强', ownership_status: 'MY_CUSTOMER', protect_expire_at: '2026-08-21', created_at: daysAgo(500), latest_follow: { content: '中欧班列报价已发，等待确认', created_at: daysAgo(2) }, credit: { credit_score: 720, credit_limit: 600000, balance_due: 180000, days_aged: 18, payment_terms: 'NET30', risk_notes: '月出货稳定，持续关注报价转化' } },
  { id: 3, company_name: '宁波远洋国际贸易有限公司', contact_name: '周董', phone: '13800138006', country: '中国', customer_type: '同行', lifecycle_status: 'active', lifecycle_label: '合作中', customer_level: 'B', main_category: '大型机械设备', shipping_frequency: 'monthly', usual_routes: '上海-鹿特丹 DDP', avg_monthly_revenue: 680000, avg_monthly_volume: 200, volume_mom: -6, monthly_order_count: 4, order_frequency_tag: 'Monthly', owner: '张晓明', ownership_status: 'EXPIRING_PROTECTION', protect_expire_at: '2026-08-18', created_at: daysAgo(330), latest_follow: { content: '讨论 Q3 包柜方案', created_at: daysAgo(4) }, credit: { credit_score: 610, credit_limit: 500000, balance_due: 120000, days_aged: 12, payment_terms: 'NET30', risk_notes: '近期货量略降，建议跟进Q3项目' } },
  { id: 4, company_name: '东莞联达塑胶制品有限公司', contact_name: '孙经理', phone: '13800138005', country: '中国', customer_type: '直客', lifecycle_status: 'disqualified', lifecycle_label: '已流失', customer_level: 'D', main_category: '塑胶制品', shipping_frequency: 'inactive', avg_monthly_revenue: 0, avg_monthly_volume: 0, volume_mom: -45, owner: '', ownership_status: 'COMPANY_POOL', pool_name: '流失召回池', created_at: daysAgo(700), latest_follow: { content: '竞品年度合约已签，进入挽回池', created_at: daysAgo(15) }, days_inactive: 44, loss_reason: '价格竞争' },
  { id: 5, company_name: '广州恒通服装贸易有限公司', contact_name: '李经理', phone: '13800138002', country: '中国', customer_type: '直客', lifecycle_status: 'active', lifecycle_label: '合作中', customer_level: 'B', main_category: '服装纺织', shipping_frequency: 'weekly', usual_routes: '广州-汉堡空派', avg_monthly_revenue: 215000, avg_monthly_volume: 38, volume_mom: 3, monthly_order_count: 8, order_frequency_tag: 'Weekly', owner: '陈思', ownership_status: 'CLOSED_CUSTOMER', closed_at: '2026-08-05', created_at: daysAgo(260), latest_follow: { content: '客户确认圣诞季备货计划，需提前预订舱位', created_at: daysAgo(3) }, credit: { credit_score: 680, credit_limit: 350000, balance_due: 95000, days_aged: 8, payment_terms: 'NET30', risk_notes: '成交客户，复购节奏稳定' } },
];

const followLabels = {
  active: '成交',
  negotiating: '报价',
  disqualified: '暂时搁置',
};

const crmCustomerRows = () => customers.map(c => {
  const ownership = c.ownership_status || (c.owner ? 'MY_CUSTOMER' : 'COMPANY_POOL');
  const ownershipLabel = {
    MY_CUSTOMER: '我的客户',
    COMPANY_POOL: '公司池',
    EXPIRING_PROTECTION: '即将掉保',
    CLOSED_CUSTOMER: '成交客户',
  }[ownership] || '我的客户';
  return {
    id: c.id,
    customer_name: c.contact_name ? `${c.company_name}` : c.company_name,
    company_name: c.company_name,
    mobile: c.phone,
    masked_mobile: c.phone ? `${String(c.phone).slice(0, 3)}****${String(c.phone).slice(-4)}` : '-',
    owner: c.owner || '',
    owner_name: c.owner || '',
    ownership_status: ownership,
    ownership_label: ownershipLabel,
    pool_name: c.pool_name || '',
    follow_status: c.lifecycle_status,
    follow_status_label: followLabels[c.lifecycle_status] || c.lifecycle_label || '初访',
    latest_follow: c.latest_follow,
    last_followup_at: c.latest_follow?.created_at,
    protect_expire_at: c.protect_expire_at,
    closed_at: c.closed_at,
    source: c.owner ? '独立开发' : '已登记',
    tags: [c.customer_type, c.customer_level, c.main_category].filter(Boolean),
    created_at: c.created_at,
  };
});

const creditRows = () => customers
  .filter(c => c.credit)
  .map(c => ({
    id: c.id,
    customer_id: c.id,
    company_name: c.company_name,
    credit_score: c.credit.credit_score || 650,
    credit_limit: c.credit.credit_limit || 0,
    balance_due: c.credit.balance_due || 0,
    days_aged: c.credit.days_aged || 0,
    payment_terms: c.credit.payment_terms || 'NET30',
    is_blacklisted: c.credit.is_blacklisted || c.lifecycle_status === 'disqualified',
    risk_notes: c.credit.risk_notes || '',
    usage_rate: c.credit.credit_limit ? Math.round((c.credit.balance_due || 0) / c.credit.credit_limit * 1000) / 10 : 0,
  }));

let inquiries = [
  { id: 1, inquiry_no: 'INQ-20260812-001', company_name: '深圳思科达电子有限公司', contact_name: '陈思', contact_mobile: '13800138001', route_type: '海派', cargo_mode: 'LCL', cargo_type: '带电产品', origin: '深圳', destination: '洛杉矶', pieces: 36, weight_kg: 1200, volume_cbm: 8.5, incoterms: 'FOB', status: 'pricing', status_label: '核价中', created_at: daysAgo(1) },
  { id: 2, inquiry_no: 'INQ-20260811-008', company_name: '义乌欧凯进出口有限公司', contact_name: '王芳', contact_mobile: '13800138003', route_type: '铁路', cargo_mode: 'FCL', cargo_type: '普货', origin: '义乌', destination: '杜伊斯堡', container_type: '40HQ', container_count: 2, weight_kg: 18000, volume_cbm: 136, incoterms: 'DDP', status: 'priced', status_label: '已出价', created_at: daysAgo(2) },
];

const quotations = [
  { id: 1, company_name: '深圳思科达电子有限公司', route_type: '海派', route_detail: '盐田 -> 洛杉矶 -> ONT8', cargo_type: '带电产品', weight_kg: 1200, volume_cbm: 8.5, total_price: 46800, base_price: 39, currency: 'RMB', status: 'sent', status_label: '已发送', valid_until: '2026-08-31', created_at: daysAgo(1) },
  { id: 2, company_name: '义乌欧凯进出口有限公司', route_type: '铁路', route_detail: '义乌 -> 杜伊斯堡', cargo_type: '普货', weight_kg: 18000, volume_cbm: 136, total_price: 84000, base_price: 42000, currency: 'RMB', status: 'accepted', status_label: '已接受', valid_until: '2026-08-25', created_at: daysAgo(3) },
];

const orders = [
  { id: 1, company_name: '深圳思科达电子有限公司', tracking_number: 'TTUS260812001', route_detail: '美森快船-洛杉矶', cargo_desc: '带电工具配件', weight_kg: 1200, volume_cbm: 8.5, status: 'transit', status_label: '运输中', origin: '盐田港', destination: '洛杉矶仓', etd: '2026-08-10', eta: '2026-08-22', has_exception: false, latest_event: '船舶已离港，预计 12 天到港', created_at: daysAgo(2) },
  { id: 2, company_name: '宁波远洋国际贸易有限公司', tracking_number: 'TTEU260808016', route_detail: '上海-鹿特丹 DDP', cargo_desc: '大型机械设备', weight_kg: 8600, volume_cbm: 32, status: 'customs', status_label: '清关中', origin: '上海港', destination: '鹿特丹', etd: '2026-08-08', eta: '2026-09-03', has_exception: true, exception_type: '海关查验', latest_event: '目的港海关查验，预计延误 2 天', created_at: daysAgo(4) },
];

let moments = [
  { id: 1, user_id: 1, user: { id: 1, name: '张晓明', phone: '13800138000' }, type: 'SYSTEM_KPI', content: '本周新签客户 3 家，运单量环比增长 12%，美森线满载率 92%。', media_urls: [], visible_type: 'ALL', created_at: daysAgo(1), like_count: 6, user_liked: false, comments: [] },
  { id: 2, user_id: 2, user: { id: 2, name: '陈思', phone: '13800138001' }, type: 'ACTIVITY', content: '思科达电子确认 Q3 美森快船月度包舱，预计月出货 100 方以上。', media_urls: [], visible_type: 'ALL', link_client: { id: 1, company_name: '深圳思科达电子有限公司' }, created_at: daysAgo(2), like_count: 4, user_liked: true, comments: [] },
];

let runtimeConfig = { reclaim_no_follow_days: '7', reclaim_no_convert_days: '30', claim_daily_limit: '5', claim_private_limit: '50' };
let SecureStore = null;
if (Platform.OS !== 'web') SecureStore = require('expo-secure-store');

const storage = {
  async getItem(key) { return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key); },
  async setItem(key, value) { return Platform.OS === 'web' ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value); },
  async deleteItem(key) { return Platform.OS === 'web' ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key); },
};

export const PUBLIC_BACKEND_URL = 'https://frontpage-closing-snake-mirror.trycloudflare.com';
const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('trycloudflare.com') || host.includes('github.io')) return PUBLIC_BACKEND_URL;
  }
  return 'http://localhost:8000';
};

export const resolveBackendUrl = (url = '') => {
  if (!url || url.startsWith('http')) return url;
  if (IS_PAGES && url.startsWith('/static/')) return '';
  return `${getBaseURL()}${url.startsWith('/') ? '' : '/'}${url}`;
};

const res = (config, data, status = 200) => ({ data, status, statusText: 'OK', headers: {}, config, request: {} });
const search = (rows, params = {}, fields = []) => {
  const kw = String(params.keyword || '').trim().toLowerCase();
  return kw ? rows.filter(row => fields.some(f => String(row[f] || '').toLowerCase().includes(kw))) : rows;
};
const publicUser = (user) => { const { password, ...safe } = user; return safe; };

const getDemoPasswords = () => {
  if (!IS_PAGES) return {};
  try {
    return JSON.parse(localStorage.getItem(DEMO_PASSWORDS_KEY) || '{}');
  } catch {
    return {};
  }
};

const getDemoPassword = (user) => getDemoPasswords()[user.username] || user.password;

const setDemoPassword = (username, password) => {
  const passwords = getDemoPasswords();
  passwords[username] = password;
  localStorage.setItem(DEMO_PASSWORDS_KEY, JSON.stringify(passwords));
};

const filterCrmCustomers = (params = {}) => {
  const tab = params.tab || 'my';
  let rows = crmCustomerRows();
  if (tab === 'my') rows = rows.filter(r => r.ownership_status === 'MY_CUSTOMER');
  if (tab === 'pool') rows = rows.filter(r => r.ownership_status === 'COMPANY_POOL');
  if (tab === 'expiring') rows = rows.filter(r => r.ownership_status === 'EXPIRING_PROTECTION');
  if (tab === 'closed') rows = rows.filter(r => r.ownership_status === 'CLOSED_CUSTOMER');
  rows = search(rows, params, ['customer_name', 'company_name', 'mobile', 'owner']);
  const allRows = crmCustomerRows();
  const tabCounts = {
    my: allRows.filter(r => r.ownership_status === 'MY_CUSTOMER').length,
    pool: allRows.filter(r => r.ownership_status === 'COMPANY_POOL').length,
    expiring: allRows.filter(r => r.ownership_status === 'EXPIRING_PROTECTION').length,
    all: allRows.length,
    closed: allRows.filter(r => r.ownership_status === 'CLOSED_CUSTOMER').length,
  };
  return { rows, tabCounts };
};

async function mockAdapter(config) {
  await new Promise(resolve => setTimeout(resolve, 80));
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '').split('?')[0];
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
  const params = config.params || {};

  if (url === '/api/auth/login') {
    const user = users.find(u => u.username === body.username && getDemoPassword(u) === body.password);
    return user ? res(config, { ok: true, msg: '登录成功', token: `demo-token-${user.id}-${Date.now()}`, user: publicUser(user) }) : res(config, { ok: false, msg: '账号或密码错误，默认账号 admin / 123456' }, 400);
  }
  if (url === '/api/auth/register') {
    const user = { id: users.length + 1, username: body.username, password: body.password, name: body.name || `用户${String(body.username).slice(-4)}`, phone: body.phone || body.username, role: 'sales' };
    users.push(user);
    return res(config, { ok: true, msg: '注册成功', token: `demo-token-${user.id}-${Date.now()}`, user: publicUser(user) });
  }
  if (url === '/api/auth/me') {
    const token = String(config.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
    return res(config, { ok: true, user: publicUser(users.find(u => u.id === Number(token.split('-')[2])) || users[0]) });
  }
  if (url === '/api/auth/change-password' && method === 'post') {
    const token = String(config.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
    const user = users.find(u => u.id === Number(token.split('-')[2]));
    if (!user) return res(config, { ok: false, msg: '登录已失效，请重新登录' }, 401);
    if (!body.current_password || !body.new_password) return res(config, { ok: false, msg: '当前密码和新密码不能为空' }, 400);
    if (String(body.new_password).length < 6) return res(config, { ok: false, msg: '新密码至少6位' }, 400);
    if (String(body.new_password).length > 128) return res(config, { ok: false, msg: '新密码不能超过128位' }, 400);
    if (getDemoPassword(user) !== body.current_password) return res(config, { ok: false, msg: '当前密码错误' }, 400);
    if (body.current_password === body.new_password) return res(config, { ok: false, msg: '新密码不能与当前密码相同' }, 400);
    setDemoPassword(user.username, body.new_password);
    return res(config, { ok: true, msg: '密码修改成功，请重新登录' });
  }
  if (url === '/api/analytics/summary') return res(config, {
    ok: true,
    cards: [
      { title: '客户总数', value: customers.length, sub: '活跃 4 家' },
      { title: '月运单量', value: orders.length, sub: '异常 1 票' },
      { title: '营收总额', value: '138.5万' },
      { title: '应收余额', value: '74.5万' },
    ],
    health_distribution: [
      { name: '健康(≥80)', value: 2, color: '#10b981' },
      { name: '注意(60-79)', value: 2, color: '#f59e0b' },
      { name: '预警(<60)', value: 1, color: '#ef4444' },
    ],
    stage_counts: { developing: leads.length, quoted: 1, cooperating: 3, churned: 1 },
  });
  if (url === '/api/leads/list') return res(config, { ok: true, leads: search(leads, params, ['company_name', 'contact_name', 'contact_mobile']) });
  if (url === '/api/customers/list') {
    let rows = customers;
    if (params.stage === 'quoted') rows = rows.filter(c => c.lifecycle_status === 'negotiating');
    if (params.stage === 'cooperating') rows = rows.filter(c => c.lifecycle_status === 'active');
    if (params.stage === 'churned') rows = rows.filter(c => c.lifecycle_status === 'disqualified');
    return res(config, { ok: true, customers: search(rows, params, ['company_name', 'contact_name', 'phone']) });
  }
  if (url === '/api/crm/customers') {
    const { rows, tabCounts } = filterCrmCustomers(params);
    return res(config, { ok: true, records: rows, total: rows.length, tab_counts: tabCounts, page: 1, page_size: Number(params.page_size || 30) });
  }
  if (/^\/api\/leads\/\d+$/.test(url)) return res(config, { ok: true, lead: leads.find(l => l.id === Number(url.split('/').pop())), follow_ups: [] });
  if (/^\/api\/customers\/\d+$/.test(url)) return res(config, { ok: true, customer: customers.find(c => c.id === Number(url.split('/').pop())), activities: [] });
  if (/^\/api\/customers\/\d+\/trend$/.test(url)) return res(config, { ok: true, trend: [{ month: '6月', volume: 36 }, { month: '7月', volume: 42 }, { month: '8月', volume: 45 }] });
  if (url === '/api/reminders/list') return res(config, { ok: true, reminders: [{ id: 1, lead_id: 2, content: '新分配线索超过 24 小时未触达，请及时跟进', is_completed: false, is_snoozed: false }, { id: 2, customer_id: 1, content: '账期 25 天，请关注回款风险', is_completed: false, is_snoozed: false }] });
  if (url === '/api/inquiries/list') return res(config, { ok: true, inquiries: search(inquiries, params, ['company_name', 'inquiry_no']) });
  if (url === '/api/quotations/list') return res(config, { ok: true, quotations });
  if (url === '/api/inquiries/create') { const item = { ...body, id: inquiries.length + 1, inquiry_no: `INQ-20260812-${String(inquiries.length + 1).padStart(3, '0')}`, status: 'pricing', status_label: '核价中', created_at: now() }; inquiries.unshift(item); return res(config, { ok: true, msg: '询价已提交', inquiry_id: item.id, inquiry_no: item.inquiry_no }); }
  if (url === '/api/orders/list') return res(config, { ok: true, orders: search(orders, params, ['company_name', 'tracking_number', 'cargo_desc']) });
  if (url === '/api/orders/exceptions') { const exceptions = orders.filter(o => o.has_exception); return res(config, { ok: true, exceptions, stats: { severe: exceptions.length, warning: 0 }, total: exceptions.length }); }
  if (/^\/api\/tracking\/\d+$/.test(url)) { const order = orders.find(o => o.id === Number(url.split('/').pop())); return res(config, { ok: true, order, events: [{ event_type: order?.has_exception ? 'exception' : 'transit', location: order?.destination || '', description: order?.latest_event || '运输中', time: now() }, { event_type: 'departure', location: order?.origin || '', description: '货物已起运', time: daysAgo(2) }] }); }
  if (url === '/api/credits/list') {
    const credits = creditRows();
    const totalBalance = credits.reduce((sum, c) => sum + (c.balance_due || 0), 0);
    const overdue = credits.filter(c => c.days_aged > 30).reduce((sum, c) => sum + (c.balance_due || 0), 0);
    return res(config, { ok: true, summary: { total_balance: totalBalance, overdue }, credits });
  }
  if (url === '/api/ai/churn_prediction') {
    const items = customers
      .filter(c => c.lifecycle_status === 'disqualified' || (c.volume_mom || 0) < -5 || (c.credit?.days_aged || 0) > 20)
      .map(c => {
        const factors = [];
        let riskScore = 30;
        if (c.lifecycle_status === 'disqualified') { riskScore += 35; factors.push(`停发${c.days_inactive || 30}天`); }
        if ((c.volume_mom || 0) < -5) { riskScore += 20; factors.push(`货量环比${c.volume_mom}%`); }
        if ((c.credit?.days_aged || 0) > 20) { riskScore += 20; factors.push(`账龄${c.credit.days_aged}天`); }
        return {
          customer_id: c.id,
          company_name: c.company_name,
          risk_score: Math.min(100, riskScore),
          factors,
          action: riskScore >= 70 ? '建议销售立即介入并复盘价格/时效问题' : '建议持续观察并补充有效跟进',
          contact_name: c.contact_name,
          phone: c.phone,
        };
      })
      .sort((a, b) => b.risk_score - a.risk_score);
    return res(config, { ok: true, high_risk_count: items.filter(i => i.risk_score >= 70).length, items });
  }
  if (url === '/api/ai/smart_quote') {
    const weight = Number(params.weight || 100);
    const volume = Number(params.volume || 1);
    const chargeable = Math.max(weight / 1000, volume);
    const base = params.route_type === '空派' ? 32 : params.route_type === '铁运' ? 8.2 : 15.8;
    const quote = Math.round(chargeable * base * 1000);
    return res(config, {
      ok: true,
      route_type: params.route_type || '海派',
      cargo_type: params.cargo_type || '普货',
      chargeable_weight: chargeable,
      estimated_days: params.route_type === '空派' ? '3-5天' : '12-18天',
      price_breakdown: { 本公司报价: quote, 竞品均价: Math.round(quote * 1.08), 节约比例: '约8%' },
      suggested_pitch: '建议主推稳定时效和异常可视化追踪，可提供季度包量优惠。',
      valid_until: daysAgo(-14).slice(0, 10),
    });
  }
  if (url === '/api/ai/voice_log') return res(config, {
    ok: true,
    original_voice: `[语音输入] 客户：${params.customer_name || '思科达'}，内容：${params.content || '电话沟通确认'}`,
    structured_log: '客户确认Q3美森快船包舱需求，预计每月5-8个方，要求DDP条款和在线轨迹订阅。',
    quality_check: { 完整度: '96%', 风险词汇: '无', 评分: '优秀' },
    auto_tags: ['发货需求', '长期合作', '价格敏感'],
  });
  if (url === '/api/ai/meeting_summary') return res(config, {
    ok: true,
    meeting_type: params.meeting_type || '客户拜访',
    pre_meeting: { brief: '该客户近3个月发货稳定增长，历史合作良好，需关注价格敏感度。', talking_points: ['强调服务稳定性', '展示在线追踪能力', '推荐组合运输方案'] },
    in_meeting: { suggested_responses: [{ if: '客户提出降价要求', then: '强调服务时效和安全性，可提供季度合约优惠' }] },
    post_meeting: {
      key_topics: ['Q3发货计划确认', '新航线需求：东南亚线', '价格调整沟通'],
      action_items: ['周五前提供东南亚线报价方案', '跟进客户Q3舱位预订', '内部讨论价格调整方案'],
      customer_requests: ['希望增加门到门服务', '要求提供在线货物追踪功能'],
      risk_flag: '客户对近期时效略有不满，需关注',
    },
    auto_fill_crm: '会议内容已自动结构化填充到客户画像，商机赢率从40%更新为55%',
  });
  if (url === '/api/v1/crm/moments' && method === 'get') return res(config, { ok: true, items: moments, total: moments.length, page: 1, page_size: 10, has_more: false });
  if (url === '/api/v1/crm/moments' && method === 'post') { moments.unshift({ id: moments.length + 1, user_id: 1, user: { id: 1, name: '张晓明' }, ...body, created_at: now(), like_count: 0, user_liked: false, comments: [] }); return res(config, { ok: true, msg: '发布成功' }); }
  if (url === '/api/config' && method === 'get') return res(config, { ok: true, config: runtimeConfig });
  if (url === '/api/config' && method === 'post') { runtimeConfig = { ...runtimeConfig, ...body }; return res(config, { ok: true, msg: '配置已保存' }); }
  if (method === 'post' || method === 'put') return res(config, { ok: true, msg: '操作成功', reclaimed: 2, urls: [] });
  return res(config, { ok: true });
}

const client = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  adapter: IS_PAGES ? mockAdapter : undefined,
});

client.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (err) => Promise.reject(new Error(err.response?.data?.msg || err.message || 'Network error'))
);

export const setToken = (token) => storage.setItem(TOKEN_KEY, token);
export const clearToken = () => storage.deleteItem(TOKEN_KEY);
export const getToken = () => storage.getItem(TOKEN_KEY);

export default client;
