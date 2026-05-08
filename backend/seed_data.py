"""演示数据 — 跨境物流CRM业务场景"""
import sys, datetime
sys.stdout.reconfigure(encoding='utf-8')
from database import SessionLocal, engine, Base
from models import (
    Lead, Customer, Opportunity, Quotation, Order, TrackingEvent,
    CreditInfo, ActivityLog, Complaint
)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 清理旧数据
    for tbl in [Complaint, TrackingEvent, Order, Quotation, Opportunity,
                CreditInfo, ActivityLog, Customer, Lead]:
        db.query(tbl).delete()
    db.commit()

    now = datetime.datetime.now

    # ═══════════════════ 线索公海池 ═══════════════════
    leads = [
        Lead(company_name="深圳思科达电子有限公司", contact_name="陈总", phone="13800138001", email="chen@scd-tech.cn",
             source="展会", country="中国", product_interest="海派-FBA头程", status="contacted",
             owner="张晓明", assigned_at=now(), last_followed=now(), follow_count=3),
        Lead(company_name="广州恒通服装贸易有限公司", contact_name="李经理", phone="13800138002", email="li@htfashion.com",
             source="独立站", country="中国", product_interest="空派-快件", status="new",
             owner="张晓明", assigned_at=now(), last_followed=now() - datetime.timedelta(days=8), follow_count=0,
             auto_reclaim=True),
        Lead(company_name="义乌欧凯进出口有限公司", contact_name="王芳", phone="13800138003", email="wangf@okexport.com",
             source="社媒", country="中国", product_interest="铁运-中欧班列", status="quoted",
             owner="李强", assigned_at=now(), last_followed=now() - datetime.timedelta(days=2), follow_count=4),
        Lead(company_name="杭州锐思科技有限公司", contact_name="赵总", phone="13800138004", email="zhao@ruisi-tech.com",
             source="海关数据", country="中国", product_interest="海派-重货", status="new",
             owner=None, assigned_at=None, last_followed=None, follow_count=0),
        Lead(company_name="东莞联达塑胶制品有限公司", contact_name="孙经理", phone="13800138005", email="sun@lianda-plastic.com",
             source="转介绍", country="中国", product_interest="卡航-欧洲", status="new",
             owner=None, assigned_at=None, last_followed=None, follow_count=0),
        Lead(company_name="宁波远洋国际贸易有限公司", contact_name="周董", phone="13800138006", email="zhou@yuanyang.com",
             source="展会", country="中国", product_interest="海派-整柜", status="trial",
             owner="张晓明", assigned_at=now(), last_followed=now() - datetime.timedelta(days=1), follow_count=8),
        Lead(company_name="AmazonSeller-DE GmbH", contact_name="Michael Braun", phone="+49-176-1234567", email="m.braun@amzde.de",
             source="独立站", country="德国", product_interest="海派-FBA头程", status="new",
             owner=None, assigned_at=None, last_followed=None, follow_count=0),
        Lead(company_name="Lazada跨境卖家-曼谷", contact_name="Siriporn", phone="+66-89-1234567", email="siriporn@thaiseller.co.th",
             source="社媒", country="泰国", product_interest="陆运-东南亚", status="contacted",
             owner="李强", assigned_at=now(), last_followed=now(), follow_count=2),
    ]
    db.add_all(leads)
    db.commit()

    # ═══════════════════ 客户画像 ═══════════════════
    customers = [
        Customer(lead_id=1, company_name="深圳思科达电子有限公司", contact_name="陈总",
                 phone="13800138001", email="chen@scd-tech.cn", country="中国",
                 main_category="带电产品(电池)", shipping_frequency="weekly", usual_routes="美森快船,盐田普船",
                 export_qualification="危包证,UN38.3", avg_monthly_volume=45.5, avg_monthly_revenue=285000,
                 customer_level="A", health_score=88, cooperation_since=datetime.date(2023, 6, 1)),
        Customer(lead_id=3, company_name="义乌欧凯进出口有限公司", contact_name="王芳",
                 phone="13800138003", email="wangf@okexport.com", country="中国",
                 main_category="小商品/日用百货", shipping_frequency="daily", usual_routes="中欧班列,卡航",
                 export_qualification="一般贸易", avg_monthly_volume=120.0, avg_monthly_revenue=420000,
                 customer_level="A", health_score=92, cooperation_since=datetime.date(2022, 3, 15)),
        Customer(lead_id=6, company_name="宁波远洋国际贸易有限公司", contact_name="周董",
                 phone="13800138006", email="zhou@yuanyang.com", country="中国",
                 main_category="大型机械设备", shipping_frequency="monthly", usual_routes="盐田-洛杉矶,上海-鹿特丹",
                 export_qualification="出口许可证", avg_monthly_volume=200.0, avg_monthly_revenue=680000,
                 customer_level="B", health_score=72, cooperation_since=datetime.date(2023, 9, 10)),
        Customer(company_name="AmazonSeller-DE GmbH", contact_name="Michael Braun",
                 phone="+49-176-1234567", email="m.braun@amzde.de", country="德国",
                 main_category="普货(家居用品)", shipping_frequency="weekly", usual_routes="海派FBA-DEU",
                 export_qualification="CE认证", avg_monthly_volume=32.0, avg_monthly_revenue=180000,
                 customer_level="B", health_score=75, cooperation_since=datetime.date(2024, 1, 20)),
        Customer(lead_id=2, company_name="广州恒通服装贸易有限公司", contact_name="李经理",
                 phone="13800138002", email="li@htfashion.com", country="中国",
                 main_category="纺织品/服装", shipping_frequency="weekly", usual_routes="空派快件,卡航",
                 export_qualification="一般贸易", avg_monthly_volume=18.0, avg_monthly_revenue=95000,
                 customer_level="C", health_score=55, cooperation_since=datetime.date(2024, 6, 1)),
    ]
    db.add_all(customers)
    db.commit()

    # ═══════════════════ 商机 ═══════════════════
    opportunities = [
        Opportunity(customer_id=1, name="Q2 亚马逊补货-洛杉矶仓", stage="negotiation",
                    amount=350000, expected_close_date=datetime.date(2026, 5, 30), win_probability=70),
        Opportunity(customer_id=1, name="新品电池运输方案-英国站", stage="quoting",
                    amount=120000, expected_close_date=datetime.date(2026, 6, 15), win_probability=40),
        Opportunity(customer_id=2, name="圣诞季小商品欧洲线包舱", stage="won",
                    amount=800000, expected_close_date=datetime.date(2026, 4, 15), win_probability=100),
        Opportunity(customer_id=3, name="大型设备-鹿特丹DDP", stage="trial",
                    amount=150000, expected_close_date=datetime.date(2026, 6, 30), win_probability=50),
        Opportunity(customer_id=4, name="Amazon DE 月度FBA头程", stage="negotiation",
                    amount=220000, expected_close_date=datetime.date(2026, 5, 25), win_probability=65),
        Opportunity(customer_id=5, name="春季新装快件空运", stage="initial",
                    amount=60000, expected_close_date=datetime.date(2026, 7, 1), win_probability=25),
        Opportunity(customer_id=2, name="中欧班列-波兰分拨", stage="quoting",
                    amount=280000, expected_close_date=datetime.date(2026, 6, 10), win_probability=55),
    ]
    db.add_all(opportunities)
    db.commit()

    # ═══════════════════ 报价单 ═══════════════════
    quotations = [
        Quotation(customer_id=1, route_type="海派", route_detail="深圳-美森-洛杉矶",
                  cargo_type="带电产品", weight_kg=1200, volume_cbm=8.5,
                  base_price=15.8, fuel_surcharge=2.5, remote_surcharge=0, customs_fee=800,
                  total_price=19860, currency="RMB", incoterms="FOB",
                  valid_until=datetime.date(2026, 5, 20), status="accepted"),
        Quotation(customer_id=2, route_type="铁运", route_detail="义乌-中欧班列-汉堡",
                  cargo_type="普货", weight_kg=8500, volume_cbm=45.0,
                  base_price=8.2, fuel_surcharge=1.0, remote_surcharge=500, customs_fee=3500,
                  total_price=87800, currency="RMB", incoterms="DDP",
                  valid_until=datetime.date(2026, 5, 12), status="accepted"),
        Quotation(customer_id=3, route_type="海派", route_detail="上海-盐田-鹿特丹",
                  cargo_type="重货", weight_kg=15000, volume_cbm=68.0,
                  base_price=12.5, fuel_surcharge=3.0, remote_surcharge=1200, customs_fee=6000,
                  total_price=232000, currency="RMB", incoterms="CIF",
                  valid_until=datetime.date(2026, 5, 25), status="sent"),
        Quotation(customer_id=4, route_type="海派", route_detail="深圳-汉堡-FBA仓",
                  cargo_type="普货", weight_kg=2200, volume_cbm=12.0,
                  base_price=18.5, fuel_surcharge=2.8, remote_surcharge=300, customs_fee=1200,
                  total_price=36400, currency="RMB", incoterms="DDP",
                  valid_until=datetime.date(2026, 5, 15), status="accepted"),
        Quotation(customer_id=5, route_type="空派", route_detail="广州-阿姆斯特丹快件",
                  cargo_type="纺织品", weight_kg=350, volume_cbm=2.1,
                  base_price=32.0, fuel_surcharge=5.5, remote_surcharge=0, customs_fee=600,
                  total_price=13800, currency="RMB", incoterms="FCA",
                  valid_until=datetime.date(2026, 5, 10), status="expired"),
    ]
    db.add_all(quotations)
    db.commit()

    # ═══════════════════ 运单与轨迹 ═══════════════════
    orders = [
        Order(customer_id=1, tracking_number="SCD202605001US",
              route_detail="深圳-美森-洛杉矶", cargo_desc="锂电池组x200",
              weight_kg=520.0, volume_cbm=3.2, container_count=0,
              status="transit", origin="深圳盐田港", destination="洛杉矶港",
              etd=datetime.date(2026, 5, 3), eta=datetime.date(2026, 5, 22)),
        Order(customer_id=2, tracking_number="OKE202604001DE",
              route_detail="义乌-中欧班列-汉堡", cargo_desc="日用品/小商品混装",
              weight_kg=3800.0, volume_cbm=22.0, container_count=1,
              status="departed", origin="义乌铁路口岸", destination="汉堡港",
              etd=datetime.date(2026, 4, 28), eta=datetime.date(2026, 5, 18)),
        Order(customer_id=3, tracking_number="NBY202605001NL",
              route_detail="宁波-鹿特丹海路", cargo_desc="工业设备x5台",
              weight_kg=8200.0, volume_cbm=35.0, container_count=2,
              status="customs", origin="宁波舟山港", destination="鹿特丹港",
              etd=datetime.date(2026, 4, 20), eta=datetime.date(2026, 5, 28),
              has_exception=True, exception_type="海关查验"),
        Order(customer_id=4, tracking_number="ADE202605001DE",
              route_detail="深圳-汉堡FBA仓", cargo_desc="家居用品x500件",
              weight_kg=1100.0, volume_cbm=5.8, container_count=0,
              status="arrived", origin="深圳盐田港", destination="汉堡FBA仓",
              etd=datetime.date(2026, 4, 15), eta=datetime.date(2026, 5, 6),
              actual_delivery=datetime.date(2026, 5, 5)),
        Order(customer_id=1, tracking_number="SCD202604001UK",
              route_detail="深圳-空运-伦敦", cargo_desc="电池样品x50",
              weight_kg=85.0, volume_cbm=0.5, container_count=0,
              status="delivered", origin="深圳宝安机场", destination="伦敦希思罗",
              etd=datetime.date(2026, 4, 8), eta=datetime.date(2026, 4, 12),
              actual_delivery=datetime.date(2026, 4, 11)),
        Order(customer_id=5, tracking_number="HTF202605001NL",
              route_detail="广州-空运-阿姆斯特丹", cargo_desc="服装样品",
              weight_kg=120.0, volume_cbm=0.8, container_count=0,
              status="departed", origin="广州白云机场", destination="阿姆斯特丹",
              etd=datetime.date(2026, 5, 7), eta=datetime.date(2026, 5, 10)),
    ]
    db.add_all(orders)
    db.commit()

    # ═══════════════════ 轨迹事件 ═══════════════════
    tracking_events = [
        TrackingEvent(order_id=1, event_type="warehouse", location="深圳仓",
                      description="货物已入仓，完成称重和贴标",
                      event_time=datetime.datetime(2026, 5, 1, 14, 30)),
        TrackingEvent(order_id=1, event_type="departure", location="深圳盐田港",
                      description="集装箱已装船，预计5月22日抵达洛杉矶",
                      event_time=datetime.datetime(2026, 5, 3, 8, 0)),
        TrackingEvent(order_id=1, event_type="arrival", location="太平洋某海域",
                      description="船舶航行中，当前预计到港时间无变化",
                      event_time=datetime.datetime(2026, 5, 12, 10, 0)),
        TrackingEvent(order_id=2, event_type="departure", location="义乌铁路口岸",
                      description="班列已发车，经由阿拉山口出境",
                      event_time=datetime.datetime(2026, 4, 28, 16, 0)),
        TrackingEvent(order_id=3, event_type="customs", location="鹿特丹海关",
                      description="海关查验中，需提供额外产品认证文件",
                      event_time=datetime.datetime(2026, 5, 8, 9, 0)),
        TrackingEvent(order_id=3, event_type="exception", location="鹿特丹海关",
                      description="查验异常：缺少CE认证文件，请联系客户补充",
                      event_time=datetime.datetime(2026, 5, 8, 11, 30)),
        TrackingEvent(order_id=4, event_type="delivery", location="汉堡FBA仓",
                      description="货物已成功递送FBA仓库，签收完成",
                      event_time=datetime.datetime(2026, 5, 5, 15, 0)),
    ]
    db.add_all(tracking_events)
    db.commit()

    # ═══════════════════ 授信信息 ═══════════════════
    credits = [
        CreditInfo(customer_id=1, credit_score=780, credit_limit=500000, balance_due=120000,
                   payment_terms="NET30", days_aged=18, is_blacklisted=False,
                   risk_notes="优质客户，回款及时", last_reviewed=datetime.date(2026, 4, 1)),
        CreditInfo(customer_id=2, credit_score=820, credit_limit=800000, balance_due=350000,
                   payment_terms="NET45", days_aged=25, is_blacklisted=False,
                   risk_notes="月出货量稳定，信誉良好", last_reviewed=datetime.date(2026, 4, 15)),
        CreditInfo(customer_id=3, credit_score=650, credit_limit=300000, balance_due=280000,
                   payment_terms="NET30", days_aged=55, is_blacklisted=False,
                   risk_notes="近期回款放缓，需关注", last_reviewed=datetime.date(2026, 3, 20)),
        CreditInfo(customer_id=4, credit_score=720, credit_limit=400000, balance_due=85000,
                   payment_terms="NET30", days_aged=10, is_blacklisted=False,
                   risk_notes="新客户，首季度回款正常", last_reviewed=datetime.date(2026, 5, 1)),
        CreditInfo(customer_id=5, credit_score=480, credit_limit=100000, balance_due=95000,
                   payment_terms="NET15", days_aged=72, is_blacklisted=False,
                   risk_notes="回款严重滞后，建议收紧账期", last_reviewed=datetime.date(2026, 2, 15)),
    ]
    db.add_all(credits)
    db.commit()

    # ═══════════════════ 跟进记录 ═══════════════════
    activities = [
        ActivityLog(lead_id=1, activity_type="call", content="与陈总电话沟通，确认电池品类出货计划，每月约5-8个方，需要美森渠道", created_by="张晓明", created_at=now()),
        ActivityLog(lead_id=1, activity_type="meeting", content="拜访思科达，确认合作意向，提供美森带电产品报价方案", created_by="张晓明", created_at=now()),
        ActivityLog(lead_id=3, activity_type="quote", content="已发送中欧班列12月报价，客户对价格满意，预计下周确认", created_by="李强", created_at=now()),
        ActivityLog(customer_id=1, activity_type="email", content="发送Q2季度运输方案：美森主线+盐田备线，已确认", created_by="张晓明", created_at=now()),
        ActivityLog(customer_id=2, activity_type="call", content="确认圣诞季备货计划，需提前预订舱位", created_by="李强", created_at=now()),
        ActivityLog(customer_id=3, activity_type="complaint", content="客户反馈鹿特丹查验延误，影响交期，需要紧急协调", created_by="张晓明", created_at=now()),
        ActivityLog(customer_id=5, activity_type="call", content="提醒李经理当前欠款已超账期15天，请尽快安排回款", created_by="财务部-王会计", created_at=now()),
    ]
    db.add_all(activities)
    db.commit()

    # ═══════════════════ 投诉 ═══════════════════
    complaints = [
        Complaint(order_id=3, customer_id=3, complaint_type="customs",
                  description="鹿特丹海关查验导致延误超过预期，影响终端客户交期",
                  claim_amount=50000, status="investigating",
                  resolution="已联系目的港代理加急处理，预计2个工作日内放行"),
        Complaint(order_id=2, customer_id=2, complaint_type="delay",
                  description="中欧班列因阿拉山口口岸拥堵，延误约3天",
                  claim_amount=0, status="resolved",
                  resolution="已向客户说明不可抗力因素，客户表示理解"),
    ]
    db.add_all(complaints)
    db.commit()

    print("✅ 演示数据已填充完成！")
    print(f"  线索: {len(leads)} 条")
    print(f"  客户: {len(customers)} 家")
    print(f"  商机: {len(opportunities)} 个")
    print(f"  报价单: {len(quotations)} 张")
    print(f"  运单: {len(orders)} 票")
    print(f"  轨迹事件: {len(tracking_events)} 条")
    print(f"  授信记录: {len(credits)} 条")
    print(f"  跟进记录: {len(activities)} 条")
    print(f"  投诉: {len(complaints)} 个")
    db.close()


if __name__ == "__main__":
    seed()
