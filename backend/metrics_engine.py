"""PRD V2.0 核心指标计算引擎 — 跨境物流CRM客户与商机模块"""
import datetime
import json
from sqlalchemy import func
from database import SessionLocal
from models import Customer, Order, ActivityLog, CreditInfo, WARNING_MOM_THRESHOLD


def calc_metrics():
    """每日定时计算所有客户的核心指标 (PRD V2.0 §3-4)"""
    db = SessionLocal()
    now = datetime.datetime.now()
    today = datetime.date.today()

    customers = db.query(Customer).all()
    for c in customers:
        # ── MoM: 本月至今 vs 上月同期 (PRD V2 §3) ──
        mom = _calc_mom_mtd(db, c, today)

        # ── YoY ──
        yoy = _calc_yoy(db, c, today)

        # ── 下单频率: 近90天平均间隔 ──
        freq_tag = _calc_frequency_tag(db, c, now)

        # ── 健康分 (PRD V2 §4.2: 货量50% + 回款30% + 活跃20%) ──
        health, breakdown = _calc_health_score_v2(db, c, now, mom)

        # ── 智能预警 (PRD V2 §3): MoM跌幅>20% → is_warning ──
        is_warning = mom < WARNING_MOM_THRESHOLD if mom is not None else False

        # ── 近30天运单数 ──
        order_count_30d = db.query(func.count(Order.id)).filter(
            Order.customer_id == c.id,
            Order.created_at >= now - datetime.timedelta(days=30)
        ).scalar() or 0

        # ── 本月 / 上月货量 ──
        current_month_volume, prev_month_volume = _get_mtd_volumes(db, c, today)

        c.volume_mom = mom
        c.volume_yoy = yoy
        c.monthly_order_count = order_count_30d
        c.prev_month_volume = prev_month_volume
        c.order_frequency_tag = freq_tag
        c.health_score = health
        c.health_breakdown = json.dumps(breakdown, ensure_ascii=False)
        c.is_warning = is_warning
        c.last_metrics_calc_at = now

    db.commit()
    db.close()
    return len(customers)


def get_6month_trend(customer_id):
    """近6个月货量走势 (PRD V2 §5: 数据穿透—悬浮走势图)"""
    db = SessionLocal()
    today = datetime.date.today()
    months = []
    for i in range(5, -1, -1):
        d = _month_offset(today, -i)
        vol = _month_volume(db, db.query(Customer).filter(Customer.id == customer_id).first(), d)
        months.append({
            "month": d.strftime("%Y-%m"),
            "label": d.strftime("%m月"),
            "volume": round(vol, 1),
        })
    db.close()
    return months


def _calc_mom_mtd(db, c, today):
    """本月至今 vs 上月同期货量环比 (PRD V2: MTD口径)"""
    current_mtd = _mtd_volume(db, c, today)
    prev_mtd = _prev_mtd_volume(db, c, today)
    if prev_mtd == 0:
        return 100.0 if current_mtd > 0 else 0.0
    return round((current_mtd - prev_mtd) / prev_mtd * 100, 1)


def _calc_yoy(db, c, today):
    """货量同比"""
    current_mtd = _mtd_volume(db, c, today)
    prev_year_mtd = _prev_year_mtd_volume(db, c, today)
    if prev_year_mtd == 0:
        return 100.0 if current_mtd > 0 else 0.0
    return round((current_mtd - prev_year_mtd) / prev_year_mtd * 100, 1)


def _calc_frequency_tag(db, c, now):
    """下单频率 — 近90天平均下单间隔 (PRD V2 §4.1)"""
    orders = db.query(Order).filter(
        Order.customer_id == c.id,
        Order.created_at >= now - datetime.timedelta(days=90)
    ).order_by(Order.created_at.asc()).all()

    if len(orders) < 2:
        return "Inactive"

    intervals = []
    for i in range(1, len(orders)):
        delta = (orders[i].created_at - orders[i-1].created_at).total_seconds() / 86400
        if delta > 0:
            intervals.append(delta)

    if not intervals:
        return "Inactive"

    avg_interval = sum(intervals) / len(intervals)
    if avg_interval <= 1.5:
        return "Daily"
    elif avg_interval <= 7:
        return "Weekly"
    elif avg_interval <= 30:
        return "Monthly"
    return "Inactive"


def _calc_health_score_v2(db, c, now, mom):
    """健康分 V2 (PRD §4.2): 货量50% + 回款30% + 活跃互动20%"""
    breakdown = {"volume": 0, "payment": 0, "engagement": 0}

    # ── 货量表现 (50分): MoM跌幅>20%按比例扣分 ──
    if mom is not None and mom < WARNING_MOM_THRESHOLD:
        decline = abs(mom) - abs(WARNING_MOM_THRESHOLD)
        deduction = min(50, int(decline / 2))
        breakdown["volume"] = max(0, 50 - deduction)
    else:
        breakdown["volume"] = 50

    # ── 回款表现 (30分): 对接风控模块 ──
    credit = db.query(CreditInfo).filter(CreditInfo.customer_id == c.id).first()
    if credit:
        if credit.balance_due <= 0:
            breakdown["payment"] = 30
        elif credit.days_aged <= 30:
            breakdown["payment"] = 20
        elif credit.days_aged <= 60:
            breakdown["payment"] = 10
        else:
            breakdown["payment"] = 0  # 严重逾期
    else:
        breakdown["payment"] = 15  # 无授信记录默认一半

    # ── 活跃互动 (20分): 近7天有跟进记录 ──
    recent_follow = db.query(func.max(ActivityLog.created_at)).filter(
        ActivityLog.customer_id == c.id,
        ActivityLog.activity_type.in_(['call', 'visit', 'meeting', 'email'])
    ).scalar()
    if recent_follow and (now - recent_follow).days <= 7:
        breakdown["engagement"] = 20

    total = sum(breakdown.values())
    return total, breakdown


def _mtd_volume(db, c, target_date):
    """本月1日→target_date的累计货量 (Month-To-Date)"""
    start = target_date.replace(day=1)
    end = target_date + datetime.timedelta(days=1)
    result = db.query(func.sum(Order.weight_kg)).filter(
        Order.customer_id == c.id,
        Order.created_at >= start,
        Order.created_at < end,
    ).scalar()
    return result or 0


def _prev_mtd_volume(db, c, today):
    """上月1日→上月同日的累计货量"""
    prev = _month_offset(today, -1)
    start = prev.replace(day=1)
    day = min(today.day, _days_in_month(prev.year, prev.month))
    end = prev.replace(day=day) + datetime.timedelta(days=1)
    result = db.query(func.sum(Order.weight_kg)).filter(
        Order.customer_id == c.id,
        Order.created_at >= start,
        Order.created_at < end,
    ).scalar()
    return result or 0


def _prev_year_mtd_volume(db, c, today):
    """去年本月1日→去年本月同日的累计货量"""
    prev_year = today.replace(year=today.year - 1)
    start = prev_year.replace(day=1)
    day = min(today.day, _days_in_month(prev_year.year, prev_year.month))
    end = prev_year.replace(day=day) + datetime.timedelta(days=1)
    result = db.query(func.sum(Order.weight_kg)).filter(
        Order.customer_id == c.id,
        Order.created_at >= start,
        Order.created_at < end,
    ).scalar()
    return result or 0


def _month_volume(db, c, target_date):
    """整月货量"""
    start = target_date.replace(day=1)
    if target_date.month == 12:
        end = target_date.replace(year=target_date.year + 1, month=1, day=1)
    else:
        end = target_date.replace(month=target_date.month + 1, day=1)
    result = db.query(func.sum(Order.weight_kg)).filter(
        Order.customer_id == c.id,
        Order.created_at >= start,
        Order.created_at < end,
    ).scalar()
    return result or 0


def _get_mtd_volumes(db, c, today):
    """获取本月至今和上月同期货量"""
    current = _mtd_volume(db, c, today)
    prev = _prev_mtd_volume(db, c, today)
    return current, prev


def _month_offset(d, offset):
    """月份偏移"""
    m = d.month + offset
    y = d.year
    while m <= 0:
        m += 12
        y -= 1
    while m > 12:
        m -= 12
        y += 1
    day = min(d.day, _days_in_month(y, m))
    return datetime.date(y, m, day)


def _days_in_month(y, m):
    import calendar
    return calendar.monthrange(y, m)[1]


if __name__ == "__main__":
    count = calc_metrics()
    print(f"Metrics V2 calculated for {count} customers")
