"""PRD 核心指标计算引擎 — 跨境物流CRM客户与商机模块"""
import datetime
import json
from sqlalchemy import func
from database import SessionLocal
from models import Customer, Order, ActivityLog


def calc_metrics():
    """每日定时计算所有客户的核心指标 (PRD §3)"""
    db = SessionLocal()
    now = datetime.datetime.now()
    today = datetime.date.today()

    customers = db.query(Customer).all()
    for c in customers:
        # ── 3.1 货量同环比 ──
        mom = _calc_mom(db, c, today)
        yoy = _calc_yoy(db, c, today)

        # ── 3.2 下单频率动态打标 ──
        freq_tag = _calc_frequency_tag(db, c, now)

        # ── 3.3 健康分算法 ──
        health, breakdown = _calc_health_score(db, c, now)

        # 近30天运单数
        order_count_30d = db.query(func.count(Order.id)).filter(
            Order.customer_id == c.id,
            Order.created_at >= now - datetime.timedelta(days=30)
        ).scalar() or 0

        # 本月 / 上月货量
        current_month_volume, prev_month_volume = _get_month_volumes(db, c, today)

        c.volume_mom = mom
        c.volume_yoy = yoy
        c.monthly_order_count = order_count_30d
        c.prev_month_volume = prev_month_volume
        c.order_frequency_tag = freq_tag
        c.health_score = health
        c.health_breakdown = json.dumps(breakdown, ensure_ascii=False)
        c.last_metrics_calc_at = now

    db.commit()
    db.close()
    return len(customers)


def _calc_mom(db, c, today):
    """货量环比 MoM"""
    current = _month_volume(db, c, today)
    prev = _month_volume(db, c, _prev_month(today))
    if prev == 0:
        return 100.0 if current > 0 else 0.0  # 纯增量标记为100%
    return round((current - prev) / prev * 100, 1)


def _calc_yoy(db, c, today):
    """货量同比 YoY"""
    current = _month_volume(db, c, today)
    prev_year_same = _month_volume(db, c, today.replace(year=today.year - 1))
    if prev_year_same == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - prev_year_same) / prev_year_same * 100, 1)


def _calc_frequency_tag(db, c, now):
    """下单频率动态打标 — 近90天运单平均间隔"""
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
    else:
        return "Inactive"


def _calc_health_score(db, c, now):
    """健康分算法 (0-100) — 加权计算模型"""
    breakdown = {"stability": 0, "follow_activity": 0, "order_activity": 0}

    # ── 发货稳定性 (40分): 基于MoM变化 ──
    mom = c.volume_mom if c.volume_mom is not None else 0
    if mom >= -10:
        breakdown["stability"] = 40
    elif mom < -10:
        # 每下降5%扣2分
        decline = abs(mom) - 10
        deduct = int(decline / 5) * 2
        breakdown["stability"] = max(0, 40 - deduct)
    # 长期不发货: 保持0分

    # ── 跟进活跃度 (30分): 近N天有效跟进 ──
    recent_follow = db.query(func.max(ActivityLog.created_at)).filter(
        ActivityLog.customer_id == c.id,
        ActivityLog.activity_type.in_(['call', 'visit', 'meeting', 'email'])
    ).scalar()
    if recent_follow:
        days_since = (now - recent_follow).days
        if days_since <= 7:
            breakdown["follow_activity"] = 30
        elif days_since <= 15:
            breakdown["follow_activity"] = 15
    # >15天或无效跟进 → 0分

    # ── 运单活跃度 (30分): 近N天新增运单 ──
    recent_order = db.query(func.max(Order.created_at)).filter(
        Order.customer_id == c.id
    ).scalar()
    if recent_order:
        days_since = (now - recent_order).days
        if days_since <= 30:
            breakdown["order_activity"] = 30
        elif days_since <= 60:
            breakdown["order_activity"] = 15
    # >60天 → 0分

    total = sum(breakdown.values())
    return total, breakdown


def _month_volume(db, c, target_date):
    """获取指定月份的总货量(计费重KG)"""
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


def _get_month_volumes(db, c, today):
    """获取本月和上月货量"""
    current = _month_volume(db, c, today)
    prev = _month_volume(db, c, _prev_month(today))
    return current, prev


def _prev_month(d):
    """上个月同日"""
    if d.month == 1:
        return d.replace(year=d.year - 1, month=12)
    return d.replace(month=d.month - 1)


if __name__ == "__main__":
    count = calc_metrics()
    print(f"Metrics calculated for {count} customers")
