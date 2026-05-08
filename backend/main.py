"""跨境物流 CRM 系统 Demo — 结合纷享销客 ShareAI 能力"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import datetime
import json
import random
from collections import defaultdict

from fastapi import FastAPI, Request, Depends, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import engine, Base, get_db
from models import (
    Lead, Customer, Opportunity, Quotation, Order,
    TrackingEvent, CreditInfo, ActivityLog, Complaint,
    ALL_STATUSES, STATUS_LABELS, TRANSITION_REQUIREMENTS,
    STATUS_NEW,
)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="跨境物流 CRM 系统", version="1.0")

app.mount("/static", StaticFiles(directory=os.path.join(_BASE_DIR, "static")), name="static")
jinja_env = Environment(loader=FileSystemLoader(os.path.join(_BASE_DIR, "templates")),
                          extensions=["jinja2.ext.loopcontrols"])


def render(name: str, request: Request, **kwargs):
    """Render a Jinja2 template with request context"""
    template = jinja_env.get_template(name)
    return HTMLResponse(template.render(request=request, **kwargs))

# ── 启动时建表 ──
Base.metadata.create_all(bind=engine)


# ═══════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════

def _now():
    return datetime.datetime.now()


def _date():
    return datetime.date.today()


def metric_value(v):
    """安全格式化指标值"""
    if v is None:
        return 0
    return v


# ═══════════════════════════════════════════════
# 页面路由
# ═══════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
def page_dashboard(request: Request, db: Session = Depends(get_db)):
    """首页仪表盘"""
    lead_count = db.query(Lead).count()
    customer_count = db.query(Customer).count()
    order_active = db.query(Order).filter(Order.status.in_(['received', 'warehouse', 'departed', 'customs', 'transit'])).count()
    total_revenue = db.query(func.sum(Quotation.total_price)).filter(Quotation.status == 'accepted').scalar() or 0
    pending_quotes = db.query(Quotation).filter(Quotation.status == 'pending').count()
    exception_orders = db.query(Order).filter(Order.has_exception == True).count()
    overdue_receivables = db.query(func.sum(CreditInfo.balance_due)).filter(
        CreditInfo.days_aged > 30
    ).scalar() or 0
    recent_activities = db.query(ActivityLog).order_by(desc(ActivityLog.created_at)).limit(8).all()

    # 航线收入分布
    route_revenue = db.query(Order.route_detail, func.count(Order.id)).filter(
        Order.status.in_(['delivered', 'arrived'])
    ).group_by(Order.route_detail).all()

    # 月度趋势 (模拟)
    month_labels = ["1月", "2月", "3月", "4月", "5月"]
    month_revenue = [420, 380, 510, 590, 680]
    month_orders = [28, 24, 33, 38, 45]

    return render("dashboard.html", request, active_page="dashboard",
        stats=dict(lead_count=lead_count, customer_count=customer_count,
            order_active=order_active, total_revenue=f"{total_revenue/10000:.1f}万",
            pending_quotes=pending_quotes, exception_orders=exception_orders,
            overdue_receivables=f"{overdue_receivables/10000:.1f}万"),
        recent_activities=recent_activities,
        route_revenue=route_revenue,
        month_labels=month_labels,
        month_revenue=month_revenue,
        month_orders=month_orders)


@app.get("/leads", response_class=HTMLResponse)
def page_leads(request: Request, db: Session = Depends(get_db)):
    """线索公海池"""
    leads = db.query(Lead).order_by(desc(Lead.created_at)).all()
    stats = {
        "total": len(leads),
        "new": len([l for l in leads if l.status == 'new']),
        "contacted": len([l for l in leads if l.status == 'contacted']),
        "trial": len([l for l in leads if l.status == 'trial']),
        "won": len([l for l in leads if l.status == 'won']),
        "unclaimed": len([l for l in leads if l.owner is None]),
    }
    return render("leads.html", request, active_page="leads", leads=leads, stats=stats)


@app.get("/customers", response_class=HTMLResponse)
def page_customers(request: Request, db: Session = Depends(get_db)):
    """客户画像与商机"""
    customers = db.query(Customer).order_by(desc(Customer.avg_monthly_revenue)).all()
    return render("customers.html", request, active_page="customers", customers=customers,
                  all_statuses=ALL_STATUSES, status_labels=STATUS_LABELS,
                  requirements=TRANSITION_REQUIREMENTS)


@app.get("/quotation", response_class=HTMLResponse)
def page_quotation(request: Request, db: Session = Depends(get_db)):
    """报价管理"""
    quotes = db.query(Quotation).order_by(desc(Quotation.created_at)).all()
    return render("quotation.html", request, active_page="quotation", quotes=quotes)


@app.get("/tracking", response_class=HTMLResponse)
def page_tracking(request: Request, db: Session = Depends(get_db)):
    """轨迹追踪与客户服务"""
    orders = db.query(Order).order_by(desc(Order.created_at)).all()
    ready_complaints = db.query(Complaint).order_by(desc(Complaint.created_at)).all()
    return render("tracking.html", request, active_page="tracking",
        orders=orders, complaints=ready_complaints)


@app.get("/risk", response_class=HTMLResponse)
def page_risk(request: Request, db: Session = Depends(get_db)):
    """风控与授信"""
    credits = db.query(CreditInfo).join(Customer).order_by(desc(CreditInfo.days_aged)).all()
    return render("risk.html", request, active_page="risk", credits=credits)


@app.get("/analytics", response_class=HTMLResponse)
def page_analytics(request: Request, db: Session = Depends(get_db)):
    """经营分析看板"""
    # 客户分级统计
    level_stats = db.query(Customer.customer_level, func.count(Customer.id)).group_by(
        Customer.customer_level).all()
    # 航线利润分析
    route_stats = db.query(Order.route_detail, func.count(Order.id), func.sum(Order.weight_kg)).group_by(
        Order.route_detail).all()
    # 流失预警: 活跃客户但近两周无新单
    two_weeks_ago = _date() - datetime.timedelta(days=14)
    churn_risk = db.query(Customer).filter(
        Customer.health_score < 60
    ).order_by(Customer.health_score).all()
    return render("analytics.html", request, active_page="analytics",
        level_stats=level_stats, route_stats=route_stats, churn_risk=churn_risk)


@app.get("/ai-assistant", response_class=HTMLResponse)
def page_ai(request: Request, db: Session = Depends(get_db)):
    """AI 智能助手 (ShareAI 能力集成)"""
    return render("ai_assistant.html", request, active_page="ai_assistant")


@app.get("/customer/{cid}", response_class=HTMLResponse)
def page_customer_detail(cid: int, request: Request, db: Session = Depends(get_db)):
    """客户详情页 — 状态流转管理"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return HTMLResponse("客户不存在", 404)
    quotes = db.query(Quotation).filter(Quotation.customer_id == cid).order_by(desc(Quotation.created_at)).all()
    orders = db.query(Order).filter(Order.customer_id == cid).order_by(desc(Order.created_at)).limit(10).all()
    activities = db.query(ActivityLog).filter(ActivityLog.customer_id == cid).order_by(desc(ActivityLog.created_at)).limit(20).all()
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == cid).first()
    opps = db.query(Opportunity).filter(Opportunity.customer_id == cid).all()
    current = cust.lifecycle_status
    return render("customer_detail.html", request, active_page="customers",
                  customer=cust, quotes=quotes, orders=orders, activities=activities,
                  credit=credit, opportunities=opps,
                  current_status_label=STATUS_LABELS.get(current, current),
                  all_statuses=ALL_STATUSES, status_labels=STATUS_LABELS,
                  requirements=TRANSITION_REQUIREMENTS)


# ═══════════════════════════════════════════════
# API 路由 - 状态流转
# ═══════════════════════════════════════════════

@app.post("/api/customer/{cid}/transition")
def transition_customer(cid: int, to_status: str = Query(...),
                        operator: str = Query("张晓明"),
                        quotation_id: int = Query(None),
                        negotiation_notes: str = Query(None),
                        order_count: int = Query(None),
                        churn_reason: str = Query(None),
                        disqualify_reason: str = Query(None),
                        remark: str = Query(None),
                        db: Session = Depends(get_db)):
    """客户状态流转 — 按文档定义的10状态规则执行"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return JSONResponse({"ok": False, "msg": "客户不存在"}, 404)
    current = cust.lifecycle_status
    # 校验目标状态是否为有效的10个状态之一
    if to_status not in ALL_STATUSES:
        return JSONResponse({"ok": False, "msg": f"无效的状态: {to_status}"}, 400)
    # 流转时的强校验（特定状态需要填写必填项）
    reqs = TRANSITION_REQUIREMENTS.get(to_status, [])
    for req in reqs:
        if req == "quotation_id" and not quotation_id:
            return JSONResponse({"ok": False, "msg": "流转到「已报价」必须关联报价单ID"}, 400)
        if req == "negotiation_notes" and not negotiation_notes:
            return JSONResponse({"ok": False, "msg": "流转到「商务谈判」必须填写谈判纪要"}, 400)
        if req == "order_count" and not order_count:
            return JSONResponse({"ok": False, "msg": "流转到「试单中」必须说明试单票数"}, 400)
        if req == "churn_reason" and not churn_reason:
            return JSONResponse({"ok": False, "msg": "流转到「已流失」必须填写流失原因"}, 400)
        if req == "disqualify_reason" and not disqualify_reason:
            return JSONResponse({"ok": False, "msg": "流转到「无效/关闭」必须填写无效原因"}, 400)
    # 3. 执行流转
    old_status = current
    cust.lifecycle_status = to_status
    cust.status_changed_at = _now()
    cust.status_changed_by = operator
    # 流转到新线索时回流公海池
    if to_status == STATUS_NEW:
        if cust.lead_id:
            lead = db.query(Lead).filter(Lead.id == cust.lead_id).first()
            if lead:
                lead.owner = None
                lead.status = STATUS_NEW
                lead.auto_reclaim = False
    # 记录活动
    extra_parts = []
    if quotation_id:
        extra_parts.append(f"关联报价单#{quotation_id}")
    if negotiation_notes:
        extra_parts.append(f"谈判纪要: {negotiation_notes}")
    if order_count:
        extra_parts.append(f"试单票数: {order_count}票")
    if churn_reason:
        extra_parts.append(f"流失原因: {churn_reason}")
    if disqualify_reason:
        extra_parts.append(f"无效原因: {disqualify_reason}")
    if remark:
        extra_parts.append(f"备注: {remark}")
    extra_str = (" | " + " | ".join(extra_parts)) if extra_parts else ""
    log = ActivityLog(
        customer_id=cid,
        activity_type="status_change",
        content=f"{STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(to_status, to_status)}{extra_str}",
        status_from=old_status,
        status_to=to_status,
        created_by=operator,
    )
    db.add(log)
    db.commit()
    return {
        "ok": True,
        "from": old_status,
        "from_label": STATUS_LABELS.get(old_status, old_status),
        "to": to_status,
        "to_label": STATUS_LABELS.get(to_status, to_status),
        "msg": f"状态已更新: {STATUS_LABELS.get(old_status, '')} → {STATUS_LABELS.get(to_status, '')}"
    }


# ═══════════════════════════════════════════════
# API 路由 - 线索管理
# ═══════════════════════════════════════════════

@app.post("/api/leads/claim")
def claim_lead(lead_id: int = Query(...), owner: str = Query("张晓明"), db: Session = Depends(get_db)):
    """认领线索"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)
    lead.owner = owner
    lead.status = "contacted"
    lead.assigned_at = _now()
    lead.last_followed = _now()
    db.commit()
    return {"ok": True}


@app.post("/api/leads/transfer")
def transfer_lead(lead_id: int = Query(...), to_owner: str = Query(...), db: Session = Depends(get_db)):
    """转移线索"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    lead.owner = to_owner
    lead.assigned_at = _now()
    db.commit()
    return {"ok": True}


@app.post("/api/leads/reclaim")
def reclaim_leads(db: Session = Depends(get_db)):
    """自动回池: 超过7天未跟进"""
    threshold = _now() - datetime.timedelta(days=7)
    leads = db.query(Lead).filter(
        Lead.last_followed < threshold,
        Lead.status.notin_(['won', 'lost'])
    ).all()
    for l in leads:
        l.owner = None
        l.auto_reclaim = True
    db.commit()
    return {"ok": True, "reclaimed": len(leads)}


# ═══════════════════════════════════════════════
# API 路由 - 客户管理
# ═══════════════════════════════════════════════

@app.get("/api/customers/{cid}")
def get_customer(cid: int, db: Session = Depends(get_db)):
    """获取客户详情含画像、商机、订单"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return JSONResponse({"ok": False}, 404)
    opps = db.query(Opportunity).filter(Opportunity.customer_id == cid).all()
    orders = db.query(Order).filter(Order.customer_id == cid).order_by(desc(Order.created_at)).limit(10).all()
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == cid).first()
    return {
        "customer": {
            "id": cust.id, "company_name": cust.company_name,
            "contact_name": cust.contact_name, "country": cust.country,
            "main_category": cust.main_category, "shipping_frequency": cust.shipping_frequency,
            "usual_routes": cust.usual_routes, "avg_monthly_volume": cust.avg_monthly_volume,
            "avg_monthly_revenue": cust.avg_monthly_revenue,
            "customer_level": cust.customer_level, "health_score": cust.health_score,
        },
        "opportunities": [{"id": o.id, "name": o.name, "stage": o.stage,
                           "amount": o.amount, "win_probability": o.win_probability} for o in opps],
        "orders": [{"id": o.id, "tracking_number": o.tracking_number,
                    "status": o.status, "route_detail": o.route_detail,
                    "has_exception": o.has_exception} for o in orders],
        "credit": {"credit_score": credit.credit_score, "credit_limit": credit.credit_limit,
                   "balance_due": credit.balance_due, "days_aged": credit.days_aged} if credit else None
    }


# ═══════════════════════════════════════════════
# API 路由 - AI 智能助手 (ShareAI 能力)
# ═══════════════════════════════════════════════

@app.get("/api/ai/customer_insight")
def ai_customer_insight(customer_id: int, db: Session = Depends(get_db)):
    """AI 客户洞察 — 模拟 ShareAI「AI销售总监」能力"""
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        return JSONResponse({"ok": False, "msg": "客户不存在"}, 404)
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == customer_id).first()
    orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(desc(Order.created_at)).limit(20).all()
    complaints = db.query(Complaint).filter(Complaint.customer_id == customer_id).all()

    # 模拟 AI 分析
    total_orders = len(orders)
    exception_rate = len([o for o in orders if o.has_exception]) / max(total_orders, 1)
    recent_stable = all(o.status in ('delivered', 'arrived') for o in orders[:3])

    if cust.health_score >= 85:
        risk_level, risk_color, risk_action = "低", "green", "维持正常服务节奏，可适度加大合作规模"
    elif cust.health_score >= 65:
        risk_level, risk_color, risk_action = "中", "orange", "关注回款周期，建议每两周进行一次客户沟通"
    else:
        risk_level, risk_color, risk_action = "高", "red", "立即排查流失原因，安排客户拜访，评估是否收紧账期"

    insights = [
        f"客户健康度评分 {cust.health_score}，处于{'优良' if cust.health_score >= 70 else '需关注'}区间",
        f"近30天发货 {total_orders} 票，{'发货节奏稳定' if recent_stable else '近期有波动，需关注'}",
        f"异常率 {exception_rate:.0%}，{'低于行业平均' if exception_rate < 0.1 else '高于行业平均，建议优化服务流程'}",
        f"当前欠款 {credit.balance_due/10000:.1f}万，账龄 {credit.days_aged} 天{'，超出正常账期' if credit.days_aged > 30 else '，在正常范围内'}",
        f"客户等级 {cust.customer_level} 级，月均贡献 {cust.avg_monthly_revenue/10000:.1f}万",
    ]

    return {
        "ok": True,
        "customer_name": cust.company_name,
        "health_score": cust.health_score,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "risk_action": risk_action,
        "insights": insights,
        "recommendations": [
            {"priority": "紧急", "action": risk_action} if risk_level == "高" else {"priority": "常规", "action": risk_action},
            {"priority": "建议", "action": "根据历史发货数据，推荐关注客户未覆盖的航线如东南亚线"},
        ],
        "score_breakdown": {
            "发货频率": min(100, int(total_orders / 20 * 100)),
            "回款及时度": max(0, 100 - credit.days_aged),
            "异常率": max(0, 100 - int(exception_rate * 100)),
            "合作深度": min(100, int(cust.avg_monthly_revenue / 500000 * 100)),
        }
    }


@app.get("/api/ai/smart_quote")
def ai_smart_quote(route_type: str = Query("海派"), weight: float = Query(100),
                    volume: float = Query(1.0), cargo_type: str = Query("普货"),
                    incoterms: str = Query("FOB")):
    """AI 智能报价 — 模拟 ShareAI「智能下单」能力"""
    base_rates = {"海派": 15.8, "空派": 32.0, "铁运": 8.2, "卡航": 10.5}
    fuel_rates = {"海派": 2.5, "空派": 5.5, "铁运": 1.0, "卡航": 1.8}
    cargo_mult = {"普货": 1.0, "带电产品": 1.2, "重货": 1.35, "纺织品": 0.95, "敏感品": 1.5}
    incoterms_mult = {"FOB": 1.0, "CIF": 1.15, "DDP": 1.35, "FCA": 1.05}

    mult = cargo_mult.get(cargo_type, 1.0) * incoterms_mult.get(incoterms, 1.0)
    base = base_rates.get(route_type, 15.0)
    fuel = fuel_rates.get(route_type, 2.0)
    chargeable = max(weight, volume * 167)  # 计费重: 体积重 vs 实重
    estimated = round(chargeable * base * mult, 2)

    return {
        "ok": True,
        "route_type": route_type,
        "chargeable_weight": round(chargeable, 1),
        "calculation": f"计费重={chargeable:.1f}kg × 单价{base * mult:.1f} = ¥{estimated}",
        "estimated_price": estimated,
        "breakdown": {
            "base_freight": round(chargeable * base, 2),
            "fuel_surcharge": round(chargeable * fuel, 2),
            "customs_fee": round(chargeable * 0.5, 2) if incoterms == "DDP" else 0,
            "estimated_total": round(estimated + chargeable * fuel + (chargeable * 0.5 if incoterms == "DDP" else 0), 2),
        },
        "market_comparison": {
            "行业均价": round(chargeable * base * mult * 1.08, 2),
            "本公司报价": round(estimated + chargeable * fuel, 2),
            "节约比例": "约8%",
        },
        "valid_until": (_date() + datetime.timedelta(days=14)).isoformat(),
    }


@app.get("/api/ai/churn_prediction")
def ai_churn_prediction(db: Session = Depends(get_db)):
    """AI 流失预警 — 模拟 ShareAI「业务洞察」能力"""
    two_weeks = _date() - datetime.timedelta(days=14)
    customers = db.query(Customer).filter(
        Customer.customer_level.in_(['B', 'C'])
    ).all()
    results = []
    for c in customers:
        recent_orders = db.query(Order).filter(
            Order.customer_id == c.id,
            Order.created_at >= two_weeks
        ).count()
        credit = db.query(CreditInfo).filter(CreditInfo.customer_id == c.id).first()
        risk_score = 0
        factors = []
        if recent_orders == 0:
            risk_score += 40
            factors.append("近14天无新订单")
        if credit and credit.days_aged > 30:
            risk_score += 30
            factors.append(f"账龄{credit.days_aged}天")
        if c.health_score < 70:
            risk_score += 20
            factors.append(f"健康分仅{c.health_score}")
        if c.customer_level == 'C':
            risk_score += 10
            factors.append("客户等级偏低")
        if risk_score >= 50:
            results.append({
                "customer_id": c.id,
                "company_name": c.company_name,
                "risk_score": risk_score,
                "factors": factors,
                "action": "建议销售介入" if risk_score >= 70 else "建议关注观察",
                "contact_name": c.contact_name,
                "phone": c.phone,
            })
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"ok": True, "high_risk_count": len([r for r in results if r["risk_score"] >= 70]),
            "items": results[:10]}


@app.get("/api/ai/voice_log")
def ai_voice_log(customer_name: str = Query("思科达"), content: str = Query("电话沟通确认"), db: Session = Depends(get_db)):
    """AI 语音录单 — 模拟 ShareAI「销售记录Agent」"""
    templates_map = {
        "报价": "客户询问了{route}运输价格，已发送报价方案，客户表示价格合理，将进一步沟通。",
        "下单": "客户确认{route}运输订单，预计{weight}kg/{vol}cbm，要求{terms}条款，下周发货。",
        "投诉": "客户反馈{issue}问题，已记录为投诉工单，承诺24小时内给出处理方案。",
        "回访": "回访客户确认上一票{order_no}已签收，客户满意服务质量，讨论后续合作计划。",
    }
    tpl = random.choice(list(templates_map.values())).format(
        route=random.choice(["美森快船", "中欧班列", "空派快件", "盐田普船"]),
        weight=random.randint(100, 5000),
        vol=random.randint(1, 30),
        terms=random.choice(["FOB", "DDP", "CIF"]),
        issue=random.choice(["时效延误", "货物破损", "清关异常", "费用争议"]),
        order_no=f"SCD{random.randint(100000, 999999)}",
    )
    log_entry = tpl
    return {
        "ok": True,
        "original_voice": f"[语音输入] 客户：{customer_name}，内容：{content}",
        "structured_log": log_entry,
        "quality_check": {
            "完整度": f"{random.randint(85, 100)}%",
            "风险词汇": "无" if random.random() > 0.2 else "建议关注：承诺时效",
            "评分": random.choice(["优秀", "良好", "合格"]),
        },
        "auto_tags": ["发货需求", "价格敏感", "长期合作"][:random.randint(1, 3)],
    }


@app.get("/api/ai/meeting_summary")
def ai_meeting_summary(meeting_type: str = Query("客户拜访")):
    """AI 会议总结 — 模拟 ShareAI「内部会议Agent」"""
    summaries = {
        "客户拜访": {
            "key_topics": ["Q3发货计划确认", "新航线需求：东南亚线", "价格调整沟通"],
            "action_items": [
                "周五前提供东南亚线报价方案",
                "跟进客户Q3舱位预订",
                "内部讨论价格调整方案"
            ],
            "customer_requests": ["希望增加门到门服务", "要求提供在线货物追踪功能"],
            "risk_flag": "客户对近期时效略有不满，需关注",
        },
        "内部复盘": {
            "key_topics": ["Q2业绩复盘", "航线利润分析", "客户流失原因讨论"],
            "action_items": [
                "优化美森线成本结构",
                "启动流失客户召回计划",
                "下周一前各销售提交Q3目标"
            ],
            "decisions": ["批准Q3东南亚线拓展计划", "同意新增2名海外仓运营人员"],
            "risk_flag": None,
        }
    }
    data = summaries.get(meeting_type, summaries["客户拜访"])

    # 模拟会前/会中/会后
    return {
        "ok": True,
        "meeting_type": meeting_type,
        "pre_meeting": {
            "brief": "该客户近3个月发货稳定增长，历史合作良好，需关注价格敏感度",
            "talking_points": ["强调服务稳定性", "展示在线追踪能力", "推荐组合运输方案"]
        },
        "in_meeting": {"suggested_responses": [
            {"if": "客户提出降价要求", "then": "强调服务时效和安全性，可提供季度合约优惠"}
        ]},
        "post_meeting": data,
        "auto_fill_crm": "会议内容已自动结构化填充到客户画像，商机赢率从40%更新为55%",
    }


# ═══════════════════════════════════════════════
# API 路由 - 运单追踪
# ═══════════════════════════════════════════════

@app.get("/api/tracking/{order_id}")
def get_tracking(order_id: int, db: Session = Depends(get_db)):
    """获取运单轨迹详情"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return JSONResponse({"ok": False, "msg": "运单不存在"}, 404)
    events = db.query(TrackingEvent).filter(
        TrackingEvent.order_id == order_id
    ).order_by(desc(TrackingEvent.event_time)).all()
    return {
        "ok": True,
        "order": {
            "id": order.id, "tracking_number": order.tracking_number,
            "route_detail": order.route_detail, "status": order.status,
            "has_exception": order.has_exception, "exception_type": order.exception_type,
            "etd": str(order.etd), "eta": str(order.eta),
        },
        "events": [{
            "event_type": e.event_type, "location": e.location,
            "description": e.description, "time": str(e.event_time),
        } for e in events]
    }


# ═══════════════════════════════════════════════
# API 路由 - 数据看板
# ═══════════════════════════════════════════════

@app.get("/api/analytics/summary")
def analytics_summary(db: Session = Depends(get_db)):
    """经营数据总览"""
    total_customers = db.query(Customer).count()
    active_customers = db.query(Order).filter(
        Order.created_at >= _date() - datetime.timedelta(days=30)
    ).distinct(Order.customer_id).count()
    total_orders = db.query(Order).count()
    exception_count = db.query(Order).filter(Order.has_exception == True).count()
    total_revenue = db.query(func.sum(Quotation.total_price)).filter(
        Quotation.status == 'accepted').scalar() or 0
    total_balance = db.query(func.sum(CreditInfo.balance_due)).scalar() or 0

    # 客户健康分布
    healthy = db.query(Customer).filter(Customer.health_score >= 80).count()
    warning = db.query(Customer).filter(Customer.health_score.between(60, 79)).count()
    critical = db.query(Customer).filter(Customer.health_score < 60).count()

    return {
        "ok": True,
        "cards": [
            {"title": "客户总数", "value": total_customers, "sub": f"活跃 {active_customers} 家"},
            {"title": "月运单量", "value": total_orders, "sub": f"异常 {exception_count} 票"},
            {"title": "营收总额", "value": f"{total_revenue/10000:.1f}万"},
            {"title": "应收余额", "value": f"{total_balance/10000:.1f}万"},
        ],
        "health_distribution": [
            {"name": "健康(≥80)", "value": healthy, "color": "#10b981"},
            {"name": "注意(60-79)", "value": warning, "color": "#f59e0b"},
            {"name": "预警(<60)", "value": critical, "color": "#ef4444"},
        ],
    }


# ═══════════════════════════════════════════════
# 启动入口
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
