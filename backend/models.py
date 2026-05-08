import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Date, Boolean
)
from sqlalchemy.orm import relationship
from database import Base


def _now():
    return datetime.datetime.now()


# ── 1. 线索与公海池 ──
class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(200), nullable=False)
    contact_name = Column(String(100))
    phone = Column(String(30))
    email = Column(String(200))
    source = Column(String(50), comment="独立站/社媒/展会/海关数据/转介绍")
    country = Column(String(100))
    product_interest = Column(String(200), comment="意向产品: 空派/海派/铁运/FBA头程")
    status = Column(String(20), default="new", comment="new/contacted/quoted/trial/won/lost")
    owner = Column(String(100))
    assigned_at = Column(DateTime)
    last_followed = Column(DateTime)
    follow_count = Column(Integer, default=0)
    auto_reclaim = Column(Boolean, default=False, comment="超7天未跟进自动回池")
    created_at = Column(DateTime, default=_now)
    activities = relationship("ActivityLog", back_populates="lead", cascade="all, delete-orphan")


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
    created_at = Column(DateTime, default=_now)
    opportunities = relationship("Opportunity", back_populates="customer", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")


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
    activity_type = Column(String(30), comment="call/visit/meeting/email/quote/complaint")
    content = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=_now)
    lead = relationship("Lead", back_populates="activities")


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
