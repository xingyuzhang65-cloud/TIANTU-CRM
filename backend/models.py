import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Date, Boolean
)
from sqlalchemy.orm import relationship
from database import Base


def _now():
    return datetime.datetime.now()


# ── 客户生命周期状态常量 (V1 — 保留向前兼容) ──
STATUS_NEW = "new"
STATUS_CONTACTED = "contacted"
STATUS_DISQUALIFIED = "disqualified"
STATUS_NURTURING = "nurturing"
STATUS_QUOTED = "quoted"
STATUS_NEGOTIATING = "negotiating"
STATUS_TRIAL = "trial"
STATUS_ACTIVE = "active"
STATUS_RECEDING = "receding"
STATUS_CHURNED = "churned"

ALL_STATUSES = [
    STATUS_NEW, STATUS_CONTACTED, STATUS_DISQUALIFIED,
    STATUS_NURTURING, STATUS_QUOTED, STATUS_NEGOTIATING, STATUS_TRIAL,
    STATUS_ACTIVE, STATUS_RECEDING, STATUS_CHURNED
]

STATUS_LABELS = {
    STATUS_NEW: "待处理", STATUS_CONTACTED: "跟进中", STATUS_DISQUALIFIED: "无效/关闭",
    STATUS_NURTURING: "意向客户", STATUS_QUOTED: "已报价", STATUS_NEGOTIATING: "商务谈判",
    STATUS_TRIAL: "试单中", STATUS_ACTIVE: "正式合作", STATUS_RECEDING: "减量/休眠",
    STATUS_CHURNED: "已流失",
}

STATUS_STAGE = {
    STATUS_NEW: "潜客线索", STATUS_CONTACTED: "潜客线索", STATUS_DISQUALIFIED: "潜客线索",
    STATUS_NURTURING: "商机转化", STATUS_QUOTED: "商机转化", STATUS_NEGOTIATING: "商机转化",
    STATUS_TRIAL: "商机转化", STATUS_ACTIVE: "成交存量", STATUS_RECEDING: "成交存量",
    STATUS_CHURNED: "结束",
}

# ── PRD V2.0: 精简4阶段生命周期 ──
STAGE_DEVELOPING = "developing"
STAGE_NEGOTIATING = "negotiating"
STAGE_COOPERATING = "cooperating"
STAGE_ARCHIVED = "archived"

ALL_STAGES = [STAGE_DEVELOPING, STAGE_NEGOTIATING, STAGE_COOPERATING, STAGE_ARCHIVED]

STAGE_LABELS = {
    STAGE_DEVELOPING: "开发中",
    STAGE_NEGOTIATING: "报价谈判",
    STAGE_COOPERATING: "合作中",
    STAGE_ARCHIVED: "已归档",
}

# 旧状态 → 新4阶段映射
STATUS_TO_STAGE = {
    STATUS_NEW: STAGE_DEVELOPING, STATUS_CONTACTED: STAGE_DEVELOPING,
    STATUS_NURTURING: STAGE_NEGOTIATING, STATUS_QUOTED: STAGE_NEGOTIATING,
    STATUS_NEGOTIATING: STAGE_NEGOTIATING,
    STATUS_TRIAL: STAGE_COOPERATING, STATUS_ACTIVE: STAGE_COOPERATING,
    STATUS_RECEDING: STAGE_COOPERATING,
    STATUS_DISQUALIFIED: STAGE_ARCHIVED, STATUS_CHURNED: STAGE_ARCHIVED,
}

# 新阶段 → 包含的旧状态列表
STAGE_STATUS_MAP = {
    STAGE_DEVELOPING: [STATUS_NEW, STATUS_CONTACTED],
    STAGE_NEGOTIATING: [STATUS_NURTURING, STATUS_QUOTED, STATUS_NEGOTIATING],
    STAGE_COOPERATING: [STATUS_TRIAL, STATUS_ACTIVE, STATUS_RECEDING],
    STAGE_ARCHIVED: [STATUS_DISQUALIFIED, STATUS_CHURNED],
}

# "合作中" 自动激活规则: 近90天有生效运单
COOPERATING_AUTO_DAYS = 90
# 预警阈值: 货量MoM跌幅超过20%
WARNING_MOM_THRESHOLD = -20

# 新阶段 → 默认旧状态 (手动切换时使用)
STAGE_TO_DEFAULT_STATUS = {
    STAGE_DEVELOPING: STATUS_CONTACTED,
    STAGE_NEGOTIATING: STATUS_QUOTED,
    STAGE_COOPERATING: STATUS_ACTIVE,
    STAGE_ARCHIVED: STATUS_DISQUALIFIED,
}

# 状态流转规则: 当前状态 → 可流转到的下一个状态列表
VALID_TRANSITIONS = {
    STATUS_NEW:          [STATUS_CONTACTED, STATUS_DISQUALIFIED],
    STATUS_CONTACTED:    [STATUS_NURTURING, STATUS_DISQUALIFIED],
    STATUS_DISQUALIFIED: [],  # 终态
    STATUS_NURTURING:    [STATUS_QUOTED, STATUS_DISQUALIFIED],
    STATUS_QUOTED:       [STATUS_NEGOTIATING, STATUS_NURTURING],
    STATUS_NEGOTIATING:  [STATUS_TRIAL, STATUS_QUOTED, STATUS_NURTURING],
    STATUS_TRIAL:        [STATUS_ACTIVE, STATUS_NURTURING, STATUS_CHURNED],
    STATUS_ACTIVE:       [STATUS_RECEDING, STATUS_CHURNED],
    STATUS_RECEDING:     [STATUS_ACTIVE, STATUS_CHURNED],
    STATUS_CHURNED:      [STATUS_NEW],  # 回流至公海池，重置为新线索
}

# 流转时需要必填的字段
TRANSITION_REQUIREMENTS = {
    STATUS_QUOTED:      ["quotation_id"],      # 必须关联报价单
    STATUS_NEGOTIATING: ["negotiation_notes"],  # 必须填写谈判纪要
    STATUS_TRIAL:       ["order_count"],        # 必须说明试单票数
    STATUS_CHURNED:     ["churn_reason"],       # 必须填写流失原因
    STATUS_DISQUALIFIED: ["disqualify_reason"], # 必须填写无效原因
}


# ── PRD: 线索状态常量 (公海池) ──
LEAD_STATUS_PUBLIC = 0   # 公海待认领
LEAD_STATUS_PRIVATE = 1  # 私海跟进中
LEAD_STATUS_CONVERTED = 2  # 已转化

LEAD_STATUS_LABELS = {
    LEAD_STATUS_PUBLIC: "公海待认领",
    LEAD_STATUS_PRIVATE: "私海跟进中",
    LEAD_STATUS_CONVERTED: "已转化",
}

LOGISTICS_TYPES = ["FBA", "一件代发", "小包", "空派", "海派"]
TARGET_MARKETS = ["美国", "欧洲", "中东", "东南亚", "日韩", "澳洲", "南美", "非洲"]
FOLLOW_STATUSES = ["未联系", "初步沟通", "意向强烈", "暂无意向", "无效信息"]


# ── 1. 线索与公海池 ──
class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(200), nullable=False)
    contact_name = Column(String(100))
    contact_mobile = Column(String(30), nullable=False, index=True, comment="11位手机号(PRD必填)")
    phone = Column(String(30))
    email = Column(String(200))
    source = Column(String(50), comment="独立站/社媒/展会/海关数据/转介绍")
    country = Column(String(100))
    target_market = Column(String(100), comment="目标市场: 美国/欧洲/中东等")
    product_interest = Column(String(200), comment="意向产品: 空派/海派/铁运/FBA头程")
    logistics_type = Column(String(50), comment="物流偏好(PRD): FBA/一件代发/小包/空派/海派")
    status = Column(String(20), default=STATUS_NEW,
                   comment="new/contacted/disqualified — 潜客线索阶段三状态")
    lead_status = Column(Integer, default=LEAD_STATUS_PUBLIC, index=True,
                         comment="0:公海待认领 1:私海跟进中 2:已转化(PRD)")
    owner = Column(String(100))
    owner_id = Column(Integer, comment="归属销售ID")
    assigned_at = Column(DateTime)
    last_followed = Column(DateTime)
    next_follow_at = Column(DateTime, comment="下次跟进提醒时间")
    follow_count = Column(Integer, default=0)
    auto_reclaim = Column(Boolean, default=False, comment="超N天未跟进/超M天未转化自动回池")
    reclaim_deadline = Column(DateTime, comment="自动回收倒计时截止时间")
    converted_at = Column(DateTime, comment="转化时间")
    converted_to_type = Column(String(20), comment="转化目标类型: opportunity/customer")
    converted_to_id = Column(Integer, comment="转化目标ID")
    created_at = Column(DateTime, default=_now)
    activities = relationship("ActivityLog", back_populates="lead", cascade="all, delete-orphan")
    follow_ups = relationship("FollowUp", back_populates="lead", cascade="all, delete-orphan")


# ── 1.1 线索跟进记录 (PRD: 3.3) ──
class FollowUp(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    status = Column(String(20), comment="未联系/初步沟通/意向强烈/暂无意向/无效信息")
    content = Column(Text, comment="跟进文本描述")
    image_urls = Column(Text, comment="图片附件JSON数组")
    next_follow_at = Column(DateTime, comment="下次跟进时间")
    created_by = Column(String(100))
    created_at = Column(DateTime, default=_now)
    lead = relationship("Lead", back_populates="follow_ups")


# ── 1.2 线索认领记录 (PRD: 每人每日认领上限) ──
class ClaimRecord(Base):
    __tablename__ = "claim_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    user_name = Column(String(100))
    claimed_at = Column(DateTime, default=_now)


# ── 1.3 系统配置参数 (PRD: N/M/X/Y 管理员可配置) ──
class SystemConfig(Base):
    __tablename__ = "system_config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(String(200), nullable=False)
    description = Column(String(200))
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    @staticmethod
    def get(db, key: str, default: int = 7) -> int:
        """读取配置值"""
        cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        return int(cfg.value) if cfg else default

    @staticmethod
    def get_all_defaults():
        return {
            "reclaim_no_follow_days": ("7", "N: 未跟进回收天数"),
            "reclaim_no_convert_days": ("30", "M: 未转化回收天数"),
            "claim_daily_limit": ("5", "X: 每人每日认领上限"),
            "claim_private_limit": ("50", "Y: 私海持有线索总数上限"),
        }


# ── 1.4 用户认证 ──
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    name = Column(String(100))
    phone = Column(String(30))
    role = Column(String(20), default="sales", comment="sales/admin")
    created_at = Column(DateTime, default=_now)


# ── 2. 客户画像 ──
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    company_name = Column(String(200), nullable=False)
    contact_name = Column(String(100))
    phone = Column(String(30))
    email = Column(String(200))
    country = Column(String(100))
    # KYC 画像
    main_category = Column(String(200), comment="主营类目: 带电产品/超大件/普货/纺织品")
    shipping_frequency = Column(String(50), comment="发货频率: daily/weekly/monthly/seasonal")
    usual_routes = Column(String(200), comment="常用路线: 美森/盐田/空运/中欧班列")
    export_qualification = Column(String(200), comment="出口资质")
    avg_monthly_volume = Column(Float, comment="月均货量(方)")
    avg_monthly_revenue = Column(Float, comment="月均贡献营收")
    customer_level = Column(String(20), default="C", comment="A/B/C/D")
    health_score = Column(Integer, default=70)
    cooperation_since = Column(Date)
    # ── 生命周期状态 (10个状态贯穿潜客→商机→成交→结束) ──
    lifecycle_status = Column(String(20), default=STATUS_NURTURING,
                             comment="10阶段生命周期状态")
    status_changed_at = Column(DateTime, comment="最近一次状态变更时间")
    status_changed_by = Column(String(100), comment="最近一次状态变更人")
    # ── PRD 指标字段 ──
    volume_mom = Column(Float, comment="货量环比 MoM (%)")
    volume_yoy = Column(Float, comment="货量同比 YoY (%)")
    monthly_order_count = Column(Integer, default=0, comment="近30天运单数")
    prev_month_volume = Column(Float, comment="上月货量")
    prev_year_volume = Column(Float, comment="去年同期货量")
    order_frequency_tag = Column(String(20), comment="下单频率: Daily/Weekly/Monthly/Inactive")
    health_breakdown = Column(Text, comment="健康分明细 JSON: {stability, follow_activity, order_activity}")
    owner = Column(String(100), comment="跟进人/负责人 (从线索认领同步)")
    owner_id = Column(Integer, comment="跟进人ID")
    is_warning = Column(Boolean, default=False, index=True,
                        comment="PRD V2: 智能预警标记 (MoM货量跌幅>20%自动触发)")
    last_metrics_calc_at = Column(DateTime, comment="最近指标计算时间")
    created_at = Column(DateTime, default=_now)
    opportunities = relationship("Opportunity", back_populates="customer", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
    activities = relationship("ActivityLog", back_populates="customer", cascade="all, delete-orphan",
                              foreign_keys="ActivityLog.customer_id")


# ── 3. 商机 ──
class Opportunity(Base):
    __tablename__ = "opportunities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    name = Column(String(200))
    stage = Column(String(30), default="initial",
                  comment="initial/quoting/trial/negotiation/won/lost")
    amount = Column(Float, default=0)
    expected_close_date = Column(Date)
    win_probability = Column(Integer, default=30)
    loss_reason = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=_now)
    customer = relationship("Customer", back_populates="opportunities")


# ── 4. 报价单 ──
class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    route_type = Column(String(20), comment="空派/海派/铁运/卡航")
    route_detail = Column(String(200), comment="具体路线: 深圳-美森-洛杉矶")
    cargo_type = Column(String(100), comment="普货/带电/敏感品")
    weight_kg = Column(Float, default=0)
    volume_cbm = Column(Float, default=0)
    base_price = Column(Float)
    fuel_surcharge = Column(Float, default=0)
    remote_surcharge = Column(Float, default=0)
    customs_fee = Column(Float, default=0)
    total_price = Column(Float)
    currency = Column(String(10), default="RMB")
    incoterms = Column(String(10), comment="FOB/CIF/DDP/FCA")
    valid_until = Column(Date)
    status = Column(String(20), default="pending", comment="pending/sent/accepted/expired")
    created_at = Column(DateTime, default=_now)
    customer = relationship("Customer", back_populates="quotations")


# ── 5. 运单与轨迹 ──
class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    tracking_number = Column(String(50), unique=True)
    route_detail = Column(String(200))
    cargo_desc = Column(String(200))
    weight_kg = Column(Float)
    volume_cbm = Column(Float)
    container_count = Column(Integer, default=0)
    status = Column(String(30), default="received",
                  comment="received/warehouse/departed/customs/transit/arrived/delivered")
    origin = Column(String(100))
    destination = Column(String(100))
    etd = Column(Date, comment="预计出发")
    eta = Column(Date, comment="预计到达")
    actual_delivery = Column(Date)
    has_exception = Column(Boolean, default=False)
    exception_type = Column(String(100))
    created_at = Column(DateTime, default=_now)
    customer = relationship("Customer", back_populates="orders")
    tracking_events = relationship("TrackingEvent", back_populates="order", cascade="all, delete-orphan")


class TrackingEvent(Base):
    __tablename__ = "tracking_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    event_type = Column(String(50), comment="warehouse/departure/arrival/customs/delivery/exception")
    location = Column(String(200))
    description = Column(String(500))
    event_time = Column(DateTime, default=_now)
    order = relationship("Order", back_populates="tracking_events")


# ── 6. 风控与授信 ──
class CreditInfo(Base):
    __tablename__ = "credit_info"
    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    credit_score = Column(Integer, default=600, comment="资信评分 0-1000")
    credit_limit = Column(Float, default=0, comment="授信额度")
    balance_due = Column(Float, default=0, comment="当前欠款")
    payment_terms = Column(String(50), default="NET30", comment="付款账期")
    days_aged = Column(Integer, default=0, comment="账龄天数")
    is_blacklisted = Column(Boolean, default=False)
    risk_notes = Column(Text)
    last_reviewed = Column(Date)
    customer = relationship("Customer", backref="credit_info", uselist=False)


# ── 7. 跟进记录 ──
class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    activity_type = Column(String(30), comment="call/visit/meeting/email/quote/complaint/status_change")
    content = Column(Text)
    # 状态流转记录
    status_from = Column(String(20))
    status_to = Column(String(20))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=_now)
    lead = relationship("Lead", back_populates="activities")
    customer = relationship("Customer", back_populates="activities", foreign_keys=[customer_id])


# ── 8. 投诉索赔 ──
class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    complaint_type = Column(String(50), comment="loss/damage/delay/customs/fee")
    description = Column(Text)
    claim_amount = Column(Float, default=0)
    status = Column(String(20), default="open", comment="open/investigating/resolved/closed")
    resolution = Column(Text)
    created_at = Column(DateTime, default=_now)
