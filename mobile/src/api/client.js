import axios from 'axios';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
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
  { id: 1, company_name: '深圳思科达电子有限公司', contact_name: '陈思', phone: '13800138001', country: '中国', customer_type: '直客', lifecycle_status: 'active', lifecycle_label: '合作中', customer_level: 'A', main_category: '带电产品', shipping_frequency: 'weekly', usual_routes: '盐田-洛杉矶, 美森快船', avg_monthly_revenue: 285000, avg_monthly_volume: 45.5, volume_mom: 8, monthly_order_count: 12, order_frequency_tag: 'Weekly', cooperation_since: '2023-06-01', owner: '张晓明', created_at: daysAgo(400), latest_follow: { content: '客户确认下月增加 2 个 HQ 柜', created_at: daysAgo(1) }, latest_order: { tracking_number: 'TTUS260812001' }, credit: { balance_due: 350000, days_aged: 25 } },
  { id: 2, company_name: '义乌欧凯进出口有限公司', contact_name: '王芳', phone: '13800138003', country: '中国', customer_type: '直客', lifecycle_status: 'negotiating', lifecycle_label: '已报价', customer_level: 'A', main_category: '日用百货', shipping_frequency: 'daily', usual_routes: '中欧班列, 卡航', avg_monthly_revenue: 420000, avg_monthly_volume: 120, volume_mom: 12, monthly_order_count: 26, order_frequency_tag: 'Daily', owner: '李强', created_at: daysAgo(500), latest_follow: { content: '中欧班列报价已发，等待确认', created_at: daysAgo(2) } },
  { id: 3, company_name: '宁波远洋国际贸易有限公司', contact_name: '周董', phone: '13800138006', country: '中国', customer_type: '同行', lifecycle_status: 'active', lifecycle_label: '合作中', customer_level: 'B', main_category: '大型机械设备', shipping_frequency: 'monthly', usual_routes: '上海-鹿特丹 DDP', avg_monthly_revenue: 680000, avg_monthly_volume: 200, volume_mom: -6, monthly_order_count: 4, order_frequency_tag: 'Monthly', owner: '张晓明', created_at: daysAgo(330), latest_follow: { content: '讨论 Q3 包柜方案', created_at: daysAgo(4) }, credit: { balance_due: 120000, days_aged: 12 } },
  { id: 4, company_name: '东莞联达塑胶制品有限公司', contact_name: '孙经理', phone: '13800138005', country: '中国', customer_type: '直客', lifecycle_status: 'disqualified', lifecycle_label: '已流失', customer_level: 'D', main_category: '塑胶制品', shipping_frequency: 'inactive', avg_monthly_revenue: 0, avg_monthly_volume: 0, volume_mom: -45, owner: '', created_at: daysAgo(700), latest_follow: { content: '竞品年度合约已签，进入挽回池', created_at: daysAgo(15) }, days_inactive: 44, loss_reason: '价格竞争' },
];

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

async function mockAdapter(config) {
  await new Promise(resolve => setTimeout(resolve, 80));
  const method = String(config.method || 'get').toLowerCase();
  const url = String(config.url || '').split('?')[0];
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});
  const params = config.params || {};

  if (url === '/api/auth/login') {
    const user = users.find(u => u.username === body.username && u.password === body.password);
    return user ? res(config, { ok: true, msg: '登录成功', token: `demo-token-${user.id}-${Date.now()}`, user: publicUser(user) }) : res(config, { ok: false, msg: '账号或密码错误，演示账号 13800138000 / 123456' }, 400);
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
  if (url === '/api/analytics/summary') return res(config, { ok: true, cards: [{ value: customers.length, sub: '活跃 3 家' }, { value: orders.length, sub: '异常 1 票' }, { value: '138.5万' }, { value: '47.0万' }], stage_counts: { developing: leads.length, quoted: 1, cooperating: 2, churned: 1 } });
  if (url === '/api/leads/list') return res(config, { ok: true, leads: search(leads, params, ['company_name', 'contact_name', 'contact_mobile']) });
  if (url === '/api/customers/list') {
    let rows = customers;
    if (params.stage === 'quoted') rows = rows.filter(c => c.lifecycle_status === 'negotiating');
    if (params.stage === 'cooperating') rows = rows.filter(c => c.lifecycle_status === 'active');
    if (params.stage === 'churned') rows = rows.filter(c => c.lifecycle_status === 'disqualified');
    return res(config, { ok: true, customers: search(rows, params, ['company_name', 'contact_name', 'phone']) });
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
