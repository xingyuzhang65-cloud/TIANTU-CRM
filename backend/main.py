"""跨境物流 CRM 系统 Demo — 结合纷享销客 ShareAI 能力"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
import datetime
import json
import random
import asyncio
from typing import Dict as DictType, Any
from collections import defaultdict

from fastapi import FastAPI, Request, Depends, Query, Body
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from database import engine, Base, get_db, SessionLocal
from models import (
    Lead, Customer, Opportunity, Quotation, Order,
    TrackingEvent, CreditInfo, ActivityLog, Complaint,
    FollowUp, ClaimRecord, SystemConfig, User,
    ALL_STATUSES, STATUS_LABELS, TRANSITION_REQUIREMENTS,
    STATUS_NEW,
    LEAD_STATUS_PUBLIC, LEAD_STATUS_PRIVATE, LEAD_STATUS_CONVERTED,
    LEAD_STATUS_LABELS, LOGISTICS_TYPES, TARGET_MARKETS, FOLLOW_STATUSES,
    ALL_STAGES, STAGE_LABELS, STAGE_STATUS_MAP, STATUS_TO_STAGE,
    STAGE_DEVELOPING, STAGE_NEGOTIATING, STAGE_COOPERATING, STAGE_ARCHIVED,
    STAGE_TO_DEFAULT_STATUS,
    COOPERATING_AUTO_DAYS, WARNING_MOM_THRESHOLD,
)
from jose import jwt, JWTError
import bcrypt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from metrics_engine import calc_metrics, get_6month_trend

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="跨境物流 CRM 系统", version="1.0")

app.mount("/static", StaticFiles(directory=os.path.join(_BASE_DIR, "static")), name="static")
jinja_env = Environment(loader=FileSystemLoader(os.path.join(_BASE_DIR, "templates")),
                          extensions=["jinja2.ext.loopcontrols"],
                          auto_reload=True)


# ── Pydantic request schemas ──
class ClaimData(BaseModel):
    user_id: int = 1
    user_name: str = "张晓明"

class FollowUpData(BaseModel):
    status: str = "初步沟通"
    content: str = ""
    image_urls: str = ""
    next_follow_at: str = ""
    created_by: str = ""

class ConvertData(BaseModel):
    convert_type: str = "customer"
    customer_id: int = 0
    opportunity_name: str = ""
    amount: float = 0.0
    expected_close_date: str = ""
    notes: str = ""
    operator: str = ""

class LeadCreateData(BaseModel):
    company_name: str = ""
    contact_name: str = ""
    contact_mobile: str = ""
    phone: str = ""
    email: str = ""
    source: str = ""
    country: str = ""
    target_market: str = ""
    logistics_type: str = ""
    product_interest: str = ""

class BatchIdsData(BaseModel):
    ids: list = []

class ReassignData(BaseModel):
    user_name: str = ""
    user_id: int = 0


# ── Auth config ──
SECRET_KEY = "crm-cross-border-logistics-secret-key-2024"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 720  # 30 days
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# ── Auth schemas ──
class AuthRegisterData(BaseModel):
    username: str = ""
    password: str = ""
    name: str = ""
    phone: str = ""


class AuthLoginData(BaseModel):
    username: str = ""
    password: str = ""


def create_token(user_id: int, username: str) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """Verify JWT and return current user or None"""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except (JWTError, ValueError):
        return None


def render(name: str, request: Request, **kwargs):
    """Render a Jinja2 template with request context"""
    template = jinja_env.get_template(name)
    return HTMLResponse(template.render(request=request, **kwargs))


# ═══════════════════════════════════════════════
# 公海池自动回收后台任务 (PRD 3.2)
# ═══════════════════════════════════════════════

async def auto_reclaim_scheduler():
    """
    后台定时任务：每60秒扫描一次
    1. N天未跟进 → 自动回收至公海
    2. M天未转化 → 自动回收至公海
    """
    while True:
        await asyncio.sleep(60)
        try:
            db = SessionLocal()
            now = datetime.datetime.now()
            reclaim_count = 0

            # 规则1: 未跟进回收 (N天)
            n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
            no_follow_threshold = now - datetime.timedelta(days=n_days)
            unfollowed = db.query(Lead).filter(
                Lead.lead_status == LEAD_STATUS_PRIVATE,
                Lead.last_followed != None,
                Lead.last_followed < no_follow_threshold,
            ).all()
            for l in unfollowed:
                l.lead_status = LEAD_STATUS_PUBLIC
                l.owner = None
                l.owner_id = None
                l.reclaim_deadline = None
                l.auto_reclaim = True
                reclaim_count += 1

            # 规则2: 未转化回收 (M天)
            m_days = SystemConfig.get(db, "reclaim_no_convert_days", 30)
            no_convert_threshold = now - datetime.timedelta(days=m_days)
            unconverted = db.query(Lead).filter(
                Lead.lead_status == LEAD_STATUS_PRIVATE,
                Lead.assigned_at != None,
                Lead.assigned_at < no_convert_threshold,
            ).all()
            for l in unconverted:
                if l.lead_status != LEAD_STATUS_PUBLIC:  # 避免重复回收
                    l.lead_status = LEAD_STATUS_PUBLIC
                    l.owner = None
                    l.owner_id = None
                    l.reclaim_deadline = None
                    l.auto_reclaim = True
                    reclaim_count += 1

            if reclaim_count > 0:
                db.commit()
                print(f"🔄 自动回收: {reclaim_count}条线索回笼至公海")
            db.close()
        except Exception as e:
            print(f"⚠️ 自动回收任务异常: {e}")


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    asyncio.create_task(auto_reclaim_scheduler())
    asyncio.create_task(daily_metrics_scheduler())
    print("⚙️  公海池自动回收调度器已启动 (每60秒检测)")
    print("📊 客户指标每日计算调度器已启动")


async def daily_metrics_scheduler():
    """每日凌晨执行客户指标全量计算 (同时每5分钟检查一次是否到了新的一天)"""
    last_run_date = None
    while True:
        await asyncio.sleep(300)  # 每5分钟检查一次
        today = datetime.date.today()
        if last_run_date == today:
            continue
        try:
            count = calc_metrics()
            last_run_date = today
            print(f"📊 客户指标计算完成: {count}家客户已更新 (MoM/YoY/健康分/频率标签)")
        except Exception as e:
            print(f"⚠️ 指标计算异常: {e}")


# ── 启动时建表──
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

# ═══════════════════════════════════════════════
# API 路由 - 用户认证
# ═══════════════════════════════════════════════

@app.post("/api/auth/register")
def auth_register(data: AuthRegisterData, db: Session = Depends(get_db)):
    """用户注册"""
    username = (data.username or "").strip()
    password = (data.password or "").strip()
    name = (data.name or "").strip()
    phone = (data.phone or "").strip()
    if not username or not password:
        return JSONResponse({"ok": False, "msg": "手机号和密码不能为空"}, 400)
    if len(password) < 6:
        return JSONResponse({"ok": False, "msg": "密码至少6位"}, 400)
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        return JSONResponse({"ok": False, "msg": "该手机号已注册"}, 400)
    user = User(
        username=username,
        password_hash=hash_password(password),
        name=name or f"用户{username[-4:]}",
        phone=phone or username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.username)
    return {
        "ok": True,
        "msg": "注册成功",
        "token": token,
        "user": {"id": user.id, "username": user.username, "name": user.name, "phone": user.phone, "role": user.role},
    }


@app.post("/api/auth/login")
def auth_login(data: AuthLoginData, db: Session = Depends(get_db)):
    """用户登录"""
    username = (data.username or "").strip()
    password = (data.password or "").strip()
    if not username or not password:
        return JSONResponse({"ok": False, "msg": "请输入手机号和密码"}, 400)
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return JSONResponse({"ok": False, "msg": "账号不存在"}, 400)
    if not verify_password(password, user.password_hash):
        return JSONResponse({"ok": False, "msg": "密码错误"}, 400)
    token = create_token(user.id, user.username)
    return {
        "ok": True,
        "msg": "登录成功",
        "token": token,
        "user": {"id": user.id, "username": user.username, "name": user.name, "phone": user.phone, "role": user.role},
    }


@app.get("/api/auth/me")
def auth_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    if not current_user:
        return JSONResponse({"ok": False, "msg": "未登录"}, 401)
    return {
        "ok": True,
        "user": {
            "id": current_user.id, "username": current_user.username,
            "name": current_user.name, "phone": current_user.phone, "role": current_user.role,
        },
    }


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
    """线索公海池 (PRD v1.0)"""
    leads = db.query(Lead).order_by(desc(Lead.created_at)).all()
    now = _now()

    # 计算每条线索的回收倒计时(小时)
    lead_data = []
    for l in leads:
        countdown = None
        if l.lead_status == LEAD_STATUS_PRIVATE and l.reclaim_deadline:
            delta = l.reclaim_deadline - now
            countdown = max(0, int(delta.total_seconds() / 3600))
        lead_data.append({
            "obj": l,
            "countdown": countdown,
            "is_urgent": countdown is not None and countdown < 24,
        })

    stats = {
        "total": len(leads),
        "public_count": len([l for l in leads if l.lead_status == LEAD_STATUS_PUBLIC]),
        "private_count": len([l for l in leads if l.lead_status == LEAD_STATUS_PRIVATE]),
        "converted_count": len([l for l in leads if l.lead_status == LEAD_STATUS_CONVERTED]),
    }

    # 系统配置
    config = {}
    for key in ["reclaim_no_follow_days", "reclaim_no_convert_days", "claim_daily_limit", "claim_private_limit"]:
        config[key] = SystemConfig.get(db, key, 7)

    return render("leads.html", request, active_page="leads",
                  leads=lead_data, stats=stats, config=config,
                  logistics_types=LOGISTICS_TYPES, target_markets=TARGET_MARKETS,
                  follow_statuses=FOLLOW_STATUSES,
                  lead_status_labels=LEAD_STATUS_LABELS)


@app.get("/customers", response_class=HTMLResponse)
def page_customers(request: Request, db: Session = Depends(get_db)):
    """客户画像与商机 (PRD V2.0 卡片式布局)"""
    customers = db.query(Customer).order_by(desc(Customer.avg_monthly_revenue)).all()
    now = _now()

    # 为每个客户构建完整的指标数据 + V2 stage映射
    customer_data = []
    warning_count = 0
    for c in customers:
        # MoM趋势 (PRD V2: -20%阈值对比 >20%红色预警, 0-20%黄色, 上升绿色)
        mom = c.volume_mom or 0
        if mom > 5:
            mom_trend = "up"
        elif mom < WARNING_MOM_THRESHOLD:
            mom_trend = "down"
        elif mom < 0:
            mom_trend = "mild_down"
        else:
            mom_trend = "flat"

        # V2 4阶段映射
        stage = STATUS_TO_STAGE.get(c.lifecycle_status, STAGE_DEVELOPING)

        if c.is_warning:
            warning_count += 1

        customer_data.append({
            "obj": c,
            "mom_trend": mom_trend,
            "mom_value": abs(mom),
            "stage": stage,
            "stage_label": STAGE_LABELS.get(stage, stage),
        })

    return render("customers.html", request, active_page="customers",
                  customers=customer_data, all_statuses=ALL_STATUSES,
                  status_labels=STATUS_LABELS,
                  requirements=TRANSITION_REQUIREMENTS,
                  all_stages=ALL_STAGES, stage_labels=STAGE_LABELS,
                  stage_status_map=STAGE_STATUS_MAP, status_to_stage=STATUS_TO_STAGE,
                  stage_to_default=STAGE_TO_DEFAULT_STATUS,
                  warning_count=warning_count, warning_threshold=abs(WARNING_MOM_THRESHOLD))


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
    """客户详情页 — 状态流转管理 + PRD指标"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return HTMLResponse("客户不存在", 404)
    quotes = db.query(Quotation).filter(Quotation.customer_id == cid).order_by(desc(Quotation.created_at)).all()
    orders = db.query(Order).filter(Order.customer_id == cid).order_by(desc(Order.created_at)).limit(10).all()
    activities = db.query(ActivityLog).filter(ActivityLog.customer_id == cid).order_by(desc(ActivityLog.created_at)).limit(20).all()
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == cid).first()
    opps = db.query(Opportunity).filter(Opportunity.customer_id == cid).all()
    current = cust.lifecycle_status

    # 线索溯源
    lead_info = None
    if cust.lead_id:
        lead = db.query(Lead).filter(Lead.id == cust.lead_id).first()
        if lead:
            lead_info = lead

    # V2 阶段映射
    stage = STATUS_TO_STAGE.get(cust.lifecycle_status, STAGE_DEVELOPING)

    return render("customer_detail.html", request, active_page="customers",
                  customer=cust, quotes=quotes, orders=orders, activities=activities,
                  credit=credit, opportunities=opps,
                  lead_info=lead_info,
                  current_status_label=STATUS_LABELS.get(current, current),
                  all_statuses=ALL_STATUSES, status_labels=STATUS_LABELS,
                  requirements=TRANSITION_REQUIREMENTS,
                  stage=stage, stage_label=STAGE_LABELS.get(stage, stage),
                  status_to_stage=STATUS_TO_STAGE, stage_labels=STAGE_LABELS,
                  all_stages=ALL_STAGES, stage_to_default=STAGE_TO_DEFAULT_STATUS,
                  warning_threshold=abs(WARNING_MOM_THRESHOLD))


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
    # 支持 PRD V2 4阶段名称: 自动映射为底层状态
    if to_status in ALL_STAGES:
        actual_status = STAGE_TO_DEFAULT_STATUS.get(to_status, to_status)
    elif to_status in ALL_STATUSES:
        actual_status = to_status
    else:
        return JSONResponse({"ok": False, "msg": f"无效的状态: {to_status}"}, 400)
    # 流转时的强校验（特定状态需要填写必填项）
    reqs = TRANSITION_REQUIREMENTS.get(actual_status, [])
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
    cust.lifecycle_status = actual_status
    cust.status_changed_at = _now()
    cust.status_changed_by = operator
    # 流转到新线索时回流公海池
    if actual_status == STATUS_NEW:
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
        content=f"{STATUS_LABELS.get(old_status, old_status)} → {STATUS_LABELS.get(actual_status, actual_status)}{extra_str}",
        status_from=old_status,
        status_to=actual_status,
        created_by=operator,
    )
    db.add(log)
    db.commit()
    return {
        "ok": True,
        "from": old_status,
        "from_label": STATUS_LABELS.get(old_status, old_status),
        "to": actual_status,
        "to_label": STATUS_LABELS.get(actual_status, actual_status),
        "msg": f"状态已更新: {STATUS_LABELS.get(old_status, '')} → {STATUS_LABELS.get(actual_status, '')}"
    }


# ═══════════════════════════════════════════════
# API 路由 - 线索管理
# ═══════════════════════════════════════════════

@app.post("/api/leads/claim")
def claim_lead(lead_id: int = Query(...), owner: str = Query("张晓明"), db: Session = Depends(get_db)):
    """认领线索 — 自动进入客户与商机"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)
    lead.owner = owner
    lead.lead_status = LEAD_STATUS_PRIVATE
    lead.status = "contacted"
    lead.assigned_at = _now()
    lead.last_followed = _now()
    n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
    lead.reclaim_deadline = _now() + datetime.timedelta(days=n_days)

    # ── 自动创建客户（进入客户与商机页面）──
    existing = db.query(Customer).filter(
        (Customer.lead_id == lead_id) |
        ((Customer.company_name == lead.company_name) & (Customer.phone == lead.contact_mobile))
    ).first()
    if not existing:
        customer = Customer(
            lead_id=lead.id,
            company_name=lead.company_name,
            contact_name=lead.contact_name,
            phone=lead.contact_mobile,
            email=lead.email,
            country=lead.country or lead.target_market,
            main_category=lead.product_interest or "",
            lifecycle_status=STATUS_NEW,
            status_changed_at=_now(),
            status_changed_by=owner,
            owner=owner,
        )
        db.add(customer)
        db.flush()
        db.add(ActivityLog(
            lead_id=lead_id, customer_id=customer.id,
            activity_type="status_change",
            content=f"线索由{owner}认领，自动进入客户管理-开发中阶段",
            status_from=None, status_to=STATUS_NEW,
            created_by=owner,
        ))
    else:
        existing.owner = owner

    db.commit()
    return {"ok": True, "msg": f"认领成功，已同步至客户与商机"}


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
    """手动触发自动回收 (管理员): 使用可配置的N/M参数"""
    now = _now()
    n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
    m_days = SystemConfig.get(db, "reclaim_no_convert_days", 30)

    no_follow_threshold = now - datetime.timedelta(days=n_days)
    no_convert_threshold = now - datetime.timedelta(days=m_days)

    reclaimed = db.query(Lead).filter(
        Lead.lead_status == LEAD_STATUS_PRIVATE,
        or_(
            Lead.last_followed < no_follow_threshold,
            Lead.assigned_at < no_convert_threshold,
        )
    ).all()

    count = 0
    for l in reclaimed:
        l.lead_status = LEAD_STATUS_PUBLIC
        l.owner = None
        l.owner_id = None
        l.reclaim_deadline = None
        l.auto_reclaim = True
        count += 1
    db.commit()
    return {"ok": True, "reclaimed": count, "params": {"N_days": n_days, "M_days": m_days}}


# ═══════════════════════════════════════════════
# API 路由 - 线索管理 (PRD v1.0 完整实现)
# ═══════════════════════════════════════════════

@app.get("/api/leads/list")
def api_lead_list(
    target_market: str = Query(None),
    logistics_type: str = Query(None),
    follow_status: str = Query(None),
    pool: str = Query(None, comment="private/public/all"),
    keyword: str = Query(None),
    db: Session = Depends(get_db),
):
    """线索列表 (PRD 5.1): 支持多维度筛选"""
    q = db.query(Lead)
    if target_market:
        q = q.filter(Lead.target_market == target_market)
    if logistics_type:
        q = q.filter(Lead.logistics_type == logistics_type)
    if pool == "public":
        q = q.filter(Lead.lead_status == LEAD_STATUS_PUBLIC)
    elif pool == "private":
        q = q.filter(Lead.lead_status == LEAD_STATUS_PRIVATE)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            Lead.company_name.ilike(kw) | Lead.contact_mobile.ilike(kw) | Lead.contact_name.ilike(kw)
        )
    leads = q.order_by(Lead.created_at.desc()).all()
    now = _now()
    result = []
    for l in leads:
        # 计算回收倒计时
        countdown = None
        if l.lead_status == LEAD_STATUS_PRIVATE and l.reclaim_deadline:
            delta = l.reclaim_deadline - now
            countdown = max(0, int(delta.total_seconds() / 3600))
        result.append({
            "id": l.id, "company_name": l.company_name,
            "contact_name": l.contact_name, "contact_mobile": l.contact_mobile,
            "logistics_type": l.logistics_type, "target_market": l.target_market,
            "lead_status": l.lead_status,
            "lead_status_label": LEAD_STATUS_LABELS.get(l.lead_status, ""),
            "owner": l.owner, "owner_id": l.owner_id,
            "follow_count": l.follow_count,
            "last_followed": str(l.last_followed) if l.last_followed else None,
            "next_follow_at": str(l.next_follow_at) if l.next_follow_at else None,
            "created_at": str(l.created_at),
            "reclaim_countdown_hours": countdown,
            "source": l.source,
            "country": l.country,
        })
    return {"ok": True, "leads": result, "total": len(result)}


@app.get("/api/leads/{lead_id}")
def api_lead_detail(lead_id: int, db: Session = Depends(get_db)):
    """线索详情"""
    l = db.query(Lead).filter(Lead.id == lead_id).first()
    if not l:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)
    follow_ups = db.query(FollowUp).filter(
        FollowUp.lead_id == lead_id
    ).order_by(FollowUp.created_at.desc()).all()
    now = _now()
    countdown = None
    if l.lead_status == LEAD_STATUS_PRIVATE and l.reclaim_deadline:
        delta = l.reclaim_deadline - now
        countdown = max(0, int(delta.total_seconds() / 3600))
    return {
        "ok": True,
        "lead": {
            "id": l.id, "company_name": l.company_name,
            "contact_name": l.contact_name, "contact_mobile": l.contact_mobile,
            "phone": l.phone, "email": l.email,
            "logistics_type": l.logistics_type, "target_market": l.target_market,
            "source": l.source, "country": l.country,
            "product_interest": l.product_interest,
            "lead_status": l.lead_status,
            "lead_status_label": LEAD_STATUS_LABELS.get(l.lead_status, ""),
            "owner": l.owner, "owner_id": l.owner_id,
            "follow_count": l.follow_count,
            "last_followed": str(l.last_followed) if l.last_followed else None,
            "next_follow_at": str(l.next_follow_at) if l.next_follow_at else None,
            "reclaim_deadline": str(l.reclaim_deadline) if l.reclaim_deadline else None,
            "reclaim_countdown_hours": countdown,
            "created_at": str(l.created_at),
            "converted_at": str(l.converted_at) if l.converted_at else None,
            "converted_to_type": l.converted_to_type,
        },
        "follow_ups": [{
            "id": f.id, "status": f.status, "content": f.content,
            "next_follow_at": str(f.next_follow_at) if f.next_follow_at else None,
            "created_by": f.created_by,
            "created_at": str(f.created_at),
        } for f in follow_ups],
    }


@app.post("/api/leads/create")
def api_lead_create(data: LeadCreateData, db: Session = Depends(get_db)):
    """创建线索 (PRD 3.1): 含强制查重逻辑"""
    company_name = (data.company_name or "").strip()
    contact_mobile = (data.contact_mobile or "").strip()
    if not company_name or not contact_mobile:
        return JSONResponse({"ok": False, "msg": "公司名称和手机号为必填项"}, 400)

    # 判重：按手机号 或 公司名称
    existing = db.query(Lead).filter(
        (Lead.contact_mobile == contact_mobile) | (Lead.company_name == company_name)
    ).first()

    if existing:
        if existing.lead_status == LEAD_STATUS_PRIVATE:
            return {
                "ok": False,
                "duplicate": True,
                "msg": f"该线索已由销售{existing.owner or '未知'}跟进中",
                "existing_lead_id": existing.id,
                "existing_owner": existing.owner,
                "in_pool": "private",
            }
        elif existing.lead_status == LEAD_STATUS_PUBLIC:
            return {
                "ok": False,
                "duplicate": True,
                "msg": "该线索已在公海，可直接认领",
                "existing_lead_id": existing.id,
                "existing_owner": None,
                "in_pool": "public",
            }
        else:
            return {
                "ok": False,
                "duplicate": True,
                "msg": "该线索已转化，不可重复创建",
                "existing_lead_id": existing.id,
                "in_pool": "converted",
            }

    lead = Lead(
        company_name=company_name,
        contact_name=data.contact_name or "",
        contact_mobile=contact_mobile,
        phone=data.phone or contact_mobile,
        email=data.email or "",
        source=data.source or "",
        country=data.country or "",
        target_market=data.target_market or "",
        logistics_type=data.logistics_type or "",
        product_interest=data.product_interest or "",
        lead_status=LEAD_STATUS_PUBLIC,
        status=STATUS_NEW,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return {"ok": True, "lead_id": lead.id, "msg": "线索创建成功，已进入公海池"}


@app.post("/api/leads/{lead_id}/claim")
def api_lead_claim(
    lead_id: int, data: ClaimData, db: Session = Depends(get_db)
):
    """认领线索 (PRD 3.2): 含每日上限和私海总量限制"""
    user_id = data.user_id
    user_name = data.user_name

    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)
    if lead.lead_status != LEAD_STATUS_PUBLIC:
        return JSONResponse({"ok": False, "msg": "该线索不在公海，无法认领"}, 400)

    today = _date()
    today_claims = db.query(ClaimRecord).filter(
        ClaimRecord.user_id == user_id,
        ClaimRecord.claimed_at >= today,
    ).count()
    daily_limit = SystemConfig.get(db, "claim_daily_limit", 5)
    if today_claims >= daily_limit:
        return JSONResponse({"ok": False, "msg": f"今日认领已达上限({daily_limit}条)，请明天再试"}, 400)

    private_count = db.query(Lead).filter(
        Lead.owner_id == user_id,
        Lead.lead_status == LEAD_STATUS_PRIVATE,
    ).count()
    private_limit = SystemConfig.get(db, "claim_private_limit", 50)
    if private_count >= private_limit:
        return JSONResponse({"ok": False, "msg": f"私海线索已达上限({private_limit}条)，请先清理无效线索"}, 400)

    lead.owner = user_name
    lead.owner_id = user_id
    lead.lead_status = LEAD_STATUS_PRIVATE
    lead.assigned_at = _now()
    lead.last_followed = _now()

    n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
    lead.reclaim_deadline = _now() + datetime.timedelta(days=n_days)

    db.add(ClaimRecord(lead_id=lead_id, user_id=user_id, user_name=user_name))
    db.flush()

    existing_customer = db.query(Customer).filter(
        (Customer.lead_id == lead_id) |
        ((Customer.company_name == lead.company_name) & (Customer.phone == lead.contact_mobile))
    ).first()
    if not existing_customer:
        customer = Customer(
            lead_id=lead.id,
            company_name=lead.company_name,
            contact_name=lead.contact_name,
            phone=lead.contact_mobile,
            email=lead.email,
            country=lead.country or lead.target_market,
            main_category=lead.product_interest or "",
            lifecycle_status=STATUS_NEW,
            status_changed_at=_now(),
            status_changed_by=user_name,
            owner=user_name,
            owner_id=user_id,
        )
        db.add(customer)
        db.flush()
        db.add(ActivityLog(
            lead_id=lead_id, customer_id=customer.id,
            activity_type="status_change",
            content=f"线索由{user_name}认领，自动进入客户管理-开发中阶段",
            status_from=None, status_to=STATUS_NEW,
            created_by=user_name,
        ))
    else:
        existing_customer.owner = user_name
        existing_customer.owner_id = user_id

    db.commit()
    return {"ok": True, "msg": f"认领成功，请在{n_days}天内完成首次跟进，已同步至客户与商机"}


@app.post("/api/leads/{lead_id}/follow-up")
def api_lead_follow_up(
    lead_id: int, data: FollowUpData, db: Session = Depends(get_db)
):
    """添加跟进记录 (PRD 3.3)"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)

    nft = None
    if data.next_follow_at:
        try: nft = datetime.datetime.fromisoformat(data.next_follow_at)
        except: pass

    fu = FollowUp(
        lead_id=lead_id,
        status=data.status,
        content=data.content,
        image_urls=data.image_urls or None,
        next_follow_at=nft,
        created_by=data.created_by or lead.owner or "",
    )
    db.add(fu)

    lead.last_followed = _now()
    lead.follow_count = (lead.follow_count or 0) + 1
    if data.next_follow_at:
        try: lead.next_follow_at = datetime.datetime.fromisoformat(data.next_follow_at)
        except: pass

    n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
    lead.reclaim_deadline = _now() + datetime.timedelta(days=n_days)
    lead.auto_reclaim = False

    linked_customer = db.query(Customer).filter(Customer.lead_id == lead_id).first()
    if linked_customer:
        db.add(ActivityLog(
            lead_id=lead_id,
            customer_id=linked_customer.id,
            activity_type="call",
            content=f"[线索跟进] {fu.status}: {fu.content}",
            created_by=fu.created_by,
        ))

    db.commit()
    db.refresh(fu)
    return {"ok": True, "follow_up_id": fu.id, "msg": "跟进记录已保存，回收倒计时已重置"}


@app.post("/api/leads/{lead_id}/convert")
def api_lead_convert(
    lead_id: int, data: ConvertData, db: Session = Depends(get_db)
):
    """线索转化 (PRD 3.4): 转商机或转客户"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)

    convert_type = data.convert_type

    lead.lead_status = LEAD_STATUS_CONVERTED
    lead.converted_at = _now()
    lead.converted_to_type = convert_type

    if convert_type == "customer":
        # 优先复用认领时自动创建的客户
        existing = db.query(Customer).filter(Customer.lead_id == lead_id).first()
        if existing:
            existing.lifecycle_status = STATUS_NURTURING
            existing.status_changed_at = _now()
            existing.status_changed_by = data.operator or lead.owner or ""
            customer = existing
            db.flush()
        else:
            customer = Customer(
                lead_id=lead.id,
                company_name=lead.company_name,
                contact_name=lead.contact_name,
                phone=lead.contact_mobile,
                email=lead.email,
                country=lead.country or lead.target_market,
                lifecycle_status=STATUS_NURTURING,
                status_changed_at=_now(),
                status_changed_by=data.operator or lead.owner or "",
            )
            db.add(customer)
            db.flush()
        lead.converted_to_id = customer.id
        msg = f"已转化为客户: {customer.company_name}"
    else:
        customer_id = data.customer_id
        if not customer_id:
            return JSONResponse({"ok": False, "msg": "转商机需要指定关联客户ID"}, 400)
        opp = Opportunity(
            customer_id=customer_id,
            name=data.opportunity_name or f"{lead.company_name}商机",
            stage="initial",
            amount=data.amount or 0,
            expected_close_date=datetime.date.fromisoformat(data.expected_close_date) if data.expected_close_date else None,
            notes=data.notes or "",
        )
        db.add(opp)
        db.flush()
        lead.converted_to_id = opp.id
        msg = f"已转化为商机: {opp.name}"

    db.commit()
    return {"ok": True, "msg": msg, "converted_to_id": lead.converted_to_id}


@app.post("/api/leads/batch-to-pool")
def api_lead_batch_to_pool(data: BatchIdsData, db: Session = Depends(get_db)):
    """批量放入公海 (PRD 5.2)"""
    ids = data.ids
    if not ids:
        return JSONResponse({"ok": False, "msg": "请选择至少一条线索"}, 400)
    updated = db.query(Lead).filter(Lead.id.in_(ids)).update(
        {"lead_status": LEAD_STATUS_PUBLIC, "owner": None, "owner_id": None,
         "reclaim_deadline": None, "auto_reclaim": False},
        synchronize_session="fetch"
    )
    db.commit()
    return {"ok": True, "msg": f"已将{updated}条线索放回公海"}


@app.post("/api/leads/{lead_id}/reassign")
def api_lead_reassign(
    lead_id: int, data: ReassignData, db: Session = Depends(get_db)
):
    """主管手动分配线索 (PRD 3.2)"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        return JSONResponse({"ok": False, "msg": "线索不存在"}, 404)

    lead.owner = data.user_name or ""
    lead.owner_id = data.user_id
    lead.lead_status = LEAD_STATUS_PRIVATE
    lead.assigned_at = _now()
    lead.last_followed = _now()
    n_days = SystemConfig.get(db, "reclaim_no_follow_days", 7)
    lead.reclaim_deadline = _now() + datetime.timedelta(days=n_days)
    lead.auto_reclaim = False

    # ── 自动创建/更新客户记录 ──
    existing_customer = db.query(Customer).filter(
        (Customer.lead_id == lead_id) |
        ((Customer.company_name == lead.company_name) & (Customer.phone == lead.contact_mobile))
    ).first()
    if not existing_customer:
        customer = Customer(
            lead_id=lead.id,
            company_name=lead.company_name,
            contact_name=lead.contact_name,
            phone=lead.contact_mobile,
            email=lead.email,
            country=lead.country or lead.target_market,
            main_category=lead.product_interest or "",
            lifecycle_status=STATUS_NEW,
            status_changed_at=_now(),
            status_changed_by=lead.owner,
            owner=lead.owner,
            owner_id=lead.owner_id,
        )
        db.add(customer)
    else:
        existing_customer.owner = lead.owner
        existing_customer.owner_id = lead.owner_id

    db.commit()
    return {"ok": True, "msg": f"已分配给{lead.owner}，回收倒计时已重置，已同步至客户与商机"}


# ═══════════════════════════════════════════════
# API 路由 - 系统配置
# ═══════════════════════════════════════════════

@app.get("/api/config")
def api_get_config(db: Session = Depends(get_db)):
    """获取系统配置参数"""
    defaults = SystemConfig.get_all_defaults()
    result = {}
    for key in defaults:
        result[key] = SystemConfig.get(db, key, int(defaults[key][0]))
    return {"ok": True, "config": result}


@app.post("/api/config")
def api_update_config(data: DictType[str, Any] = Body(default={}), db: Session = Depends(get_db)):
    """更新系统配置参数 (管理员)"""
    for key, value in data.items():
        cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if cfg:
            cfg.value = str(value)
            cfg.updated_at = _now()
    db.commit()
    return {"ok": True, "msg": "配置已更新"}


@app.get("/api/enums")
def api_get_enums():
    """获取枚举值列表"""
    return {
        "logistics_types": LOGISTICS_TYPES,
        "target_markets": TARGET_MARKETS,
        "follow_statuses": FOLLOW_STATUSES,
        "lead_statuses": [{"value": k, "label": v} for k, v in LEAD_STATUS_LABELS.items()],
    }


# ═══════════════════════════════════════════════
# API 路由 - 客户管理 (PRD 客户与商机模块)
# ═══════════════════════════════════════════════

@app.get("/api/customers/list")
def api_customer_list(
    status: str = Query(None),
    level: str = Query(None),
    health: str = Query(None),
    keyword: str = Query(None),
    db: Session = Depends(get_db),
):
    """客户列表 (PRD §4): 支持状态Tab/等级/健康度筛选"""
    q = db.query(Customer)
    if status:
        q = q.filter(Customer.lifecycle_status == status)
    if level:
        q = q.filter(Customer.customer_level == level)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(Customer.company_name.ilike(kw) | Customer.contact_name.ilike(kw))
    customers = q.order_by(desc(Customer.avg_monthly_revenue)).all()

    result = []
    for c in customers:
        result.append({
            "id": c.id, "lead_id": c.lead_id,
            "company_name": c.company_name, "contact_name": c.contact_name,
            "phone": c.phone, "email": c.email, "country": c.country,
            "main_category": c.main_category,
            "shipping_frequency": c.shipping_frequency,
            "usual_routes": c.usual_routes,
            "customer_level": c.customer_level,
            "lifecycle_status": c.lifecycle_status,
            "lifecycle_label": STATUS_LABELS.get(c.lifecycle_status, c.lifecycle_status),
            "avg_monthly_volume": c.avg_monthly_volume,
            "avg_monthly_revenue": c.avg_monthly_revenue,
            "volume_mom": c.volume_mom,
            "volume_yoy": c.volume_yoy,
            "monthly_order_count": c.monthly_order_count,
            "order_frequency_tag": c.order_frequency_tag,
            "cooperation_since": str(c.cooperation_since) if c.cooperation_since else None,
            "owner": c.owner,
            "created_at": str(c.created_at),
        })
    return {"ok": True, "customers": result, "total": len(result)}


@app.get("/api/customers/{cid}/orders")
def api_customer_orders(cid: int, db: Session = Depends(get_db)):
    """运单钻取: 最近10笔运单 (PRD §4 数据穿透)"""
    orders = db.query(Order).filter(
        Order.customer_id == cid
    ).order_by(desc(Order.created_at)).limit(10).all()
    return {
        "ok": True,
        "orders": [{
            "id": o.id, "tracking_number": o.tracking_number,
            "route_detail": o.route_detail, "cargo_desc": o.cargo_desc,
            "weight_kg": o.weight_kg, "volume_cbm": o.volume_cbm,
            "status": o.status, "etd": str(o.etd) if o.etd else None,
            "eta": str(o.eta) if o.eta else None,
            "has_exception": o.has_exception, "exception_type": o.exception_type,
            "created_at": str(o.created_at),
        } for o in orders],
    }


@app.get("/api/customers/{cid}/metrics")
def api_customer_metrics(cid: int, db: Session = Depends(get_db)):
    """客户指标详情 (PRD §3 算法)"""
    c = db.query(Customer).filter(Customer.id == cid).first()
    if not c:
        return JSONResponse({"ok": False, "msg": "客户不存在"}, 404)
    return {
        "ok": True,
        "metrics": {
            "volume_mom": c.volume_mom,
            "volume_yoy": c.volume_yoy,
            "monthly_order_count": c.monthly_order_count,
            "prev_month_volume": c.prev_month_volume,
            "order_frequency_tag": c.order_frequency_tag,
            "avg_monthly_volume": c.avg_monthly_volume,
            "avg_monthly_revenue": c.avg_monthly_revenue,
            "last_calc_at": str(c.last_metrics_calc_at) if c.last_metrics_calc_at else None,
        },
    }


@app.post("/api/customers/metrics/calculate")
def api_trigger_metrics_calc(db: Session = Depends(get_db)):
    """手动触发全量指标计算"""
    count = calc_metrics()
    return {"ok": True, "msg": f"已更新 {count} 家客户指标", "count": count}


@app.get("/api/customers/{cid}/trend")
def api_customer_trend(cid: int):
    """近6个月货量走势 (PRD V2 §5: 数据穿透)"""
    return {"ok": True, "trend": get_6month_trend(cid)}


@app.post("/api/customer/{cid}/add-activity")
def api_customer_add_activity(
    cid: int,
    activity_type: str = Query("call"),
    content: str = Query(...),
    created_by: str = Query("张晓明"),
    db: Session = Depends(get_db),
):
    """为客户添加跟进记录"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return JSONResponse({"ok": False, "msg": "客户不存在"}, 404)
    if not content.strip():
        return JSONResponse({"ok": False, "msg": "跟进内容不能为空"}, 400)

    log = ActivityLog(
        customer_id=cid,
        activity_type=activity_type,
        content=content.strip(),
        created_by=created_by,
    )
    db.add(log)
    db.commit()
    return {"ok": True, "msg": "跟进记录已保存", "activity_id": log.id}


@app.get("/api/customers/{cid}")
def get_customer(cid: int, db: Session = Depends(get_db)):
    """获取客户详情含画像、商机、订单"""
    cust = db.query(Customer).filter(Customer.id == cid).first()
    if not cust:
        return JSONResponse({"ok": False}, 404)
    opps = db.query(Opportunity).filter(Opportunity.customer_id == cid).all()
    orders = db.query(Order).filter(Order.customer_id == cid).order_by(desc(Order.created_at)).limit(10).all()
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == cid).first()
    # 线索溯源
    lead_info = None
    if cust.lead_id:
        lead = db.query(Lead).filter(Lead.id == cust.lead_id).first()
        if lead:
            lead_info = {"id": lead.id, "company_name": lead.company_name,
                         "contact_mobile": lead.contact_mobile, "source": lead.source}
    return {
        "customer": {
            "id": cust.id, "lead_id": cust.lead_id,
            "company_name": cust.company_name,
            "contact_name": cust.contact_name, "country": cust.country,
            "main_category": cust.main_category,
            "shipping_frequency": cust.shipping_frequency,
            "usual_routes": cust.usual_routes,
            "avg_monthly_volume": cust.avg_monthly_volume,
            "avg_monthly_revenue": cust.avg_monthly_revenue,
            "customer_level": cust.customer_level,
            "volume_mom": cust.volume_mom,
            "volume_yoy": cust.volume_yoy,
            "monthly_order_count": cust.monthly_order_count,
            "order_frequency_tag": cust.order_frequency_tag,
            "lifecycle_status": cust.lifecycle_status,
            "lifecycle_label": STATUS_LABELS.get(cust.lifecycle_status, cust.lifecycle_status),
            "cooperation_since": str(cust.cooperation_since) if cust.cooperation_since else None,
        },
        "lead_source": lead_info,
        "opportunities": [{"id": o.id, "name": o.name, "stage": o.stage,
                           "amount": o.amount, "win_probability": o.win_probability} for o in opps],
        "orders": [{"id": o.id, "tracking_number": o.tracking_number,
                    "status": o.status, "route_detail": o.route_detail,
                    "has_exception": o.has_exception} for o in orders],
        "credit": {"credit_score": credit.credit_score, "credit_limit": credit.credit_limit,
                   "balance_due": credit.balance_due, "days_aged": credit.days_aged} if credit else None,
    }
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
            "customer_level": cust.customer_level,
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
# API 路由 - 财务信用 (Mobile)
# ═══════════════════════════════════════════════

@app.get("/api/credits/list")
def api_credits_list(db: Session = Depends(get_db)):
    """信用列表"""
    credits = db.query(CreditInfo).join(Customer).order_by(desc(CreditInfo.days_aged)).all()
    total_balance = db.query(func.sum(CreditInfo.balance_due)).scalar() or 0
    overdue = db.query(func.sum(CreditInfo.balance_due)).filter(CreditInfo.days_aged > 30).scalar() or 0
    return {
        "ok": True,
        "summary": {"total_balance": total_balance, "overdue": overdue},
        "credits": [{
            "id": c.id, "customer_id": c.customer_id,
            "company_name": c.customer.company_name,
            "credit_score": c.credit_score, "credit_limit": c.credit_limit,
            "balance_due": c.balance_due, "days_aged": c.days_aged,
            "payment_terms": c.payment_terms, "is_blacklisted": c.is_blacklisted,
            "risk_notes": c.risk_notes,
            "usage_rate": round(c.balance_due / c.credit_limit * 100, 1) if c.credit_limit > 0 else 0,
        } for c in credits],
    }


@app.get("/api/orders/list")
def api_orders_list(db: Session = Depends(get_db)):
    """运单列表"""
    orders = db.query(Order).order_by(desc(Order.created_at)).all()
    return {
        "ok": True,
        "orders": [{
            "id": o.id, "customer_id": o.customer_id,
            "company_name": o.customer.company_name if o.customer else "",
            "tracking_number": o.tracking_number, "route_detail": o.route_detail,
            "cargo_desc": o.cargo_desc, "weight_kg": o.weight_kg, "volume_cbm": o.volume_cbm,
            "status": o.status, "origin": o.origin, "destination": o.destination,
            "etd": str(o.etd) if o.etd else None, "eta": str(o.eta) if o.eta else None,
            "has_exception": o.has_exception, "exception_type": o.exception_type,
            "created_at": str(o.created_at),
        } for o in orders],
    }


@app.get("/api/quotations/list")
def api_quotations_list(db: Session = Depends(get_db)):
    """报价列表"""
    quotes = db.query(Quotation).order_by(desc(Quotation.created_at)).all()
    return {
        "ok": True,
        "quotations": [{
            "id": q.id, "customer_id": q.customer_id,
            "company_name": q.customer.company_name if q.customer else "",
            "route_type": q.route_type, "route_detail": q.route_detail,
            "cargo_type": q.cargo_type, "weight_kg": q.weight_kg, "volume_cbm": q.volume_cbm,
            "total_price": q.total_price, "incoterms": q.incoterms,
            "status": q.status, "valid_until": str(q.valid_until) if q.valid_until else None,
            "created_at": str(q.created_at),
        } for q in quotes],
    }


# ═══════════════════════════════════════════════
# 启动入口
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
