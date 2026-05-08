"""跨境物流CRM系统 Demo — 启动入口"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.seed_data import seed
from backend.database import engine, Base

if __name__ == "__main__":
    import uvicorn
    print("🚢 跨境物流CRM系统 Demo 启动中...")
    print("   📦 初始化数据库 & 填充演示数据...")
    Base.metadata.create_all(bind=engine)
    seed()
    print("   🌐 访问 http://localhost:8000")
    print("   " + "="*50)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
