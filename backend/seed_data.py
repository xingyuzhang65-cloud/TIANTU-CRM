"""演示数据 — 跨境物流CRM业务场景 · 10状态生命周期"""
import sys, datetime
sys.stdout.reconfigure(encoding='utf-8')
from database import SessionLocal, engine, Base
from models import (
    Lead, Customer, Opportunity, Quotation, Inquiry, Order, TrackingEvent,
    CreditInfo, ActivityLog, Complaint, FollowUp, ClaimRecord, SystemConfig, User,
    Moment, MomentInteraction, FollowupReminder,
    STATUS_NEW, STATUS_CONTACTED, STATUS_DISQUALIFIED,
    STATUS_NURTURING, STATUS_QUOTED, STATUS_NEGOTIATING,
    STATUS_TRIAL, STATUS_ACTIVE, STATUS_RECEDING, STATUS_CHURNED,
    LEAD_STATUS_PUBLIC, LEAD_STATUS_PRIVATE, LEAD_STATUS_CONVERTED,
)
import bcrypt
import json


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    for tbl in [FollowupReminder, Complaint, TrackingEvent, Order, Quotation, Inquiry, Opportunity,
                CreditInfo, ActivityLog, Customer, FollowUp, ClaimRecord,
                MomentInteraction, Moment, Lead, User, SystemConfig]:
        db.query(tbl).delete()
    db.commit()

    now = datetime.datetime.now

    # ═══════════════════ 演示用户 ═══════════════════
    demo_pw = bcrypt.hashpw("123456".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    users_data = [
        User(username="13800138000", password_hash=demo_pw, name="张晓明",
             phone="13800138000", role="sales", department_id=1),
        User(username="13800138001", password_hash=demo_pw, name="陈总",
             phone="13800138001", role="sales", department_id=1),
        User(username="13800138002", password_hash=demo_pw, name="李强",
             phone="13800138002", role="sales", department_id=2),
        User(username="13800138003", password_hash=demo_pw, name="王芳",
             phone="13800138003", role="admin", department_id=3),
        User(username="admin", password_hash=demo_pw, name="系统管理员",
             phone="", role="admin", department_id=0),
    ]
    for u in users_data:
        db.add(u)
    db.commit()

    # ═══════════════════ 线索公海池 (潜客阶段: new/contacted/disqualified) ═══════════════════
    leads = [
        Lead(company_name="深圳思科达电子有限公司", contact_name="陈总",
             contact_mobile="13800138001", phone="13800138001",
             email="chen@scd-tech.cn", source="展会", country="中国",
             target_market="美国", product_interest="海派-FBA头程",
             logistics_type="FBA",
             status=STATUS_CONTACTED, lead_status=LEAD_STATUS_PRIVATE,
             owner="张晓明", owner_id=1, assigned_at=now(),
             last_followed=now(), next_follow_at=now() + datetime.timedelta(days=3),
             follow_count=5, reclaim_deadline=now() + datetime.timedelta(hours=72)),
        Lead(company_name="广州恒通服装贸易有限公司", contact_name="李经理",
             contact_mobile="13800138002", phone="13800138002",
             email="li@htfashion.com", source="独立站", country="中国",
             target_market="欧洲", product_interest="空派-快件",
             logistics_type="空派",
             status=STATUS_NEW, lead_status=LEAD_STATUS_PRIVATE,
             owner="张晓明", owner_id=1, assigned_at=now(),
             last_followed=now() - datetime.timedelta(days=8), follow_count=0,
             auto_reclaim=True,
             reclaim_deadline=now() - datetime.timedelta(hours=48)),
        Lead(company_name="义乌欧凯进出口有限公司", contact_name="王芳",
             contact_mobile="13800138003", phone="13800138003",
             email="wangf@okexport.com", source="社媒", country="中国",
             target_market="欧洲", product_interest="铁运-中欧班列",
             logistics_type="海派",
             status=STATUS_CONTACTED, lead_status=LEAD_STATUS_PRIVATE,
             owner="李强", owner_id=2, assigned_at=now(),
             last_followed=now(), next_follow_at=now() + datetime.timedelta(days=1),
             follow_count=4, reclaim_deadline=now() + datetime.timedelta(hours=120)),
        Lead(company_name="杭州锐思科技有限公司", contact_name="赵总",
             contact_mobile="13800138004", phone="13800138004",
             email="zhao@ruisi-tech.com", source="海关数据", country="中国",
             target_market="日韩", product_interest="海派-重货",
             logistics_type="海派",
             status=STATUS_NEW, lead_status=LEAD_STATUS_PUBLIC,
             owner=None, owner_id=None, assigned_at=None,
             last_followed=None, follow_count=0, reclaim_deadline=None),
        Lead(company_name="东莞联达塑胶制品有限公司", contact_name="孙经理",
             contact_mobile="13800138005", phone="13800138005",
             email="sun@lianda-plastic.com", source="转介绍", country="中国",
             target_market="欧洲", product_interest="卡航-欧洲",
             logistics_type="海派",
             status=STATUS_NEW, lead_status=LEAD_STATUS_PUBLIC,
             owner=None, owner_id=None, assigned_at=None,
             last_followed=None, follow_count=0, reclaim_deadline=None),
        Lead(company_name="宁波远洋国际贸易有限公司", contact_name="周董",
             contact_mobile="13800138006", phone="13800138006",
             email="zhou@yuanyang.com", source="展会", country="中国",
             target_market="美国", product_interest="海派-整柜",
             logistics_type="海派",
             status=STATUS_CONTACTED, lead_status=LEAD_STATUS_PRIVATE,
             owner="张晓明", owner_id=1, assigned_at=now(),
             last_followed=now(), next_follow_at=now() + datetime.timedelta(days=2),
             follow_count=8, reclaim_deadline=now() + datetime.timedelta(hours=96)),
        Lead(company_name="AmazonSeller-DE GmbH", contact_name="Michael Braun",
             contact_mobile="+49-176-1234567", phone="+49-176-1234567",
             email="m.braun@amzde.de", source="独立站", country="德国",
             target_market="欧洲", product_interest="海派-FBA头程",
             logistics_type="FBA",
             status=STATUS_NEW, lead_status=LEAD_STATUS_PUBLIC,
             owner=None, owner_id=None, assigned_at=None,
             last_followed=None, follow_count=0, reclaim_deadline=None),
        Lead(company_name="同行-深圳快运通", contact_name="黄某",
             contact_mobile="13800138007", phone="13800138007",
             email="huang@kyt.com", source="海关数据", country="中国",
             target_market="中东", product_interest="海派-普货",
             logistics_type="一件代发",
             status=STATUS_DISQUALIFIED, lead_status=LEAD_STATUS_CONVERTED,
             owner="李强", owner_id=2, assigned_at=now(),
             last_followed=now() - datetime.timedelta(days=3), follow_count=2,
             reclaim_deadline=None, converted_at=now(), converted_to_type="customer"),
    ]
    db.add_all(leads)
    db.flush()

    # ═══════════════════ 线索跟进记录 (历史数据) ═══════════════════
    lead_follows = [
        # 线索1: 思科达电子 (follow_count=5)
        FollowUp(lead_id=1, status="新建", content=f"{(now()-datetime.timedelta(days=30)).strftime('%m月%d日 %H:%M')} 新建了线索「深圳思科达电子有限公司」", created_by="张晓明", created_at=now()-datetime.timedelta(days=30)),
        FollowUp(lead_id=1, status="初步沟通", content="电话沟通了解客户需求，客户做亚马逊FBA，月出货量约30方，对时效要求高，推荐美森快船线", created_by="张晓明", created_at=now()-datetime.timedelta(days=25)),
        FollowUp(lead_id=1, status="初步沟通", content="发送公司介绍和美森线报价方案，客户表示与其他家比较中", created_by="张晓明", created_at=now()-datetime.timedelta(days=18)),
        FollowUp(lead_id=1, status="意向强烈", content="客户确认试单，首批500kg带电产品走美森线到洛杉矶仓", created_by="张晓明", created_at=now()-datetime.timedelta(days=10)),
        FollowUp(lead_id=1, status="意向强烈", content="试单签收完成，客户非常满意时效，确认转为长期合作，月出货量预期40方+", image_urls='["/static/uploads/moment_sign8.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=3)),

        # 线索2: 恒通服装 (follow_count=0, 已逾期)
        FollowUp(lead_id=2, status="新建", content=f"{(now()-datetime.timedelta(days=14)).strftime('%m月%d日 %H:%M')} 新建了线索「广州恒通服装贸易有限公司」", created_by="张晓明", created_at=now()-datetime.timedelta(days=14)),

        # 线索3: 欧凯进出口 (follow_count=4)
        FollowUp(lead_id=3, status="新建", content=f"{(now()-datetime.timedelta(days=45)).strftime('%m月%d日 %H:%M')} 新建了线索「义乌欧凯进出口有限公司」", created_by="李强", created_at=now()-datetime.timedelta(days=45)),
        FollowUp(lead_id=3, status="初步沟通", content="客户从义乌市场采购小商品，现有物流合作伙伴服务不满意，寻求替代方案", created_by="李强", created_at=now()-datetime.timedelta(days=40)),
        FollowUp(lead_id=3, status="初步沟通", content="提供中欧班列拼柜方案，对比现有物流可节省约15%成本", created_by="李强", created_at=now()-datetime.timedelta(days=30)),
        FollowUp(lead_id=3, status="意向强烈", content="客户确认Q3开始合作，首批3个柜测试中欧班列义乌→杜伊斯堡", image_urls='["/static/uploads/moment_cargo3.jpg","/static/uploads/moment_warehouse7.jpg"]', created_by="李强", created_at=now()-datetime.timedelta(days=5)),

        # 线索4: 锐思科技 (公海)
        FollowUp(lead_id=4, status="新建", content=f"{(now()-datetime.timedelta(days=20)).strftime('%m月%d日 %H:%M')} 新建了线索「杭州锐思科技有限公司」", created_by="系统", created_at=now()-datetime.timedelta(days=20)),

        # 线索5: 联达塑胶 (公海)
        FollowUp(lead_id=5, status="新建", content=f"{(now()-datetime.timedelta(days=60)).strftime('%m月%d日 %H:%M')} 新建了线索「东莞联达塑胶制品有限公司」", created_by="系统", created_at=now()-datetime.timedelta(days=60)),

        # 线索6: 宁波远洋 (follow_count=8)
        FollowUp(lead_id=6, status="新建", content=f"{(now()-datetime.timedelta(days=90)).strftime('%m月%d日 %H:%M')} 新建了线索「宁波远洋国际贸易有限公司」", created_by="张晓明", created_at=now()-datetime.timedelta(days=90)),
        FollowUp(lead_id=6, status="初步沟通", content="宁波远洋是大型贸易公司，主要出口机械设备到欧美，货量大但频次低", created_by="张晓明", created_at=now()-datetime.timedelta(days=85)),
        FollowUp(lead_id=6, status="初步沟通", content="客户对DDP服务有需求，特别是欧洲线门到门服务", created_by="张晓明", created_at=now()-datetime.timedelta(days=75)),
        FollowUp(lead_id=6, status="意向强烈", content="提供盐田→洛杉矶和上海→鹿特丹两条线路的DDP报价", image_urls='["/static/uploads/moment_chart5.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=60)),
        FollowUp(lead_id=6, status="意向强烈", content="客户对洛杉矶线报价满意，确认试单一个40HQ柜", created_by="张晓明", created_at=now()-datetime.timedelta(days=45)),
        FollowUp(lead_id=6, status="意向强烈", content="试单顺利完成，客户讨论季度包柜方案", created_by="张晓明", created_at=now()-datetime.timedelta(days=20)),
        FollowUp(lead_id=6, status="初步沟通", content="发送Q3季度包柜报价，讨论鹿特丹线加开方案", created_by="张晓明", created_at=now()-datetime.timedelta(days=8)),
        FollowUp(lead_id=6, status="意向强烈", content="客户邮件确认Q3两个航线各月2个HQ柜，正在走合同流程", image_urls='["/static/uploads/moment_office1.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=2)),

        # 线索7: AmazonSeller-DE (公海)
        FollowUp(lead_id=7, status="新建", content=f"{(now()-datetime.timedelta(days=10)).strftime('%m月%d日 %H:%M')} 新建了线索「AmazonSeller-DE GmbH」", created_by="系统", created_at=now()-datetime.timedelta(days=10)),

        # 线索8: 同行-快运通 (已转化)
        FollowUp(lead_id=8, status="新建", content=f"{(now()-datetime.timedelta(days=120)).strftime('%m月%d日 %H:%M')} 新建了线索「同行-深圳快运通」", created_by="李强", created_at=now()-datetime.timedelta(days=120)),
        FollowUp(lead_id=8, status="初步沟通", content="同行客户，主要做中东市场，希望合作互补", created_by="李强", created_at=now()-datetime.timedelta(days=115)),
    ]
    db.add_all(lead_follows)
    db.commit()

    # ═══════════════════ 客户 (生命周期各阶段) ═══════════════════
    customers = [
        Customer(lead_id=1, company_name="深圳思科达电子有限公司", contact_name="陈总",
                 phone="13800138001", email="chen@scd-tech.cn", country="中国",
                 customer_type="直客", main_market="北美",
                 main_category="带电产品(电池)", cargo_preferences="锂电池/充电宝/电动工具",
                 shipping_frequency="weekly",
                 usual_routes="美森快船,盐田普船", export_qualification="危包证,UN38.3",
                 avg_monthly_volume=45.5, avg_monthly_revenue=285000, customer_level="A",
                 health_score=88, cooperation_since=datetime.date(2023, 6, 1),
                 lifecycle_status=STATUS_ACTIVE, status_changed_at=now(), status_changed_by="张晓明"),
        Customer(lead_id=3, company_name="义乌欧凯进出口有限公司", contact_name="王芳",
                 phone="13800138003", email="wangf@okexport.com", country="中国",
                 customer_type="直客", main_market="欧洲",
                 main_category="小商品/日用百货", cargo_preferences="节日装饰/厨房用品/玩具",
                 shipping_frequency="daily",
                 usual_routes="中欧班列,卡航", export_qualification="一般贸易",
                 avg_monthly_volume=120.0, avg_monthly_revenue=420000, customer_level="A",
                 health_score=92, cooperation_since=datetime.date(2022, 3, 15),
                 lifecycle_status=STATUS_TRIAL, status_changed_at=now(), status_changed_by="李强"),
        Customer(lead_id=6, company_name="宁波远洋国际贸易有限公司", contact_name="周董",
                 phone="13800138006", email="zhou@yuanyang.com", country="中国",
                 customer_type="同行", main_market="北美/欧洲",
                 main_category="大型机械设备", cargo_preferences="注塑机/数控机床/工程机械",
                 shipping_frequency="monthly",
                 usual_routes="盐田-洛杉矶,上海-鹿特丹", export_qualification="出口许可证",
                 avg_monthly_volume=200.0, avg_monthly_revenue=680000, customer_level="B",
                 health_score=72, cooperation_since=datetime.date(2023, 9, 10),
                 lifecycle_status=STATUS_NEGOTIATING, status_changed_at=now(), status_changed_by="张晓明"),
        Customer(company_name="AmazonSeller-DE GmbH", contact_name="Michael Braun",
                 phone="+49-176-1234567", email="m.braun@amzde.de", country="德国",
                 customer_type="直客", main_market="欧洲",
                 main_category="普货(家居用品)", cargo_preferences="收纳柜/台灯/装饰画框",
                 shipping_frequency="weekly",
                 usual_routes="海派FBA-DEU", export_qualification="CE认证",
                 avg_monthly_volume=32.0, avg_monthly_revenue=180000, customer_level="B",
                 health_score=75, cooperation_since=datetime.date(2024, 1, 20),
                 lifecycle_status=STATUS_QUOTED, status_changed_at=now(), status_changed_by="李强"),
        Customer(lead_id=2, company_name="广州恒通服装贸易有限公司", contact_name="李经理",
                 phone="13800138002", email="li@htfashion.com", country="中国",
                 customer_type="直客", main_market="中东/南美",
                 main_category="纺织品/服装", cargo_preferences="连衣裙/T恤/牛仔裤",
                 shipping_frequency="weekly",
                 usual_routes="空派快件,卡航", export_qualification="一般贸易",
                 avg_monthly_volume=18.0, avg_monthly_revenue=95000, customer_level="C",
                 health_score=55, cooperation_since=datetime.date(2024, 6, 1),
                 lifecycle_status=STATUS_RECEDING, status_changed_at=now(), status_changed_by="张晓明"),
        Customer(lead_id=4, company_name="杭州锐思科技有限公司", contact_name="赵总",
                 phone="13800138004", email="zhao@ruisi-tech.com", country="中国",
                 customer_type="同行", main_market="东南亚",
                 main_category="电子产品", cargo_preferences="手机配件/智能穿戴/蓝牙耳机",
                 shipping_frequency="monthly",
                 usual_routes="空派快件", export_qualification="一般贸易",
                 avg_monthly_volume=5.0, avg_monthly_revenue=28000, customer_level="C",
                 health_score=60, cooperation_since=datetime.date(2026, 3, 1),
                 lifecycle_status=STATUS_NURTURING, status_changed_at=now(), status_changed_by="李强"),
        Customer(lead_id=5, company_name="东莞联达塑胶制品有限公司", contact_name="孙经理",
                 phone="13800138005", email="sun@lianda-plastic.com", country="中国",
                 customer_type="直客", main_market="欧洲",
                 main_category="塑胶制品/普货", cargo_preferences="塑料花盆/PVC管材/塑胶配件",
                 shipping_frequency="monthly",
                 usual_routes="卡航-欧洲", export_qualification="一般贸易",
                 avg_monthly_volume=0, avg_monthly_revenue=0, customer_level="D",
                 health_score=40, cooperation_since=None,
                 lifecycle_status=STATUS_CHURNED, status_changed_at=now(), status_changed_by="张晓明"),
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
                  base_price=15.8, fuel_surcharge=2.5, customs_fee=800,
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
                  base_price=32.0, fuel_surcharge=5.5, customs_fee=600,
                  total_price=13800, currency="RMB", incoterms="FCA",
                  valid_until=datetime.date(2026, 5, 10), status="expired"),
    ]
    db.add_all(quotations)
    db.commit()

    # ═══════════════════ 询价单 ═══════════════════
    inquiries = [
        Inquiry(inquiry_no="INQ-20260531-001", customer_id=1,
                company_name="深圳思科达电子有限公司", contact_name="陈总", contact_mobile="13800138001",
                route_type="海派", cargo_mode="FCL", cargo_type="带电产品",
                origin="深圳", destination="洛杉矶", container_type="40HQ", container_count=2,
                weight_kg=18000, volume_cbm=58,
                incoterms="FOB", expected_delivery="2026-06-15",
                customs_needed=1, clearance_needed=1, delivery_needed=1,
                notes="美森限时达优先，客户要求6月中旬前到仓",
                status="pricing", created_by=1, created_by_name="张晓明",
                urged_at=datetime.datetime.now()),
        Inquiry(inquiry_no="INQ-20260530-002", customer_id=2,
                company_name="广州恒通服装贸易有限公司", contact_name="李经理", contact_mobile="13800138002",
                route_type="空派", cargo_mode="LCL", cargo_type="纺织品",
                origin="广州", destination="阿姆斯特丹", pieces=50, weight_kg=350, volume_cbm=2.1,
                incoterms="FCA", expected_delivery="2026-06-08",
                customs_needed=1, clearance_needed=0, delivery_needed=1,
                notes="快件时效优先，成本其次",
                status="pricing", created_by=1, created_by_name="张晓明"),
        Inquiry(inquiry_no="INQ-20260530-003", customer_id=3,
                company_name="宁波博源电子股份有限公司", contact_name="王总", contact_mobile="13800138003",
                route_type="海派", cargo_mode="LCL", cargo_type="普货",
                origin="宁波", destination="鹿特丹", pieces=200, weight_kg=1200, volume_cbm=5.5,
                incoterms="DDP", expected_delivery="2026-07-01",
                customs_needed=1, clearance_needed=1, delivery_needed=1,
                notes="",
                status="priced", created_by=1, created_by_name="张晓明"),
        Inquiry(inquiry_no="INQ-20260528-004", customer_id=4,
                company_name="华远供应链(深圳)", contact_name="赵经理", contact_mobile="13800138004",
                route_type="铁运", cargo_mode="FCL", cargo_type="重货",
                origin="义乌", destination="汉堡", container_type="40GP", container_count=1,
                weight_kg=22000, volume_cbm=55,
                incoterms="CIF", expected_delivery="2026-07-15",
                customs_needed=1, clearance_needed=1, delivery_needed=0,
                notes="中欧班列线路",
                status="pricing", created_by=2, created_by_name="陈总"),
        Inquiry(inquiry_no="INQ-20260525-005", customer_id=5,
                company_name="深圳市华盛物流有限公司", contact_name="刘经理", contact_mobile="13800138005",
                route_type="卡航", cargo_mode="LCL", cargo_type="敏感品",
                origin="深圳", destination="河内", pieces=30, weight_kg=200, volume_cbm=1.2,
                incoterms="FOB", expected_delivery="2026-06-05",
                customs_needed=1, clearance_needed=0, delivery_needed=1,
                notes="越南陆运，需了解税费",
                status="pricing", created_by=1, created_by_name="张晓明"),
    ]
    db.add_all(inquiries)
    db.commit()

    # ═══════════════════ 运单 ═══════════════════
    orders = [
        Order(customer_id=1, tracking_number="SCD202605001US",
              route_detail="深圳-美森-洛杉矶", cargo_desc="锂电池组x200",
              weight_kg=520.0, volume_cbm=3.2, status="transit",
              origin="深圳盐田港", destination="洛杉矶港",
              etd=datetime.date(2026, 5, 3), eta=datetime.date(2026, 5, 22)),
        Order(customer_id=2, tracking_number="OKE202604001DE",
              route_detail="义乌-中欧班列-汉堡", cargo_desc="日用品/小商品混装",
              weight_kg=3800.0, volume_cbm=22.0, container_count=1, status="departed",
              origin="义乌铁路口岸", destination="汉堡港",
              etd=datetime.date(2026, 4, 28), eta=datetime.date(2026, 5, 18)),
        Order(customer_id=3, tracking_number="NBY202605001NL",
              route_detail="宁波-鹿特丹海路", cargo_desc="工业设备x5台",
              weight_kg=8200.0, volume_cbm=35.0, container_count=2, status="customs",
              origin="宁波舟山港", destination="鹿特丹港",
              etd=datetime.date(2026, 4, 20), eta=datetime.date(2026, 5, 28),
              has_exception=True, exception_type="海关查验"),
        Order(customer_id=4, tracking_number="ADE202605001DE",
              route_detail="深圳-汉堡FBA仓", cargo_desc="家居用品x500件",
              weight_kg=1100.0, volume_cbm=5.8, status="arrived",
              origin="深圳盐田港", destination="汉堡FBA仓",
              etd=datetime.date(2026, 4, 15), eta=datetime.date(2026, 5, 6),
              actual_delivery=datetime.date(2026, 5, 5)),
        Order(customer_id=1, tracking_number="SCD202604001UK",
              route_detail="深圳-空运-伦敦", cargo_desc="电池样品x50",
              weight_kg=85.0, volume_cbm=0.5, status="delivered",
              origin="深圳宝安机场", destination="伦敦希思罗",
              etd=datetime.date(2026, 4, 8), eta=datetime.date(2026, 4, 12),
              actual_delivery=datetime.date(2026, 4, 11)),
        Order(customer_id=5, tracking_number="HTF202605001NL",
              route_detail="广州-空运-阿姆斯特丹", cargo_desc="服装样品",
              weight_kg=120.0, volume_cbm=0.8, status="departed",
              origin="广州白云机场", destination="阿姆斯特丹",
              etd=datetime.date(2026, 5, 7), eta=datetime.date(2026, 5, 10)),
        # 异常单
        Order(customer_id=1, tracking_number="SCD202605002US",
              route_detail="深圳-美森-芝加哥FBA仓", cargo_desc="充电器x800件",
              weight_kg=2300.0, volume_cbm=14.0, container_count=1, status="customs",
              origin="深圳盐田港", destination="芝加哥",
              etd=datetime.date(2026, 5, 1), eta=datetime.date(2026, 5, 20),
              has_exception=True, exception_type="海关查验"),
        Order(customer_id=4, tracking_number="ADE202605002DE",
              route_detail="义乌-铁运-杜伊斯堡", cargo_desc="日用品混装",
              weight_kg=4500.0, volume_cbm=28.0, container_count=1, status="transit",
              origin="义乌铁路口岸", destination="杜伊斯堡",
              etd=datetime.date(2026, 5, 5), eta=datetime.date(2026, 6, 5),
              has_exception=True, exception_type="船期延误"),
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
        # Order 7 - exception: customs exam
        TrackingEvent(order_id=7, event_type="warehouse", location="深圳仓",
                      description="货物入仓，完成称重和贴标",
                      event_time=datetime.datetime(2026, 4, 28, 10, 0)),
        TrackingEvent(order_id=7, event_type="departure", location="深圳盐田港",
                      description="集装箱已装船，美森限时达 预计5月20日抵达芝加哥",
                      event_time=datetime.datetime(2026, 5, 1, 6, 0)),
        TrackingEvent(order_id=7, event_type="arrival", location="洛杉矶港 [美西时间 PST]",
                      description="船只抵达洛杉矶港锚地，等待靠泊",
                      event_time=datetime.datetime(2026, 5, 26, 3, 0)),
        TrackingEvent(order_id=7, event_type="customs", location="洛杉矶海关 [美西时间 PST]",
                      description="目的港海关申报已完成，已放行",
                      event_time=datetime.datetime(2026, 5, 28, 10, 0)),
        TrackingEvent(order_id=7, event_type="exception", location="洛杉矶港 [美西时间 PST]",
                      description="该柜被美国海关CBP抽中CET查验，预计延误7-14天，需等待二次开箱检查通知",
                      event_time=datetime.datetime(2026, 5, 30, 14, 0)),
        # Order 8 - exception: vessel delay
        TrackingEvent(order_id=8, event_type="warehouse", location="义乌仓",
                      description="货物已入仓，等待装柜",
                      event_time=datetime.datetime(2026, 4, 30, 15, 0)),
        TrackingEvent(order_id=8, event_type="departure", location="义乌铁路口岸",
                      description="班列已发车，经由阿拉山口出境前往杜伊斯堡",
                      event_time=datetime.datetime(2026, 5, 5, 20, 0)),
        TrackingEvent(order_id=8, event_type="exception", location="阿拉山口 [北京时间 CST]",
                      description="班列因境外铁路拥堵预计延误3-5天，当前停靠阿拉山口等待调度",
                      event_time=datetime.datetime(2026, 5, 25, 8, 0)),
    ]
    db.add_all(tracking_events)
    db.commit()

    # ═══════════════════ 授信 ═══════════════════
    credits = [
        CreditInfo(customer_id=1, credit_score=780, credit_limit=500000, balance_due=120000,
                   payment_terms="NET30", days_aged=18, risk_notes="优质客户，回款及时",
                   last_reviewed=datetime.date(2026, 4, 1)),
        CreditInfo(customer_id=2, credit_score=820, credit_limit=800000, balance_due=350000,
                   payment_terms="NET45", days_aged=25, risk_notes="月出货量稳定，信誉良好",
                   last_reviewed=datetime.date(2026, 4, 15)),
        CreditInfo(customer_id=3, credit_score=650, credit_limit=300000, balance_due=280000,
                   payment_terms="NET30", days_aged=55, risk_notes="近期回款放缓，需关注",
                   last_reviewed=datetime.date(2026, 3, 20)),
        CreditInfo(customer_id=4, credit_score=720, credit_limit=400000, balance_due=85000,
                   payment_terms="NET30", days_aged=10, risk_notes="新客户，首季度回款正常",
                   last_reviewed=datetime.date(2026, 5, 1)),
        CreditInfo(customer_id=5, credit_score=480, credit_limit=100000, balance_due=95000,
                   payment_terms="NET15", days_aged=72, risk_notes="回款严重滞后，建议收紧账期",
                   last_reviewed=datetime.date(2026, 2, 15)),
    ]
    db.add_all(credits)
    db.commit()

    # ═══════════════════ 跟进记录 (含状态变更记录) ═══════════════════
    activities = [
        # 思科达的状态流转记录
        ActivityLog(lead_id=1, activity_type="call", content="与陈总电话沟通，确认电池品类出货计划，每月约5-8个方，需要美森渠道", created_by="张晓明", created_at=now()),
        ActivityLog(customer_id=1, activity_type="status_change", content="意向客户 → 已报价", status_from=STATUS_NURTURING, status_to=STATUS_QUOTED, created_by="张晓明", created_at=now() - datetime.timedelta(days=180)),
        ActivityLog(customer_id=1, activity_type="status_change", content="已报价 → 商务谈判", status_from=STATUS_QUOTED, status_to=STATUS_NEGOTIATING, created_by="张晓明", created_at=now() - datetime.timedelta(days=160)),
        ActivityLog(customer_id=1, activity_type="status_change", content="商务谈判 → 试单中", status_from=STATUS_NEGOTIATING, status_to=STATUS_TRIAL, created_by="张晓明", created_at=now() - datetime.timedelta(days=140)),
        ActivityLog(customer_id=1, activity_type="status_change", content="试单中 → 正式合作", status_from=STATUS_TRIAL, status_to=STATUS_ACTIVE, created_by="张晓明", created_at=now() - datetime.timedelta(days=100)),
        # 义乌欧凯
        ActivityLog(lead_id=3, activity_type="quote", content="已发送中欧班列12月报价，客户对价格满意", created_by="李强", created_at=now() - datetime.timedelta(days=90)),
        ActivityLog(customer_id=2, activity_type="status_change", content="意向客户 → 已报价", status_from=STATUS_NURTURING, status_to=STATUS_QUOTED, created_by="李强", created_at=now() - datetime.timedelta(days=85)),
        ActivityLog(customer_id=2, activity_type="status_change", content="已报价 → 商务谈判", status_from=STATUS_QUOTED, status_to=STATUS_NEGOTIATING, created_by="李强", created_at=now() - datetime.timedelta(days=70)),
        ActivityLog(customer_id=2, activity_type="status_change", content="商务谈判 → 试单中", status_from=STATUS_NEGOTIATING, status_to=STATUS_TRIAL, created_by="李强", created_at=now() - datetime.timedelta(days=50)),
        # 宁波远洋
        ActivityLog(customer_id=3, activity_type="status_change", content="已报价 → 商务谈判", status_from=STATUS_QUOTED, status_to=STATUS_NEGOTIATING, created_by="张晓明", created_at=now() - datetime.timedelta(days=20)),
        ActivityLog(customer_id=3, activity_type="call", content="讨论鹿特丹线DDP条款细节，客户对清关费用有异议", created_by="张晓明", created_at=now() - datetime.timedelta(days=10)),
        # 广州恒通 — 休眠预警
        ActivityLog(customer_id=5, activity_type="status_change", content="正式合作 → 减量/休眠", status_from=STATUS_ACTIVE, status_to=STATUS_RECEDING, created_by="张晓明", created_at=now() - datetime.timedelta(days=14)),
        ActivityLog(customer_id=5, activity_type="call", content="提醒李经理当前欠款已超账期15天，已连续14天无新单，需跟进原因", created_by="财务部-王会计", created_at=now()),
        # 东莞联达 — 已流失
        ActivityLog(customer_id=7, activity_type="status_change", content="减量/休眠 → 已流失", status_from=STATUS_RECEDING, status_to=STATUS_CHURNED, created_by="张晓明", created_at=now() - datetime.timedelta(days=30)),
        ActivityLog(customer_id=7, activity_type="call", content="客户确认已更换货代至同行，流失原因：价格不具备优势", created_by="张晓明", created_at=now() - datetime.timedelta(days=30)),
        # 当前活动
        ActivityLog(customer_id=1, activity_type="email", content="发送Q2季度运输方案：美森主线+盐田备线，已确认", created_by="张晓明", created_at=now()),
        ActivityLog(customer_id=2, activity_type="call", content="确认圣诞季备货计划，需提前预订舱位", created_by="李强", created_at=now()),
        ActivityLog(customer_id=3, activity_type="complaint", content="客户反馈鹿特丹查验延误，影响交期，需要紧急协调", created_by="张晓明", created_at=now()),

        # ══ 客户日常跟进记录 (历史数据) ══
        # 思科达 (客户1) — A级客户，活跃中
        ActivityLog(customer_id=1, activity_type="visit", content="拜访思科达陈总，实地考察其仓库出货流程，确认电池品类包装合规方案", image_urls='["/static/uploads/moment_warehouse7.jpg","/static/uploads/moment_cargo3.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=60)),
        ActivityLog(customer_id=1, activity_type="call", content="电话沟通5月排舱计划：预计4票美森+2票盐田，总体约120方", created_by="张晓明", created_at=now()-datetime.timedelta(days=35)),
        ActivityLog(customer_id=1, activity_type="meeting", content="季度复盘会议：Q2累计出货121方，MoM+6%，客户对时效满意度92分", image_urls='["/static/uploads/moment_meeting4.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=15)),
        ActivityLog(customer_id=1, activity_type="call", content="沟通新品充电宝运输资质要求，需UN38.3+MSDS文件，已协助客户准备", created_by="张晓明", created_at=now()-datetime.timedelta(days=5)),

        # 欧凯 (客户2) — A级客户，试单中
        ActivityLog(customer_id=2, activity_type="visit", content="赴义乌拜访王芳经理，参观其义乌仓配中心，日均发货量约40票", image_urls='["/static/uploads/moment_warehouse7.jpg"]', created_by="李强", created_at=now()-datetime.timedelta(days=40)),
        ActivityLog(customer_id=2, activity_type="call", content="沟通中欧班列冬季运输方案，需关注低温环境下部分商品包装加固", created_by="李强", created_at=now()-datetime.timedelta(days=20)),
        ActivityLog(customer_id=2, activity_type="email", content="发送圣诞季欧洲线备货计划书，建议提前8周锁定舱位", created_by="李强", created_at=now()-datetime.timedelta(days=7)),

        # 宁波远洋 (客户3) — B级客户，谈判中
        ActivityLog(customer_id=3, activity_type="call", content="与周董电话沟通，了解其大型设备出口欧美线的常规流程和痛点", created_by="张晓明", created_at=now()-datetime.timedelta(days=55)),
        ActivityLog(customer_id=3, activity_type="meeting", content="面谈：客户对DDP条款有顾虑，主要担心目的港清关费用不可控", image_urls='["/static/uploads/moment_meeting4.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=35)),
        ActivityLog(customer_id=3, activity_type="email", content="发送鹿特丹DDP费用拆分明细表，逐项说明清关/税金/送货费用构成", created_by="张晓明", created_at=now()-datetime.timedelta(days=20)),
        ActivityLog(customer_id=3, activity_type="visit", content="带运营团队参观客户宁波仓库，进行大型设备包装方案现场评估", image_urls='["/static/uploads/moment_team2.jpg","/static/uploads/moment_warehouse7.jpg"]', created_by="张晓明", created_at=now()-datetime.timedelta(days=12)),

        # AmazonSeller-DE (客户4) — B级客户，已报价
        ActivityLog(customer_id=4, activity_type="email", content="回复客户关于海派FBA-DEU的时效和价格咨询，附带德国仓库入仓要求", created_by="李强", created_at=now()-datetime.timedelta(days=25)),
        ActivityLog(customer_id=4, activity_type="call", content="与Michael讨论CE认证产品的运输要求，确认所有产品已通过认证", created_by="李强", created_at=now()-datetime.timedelta(days=12)),

        # 恒通服装 (客户5) — C级客户，减量中
        ActivityLog(customer_id=5, activity_type="call", content="了解客户近期发货量下滑原因：客户海外业务战略调整，部分转东南亚采购", created_by="张晓明", created_at=now()-datetime.timedelta(days=28)),
        ActivityLog(customer_id=5, activity_type="visit", content="拜访李经理，推介东南亚线+中东线方案，尝试匹配客户新供应链布局", created_by="张晓明", created_at=now()-datetime.timedelta(days=20)),
        ActivityLog(customer_id=5, activity_type="email", content="发送东南亚线试运方案：越南→美国FBA头程+沙特中东线报价", created_by="张晓明", created_at=now()-datetime.timedelta(days=7)),

        # 锐思科技 (客户6) — C级客户，培育中
        ActivityLog(customer_id=6, activity_type="call", content="与赵总沟通，了解其电子产品主要出口东南亚，目前找了几家货代比较", created_by="李强", created_at=now()-datetime.timedelta(days=18)),
        ActivityLog(customer_id=6, activity_type="meeting", content="面谈：客户对时效和追踪系统有较高要求，展示在线轨迹追踪功能获得认可", created_by="李强", created_at=now()-datetime.timedelta(days=8)),

        # 联达塑胶 (客户7) — D级客户，已流失
        ActivityLog(customer_id=7, activity_type="visit", content="拜访孙经理了解流失原因：主要竞争对手机报价低8%，已签约竞品年度合约", created_by="张晓明", created_at=now()-datetime.timedelta(days=25)),
        ActivityLog(customer_id=7, activity_type="call", content="最后一次挽留沟通：提供卡航特价方案+账期延长30天优惠，客户表示已有合约", created_by="张晓明", created_at=now()-datetime.timedelta(days=20)),
        ActivityLog(customer_id=7, activity_type="email", content="发送归档确认邮件，保留未来合作可能，每季度回访一次", created_by="张晓明", created_at=now()-datetime.timedelta(days=15)),
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
                  description="中欧班列因阿拉山口口岸拥堵，延误约3天", claim_amount=0,
                  status="resolved", resolution="已向客户说明不可抗力因素，客户表示理解"),
    ]
    db.add_all(complaints)
    db.commit()

    # ═══════════════════ 系统配置 (PRD: N/M/X/Y参数) ═══════════════════
    configs = SystemConfig.get_all_defaults()
    for key, (val, desc) in configs.items():
        db.add(SystemConfig(key=key, value=val, description=desc))
    db.commit()

    # ═══════════════════ 线索跟进记录 (PRD: 3.3) ═══════════════════
    follow_ups = [
        FollowUp(lead_id=1, status="意向强烈", content="陈总确认Q3发货计划：每月5-8个方，带电产品需美森渠道，报价已发",
                 image_urls='["/static/uploads/moment_chart5.jpg"]', next_follow_at=now() + datetime.timedelta(days=3), created_by="张晓明"),
        FollowUp(lead_id=1, status="初步沟通", content="电话沟通，了解客户主营品类和出货节奏，初步建立联系",
                 next_follow_at=now() - datetime.timedelta(days=3), created_by="张晓明"),
        FollowUp(lead_id=3, status="意向强烈", content="王芳表示每月小商品约15-20个方，需要中欧班列+卡航组合方案",
                 next_follow_at=now() + datetime.timedelta(days=1), created_by="李强"),
        FollowUp(lead_id=6, status="初步沟通", content="周董初步沟通大型设备运输需求，关注鹿特丹DDP条款和清关能力",
                 next_follow_at=now() + datetime.timedelta(days=2), created_by="张晓明"),
    ]
    db.add_all(follow_ups)
    db.commit()

    # ═══════════════════ 企业朋友圈 ═══════════════════
    IMG_BASE = "/static/uploads"
    moments_data = [
        Moment(
            user_id=1, type="SYSTEM_KPI",
            content="📊 5月团队战报：本周新签客户3家，运单量环比增长12%，美森线满载率92%！再接再厉！",
            media_urls=json.dumps([f"{IMG_BASE}/moment_chart5.jpg", f"{IMG_BASE}/moment_team2.jpg"]),
            visible_type="DEPT", visible_target=json.dumps([1]),
            created_at=now() - datetime.timedelta(hours=2),
        ),
        Moment(
            user_id=2, type="ACTIVITY",
            content="🎉 恭喜签约！思科达电子确认Q3美森快船月度包舱，预计月出货量500方以上，感谢客户信任！感受一下签约现场的激动时刻～🤝",
            media_urls=json.dumps([f"{IMG_BASE}/moment_sign8.jpg", f"{IMG_BASE}/moment_office1.jpg"]),
            visible_type="ALL", visible_target=None,
            link_client_id=1,
            created_at=now() - datetime.timedelta(hours=5),
        ),
        Moment(
            user_id=1, type="DAILY",
            content="今天拜访了富通国际，客户对新增的东南亚线很感兴趣。下周安排具体报价方案，争取Q3前锁定合作。附上拜访途中的风景～",
            media_urls=json.dumps([f"{IMG_BASE}/moment_office6.jpg"]),
            visible_type="ALL", visible_target=None,
            created_at=now() - datetime.timedelta(hours=8),
        ),
        Moment(
            user_id=3, type="ACTIVITY",
            content="🚢 盐田-鹿特丹线本周成功首航！感谢运营团队的全力配合，客户反馈时效满意度提升明显。来看看码头装柜的现场照片！",
            media_urls=json.dumps([f"{IMG_BASE}/moment_warehouse7.jpg", f"{IMG_BASE}/moment_cargo3.jpg"]),
            visible_type="DEPT", visible_target=json.dumps([2]),
            created_at=now() - datetime.timedelta(days=1),
        ),
        Moment(
            user_id=4, type="SYSTEM_KPI",
            content="📈 运营月报：5月整体准点率96.8%，异常率降至2.1%，客户投诉同比下降40%。继续保持！",
            media_urls=json.dumps([f"{IMG_BASE}/moment_chart5.jpg"]),
            visible_type="ALL", visible_target=None,
            created_at=now() - datetime.timedelta(days=1, hours=3),
        ),
        Moment(
            user_id=1, type="DAILY",
            content="今天学习了纷享销客ShareAI的新功能——AI销售总监可以自动生成客户洞察报告，对日常跟进很有帮助。推荐大家都试试！",
            visible_type="ALL", visible_target=None,
            created_at=now() - datetime.timedelta(days=2),
        ),
        Moment(
            user_id=2, type="DAILY",
            content="遇到一个有意思的案例：客户原本走空派，经过成本分析后改走中欧班列，运费节省40%，时效只慢3天。跨境物流方案优化真的很重要！",
            media_urls=json.dumps([f"{IMG_BASE}/moment_cargo3.jpg"]),
            visible_type="DEPT", visible_target=json.dumps([1]),
            created_at=now() - datetime.timedelta(days=3),
        ),
        Moment(
            user_id=3, type="ACTIVITY",
            content="🏆 本周销售冠军：李强！成功开发2家新客户，月度新增营收预估超80万。向他学习！团队开会时拍的合影～",
            media_urls=json.dumps([f"{IMG_BASE}/moment_team2.jpg", f"{IMG_BASE}/moment_meeting4.jpg", f"{IMG_BASE}/moment_office1.jpg"]),
            visible_type="ALL", visible_target=None,
            created_at=now() - datetime.timedelta(days=4),
        ),
    ]
    db.add_all(moments_data)
    db.flush()

    # 朋友圈互动（点赞 + 评论）
    interactions = [
        # KPI战报的互动
        MomentInteraction(moment_id=1, user_id=2, interact_type="LIKE"),
        MomentInteraction(moment_id=1, user_id=3, interact_type="LIKE"),
        MomentInteraction(moment_id=1, user_id=4, interact_type="LIKE"),
        MomentInteraction(moment_id=1, user_id=2, interact_type="COMMENT", comment_text="团队努力！继续加油💪"),
        MomentInteraction(moment_id=1, user_id=1, interact_type="COMMENT", comment_text="大家一起努力，争取6月再创新高！", reply_to_user_id=2),
        # 签约喜报的互动
        MomentInteraction(moment_id=2, user_id=1, interact_type="LIKE"),
        MomentInteraction(moment_id=2, user_id=3, interact_type="LIKE"),
        MomentInteraction(moment_id=2, user_id=4, interact_type="LIKE"),
        MomentInteraction(moment_id=2, user_id=1, interact_type="COMMENT", comment_text="恭喜陈总！思科达是我们标杆客户"),
        MomentInteraction(moment_id=2, user_id=3, interact_type="COMMENT", comment_text="太厉害了！向你学习"),
        # 日常分享互动
        MomentInteraction(moment_id=3, user_id=2, interact_type="LIKE"),
        MomentInteraction(moment_id=3, user_id=4, interact_type="LIKE"),
        MomentInteraction(moment_id=3, user_id=2, interact_type="COMMENT", comment_text="东南亚线确实是新增长点，一起推进"),
        # 首航喜报互动
        MomentInteraction(moment_id=4, user_id=1, interact_type="LIKE"),
        MomentInteraction(moment_id=4, user_id=4, interact_type="LIKE"),
        MomentInteraction(moment_id=4, user_id=1, interact_type="COMMENT", comment_text="祝贺运营团队！鹿特丹线一直是我们重点线路"),
        # 运营月报互动
        MomentInteraction(moment_id=5, user_id=1, interact_type="LIKE"),
        MomentInteraction(moment_id=5, user_id=2, interact_type="LIKE"),
        MomentInteraction(moment_id=5, user_id=3, interact_type="LIKE"),
        MomentInteraction(moment_id=5, user_id=1, interact_type="COMMENT", comment_text="数据说话的运营团队，赞👍"),
        # 日常分享互动
        MomentInteraction(moment_id=6, user_id=2, interact_type="LIKE"),
        MomentInteraction(moment_id=6, user_id=3, interact_type="LIKE"),
        MomentInteraction(moment_id=6, user_id=4, interact_type="COMMENT", comment_text="ShareAI确实好用，我也在学"),
        # 案例分享互动
        MomentInteraction(moment_id=7, user_id=1, interact_type="LIKE"),
        MomentInteraction(moment_id=7, user_id=3, interact_type="LIKE"),
        MomentInteraction(moment_id=7, user_id=1, interact_type="COMMENT", comment_text="方案优化是销售的基本功，值得分享"),
        # 销冠喜报互动
        MomentInteraction(moment_id=8, user_id=1, interact_type="LIKE"),
        MomentInteraction(moment_id=8, user_id=2, interact_type="LIKE"),
        MomentInteraction(moment_id=8, user_id=4, interact_type="LIKE"),
        MomentInteraction(moment_id=8, user_id=2, interact_type="COMMENT", comment_text="向李强学习！"),
        MomentInteraction(moment_id=8, user_id=3, interact_type="COMMENT", comment_text="谢谢大家，继续努力！"),
    ]
    db.add_all(interactions)
    db.commit()

    # ═══════════════════ 跟进提醒种子数据 (PRD V1.1) ═══════════════════
    reminders_data = [
        # 开发中 - 预约提醒 (线索1 思科达 - 提前设置了下次跟进时间)
        FollowupReminder(lead_id=1, reminder_type="schedule",
                         content="预约跟进 - 陈总确认Q3发货计划：每月5-8个方，带电产品需美森渠道，报价已发",
                         remind_at=now() + datetime.timedelta(hours=2), created_by="张晓明"),
        # 开发中 - 未触达预警 (线索7 AmazonSeller-DE)
        FollowupReminder(lead_id=7, reminder_type="unreached",
                         content="【未触达预警】新线索[AmazonSeller-DE GmbH]已指派/新建超过24小时未触达，请及时跟进培育。",
                         remind_at=now(), created_by="系统"),
        # 开发中 - 长期未跟进 (线索4 锐思科技 公海变私海后超过14天)
        FollowupReminder(lead_id=4, reminder_type="long_idle",
                         content="【长期未跟进】线索[杭州锐思科技有限公司]已超过14天无销售动作，请尽快跟进。",
                         remind_at=now(), created_by="系统"),
        # 合作中 - 账期风控 (客户1 思科达 欠款35万 账龄25天)
        FollowupReminder(customer_id=1, reminder_type="credit_risk",
                         content="【风控红线预警】合作客户[深圳思科达电子有限公司]当前欠款35.0万，账龄已达25天，请及时催收或调整走货额度。",
                         remind_at=now(), created_by="系统"),
        # 已流失 - 挽回复盘 (客户7 联达 已流失超过14天未复盘)
        FollowupReminder(customer_id=7, reminder_type="churn_review",
                         content="【挽回提醒】客户[东莞联达塑胶制品有限公司]已流失14天，请及时录入流失主因，或尝试制定挽回方案。",
                         remind_at=now(), created_by="系统"),
    ]
    db.add_all(reminders_data)
    db.commit()

    print("✅ 演示数据已填充完成！")
    print(f"  线索: {len(leads)} 条 (含1条无效)")
    print(f"  客户: {len(customers)} 家 (覆盖7个生命周期阶段)")
    print(f"  商机: {len(opportunities)} 个")
    print(f"  报价单: {len(quotations)} 张")
    print(f"  运单: {len(orders)} 票")
    print(f"  轨迹事件: {len(tracking_events)} 条")
    print(f"  授信记录: {len(credits)} 条")
    print(f"  跟进记录: {len(activities)} 条 (含状态流转)")
    print(f"  投诉: {len(complaints)} 个")
    print(f"  朋友圈: {len(moments_data)} 条动态 + {len(interactions)} 条互动")
    print(f"  跟进提醒: {len(reminders_data)} 条")
    db.close()


if __name__ == "__main__":
    seed()
