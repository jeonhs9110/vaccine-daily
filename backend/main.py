import asyncio
import concurrent.futures
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI

from database.engine import engine, SessionLocal
from database.models import Base, News
from scraper import run_article_crawler, run_opinion_crawler, crawl_news_by_period
from database.crud import (
    create_news,
    get_or_create_company_by_raw_name,
)
from ai_processor import process_news_pipeline, process_news_async_internal
from clustering import run_issue_clustering

TARGET_COMPANIES = [
    "조선", "KBS", "MBC", "SBS", "연합",
    "한겨레", "중앙", "경향", "한국", "JTBC",
]


# ---------------------------------------------------------
# 초기 시드: DB가 비어있을 때 1일치 데이터 수집 + AI 분석
# ---------------------------------------------------------
def run_initial_seed():
    """서버 최초 기동 시 DB가 비어있으면 1일치 뉴스를 수집하고 AI 분석을 실행한다."""
    print("=" * 60)
    print("🌱 [Initial Seed] DB가 비어있습니다. 1일치 데이터를 수집합니다.")
    print("=" * 60)

    today = datetime.now()

    for d in range(1, 0, -1):
        target = today - timedelta(days=d)
        target_str = target.strftime("%Y%m%d")

        print(f"\n🚀 [Seed] {target_str} 처리 중... (D-{d})")
        db = SessionLocal()
        try:
            # Step 1: 네이버 뉴스 크롤링 (해당 날짜)
            print(f"  📰 1. 뉴스 수집")
            result = crawl_news_by_period(db, target_str, target_str, pages_per_day=5)
            print(f"     -> {len(result)}건 수집")

            # Step 2: 클러스터링 (해당 날짜 기준 3일 윈도우)
            print(f"  🧩 2. 이슈 클러스터링")
            ref_date = target.replace(hour=23, minute=59, second=59)
            run_issue_clustering(db, days=3, ref_date=ref_date)

            # Step 3: AI 분석 (미분석 리포트 처리)
            print(f"  🧠 3. AI 분석")
            asyncio.run(process_news_async_internal())

        except Exception as e:
            print(f"  ❌ [Seed Error] {target_str}: {e}")
        finally:
            db.close()

        print(f"  ✅ {target_str} 완료")

    print("\n🎉 [Initial Seed] 1일치 데이터 시딩 완료!")
    print("=" * 60)


# ---------------------------------------------------------
# 실시간 사이클: 5분마다 최신 뉴스 수집 + 분석
# ---------------------------------------------------------
def run_realtime_cycle():
    """실시간 크롤링 사이클 1회 실행."""
    print("\n⏰ [Realtime] 뉴스 수집 및 분석 사이클 시작...")

    # --- Step 1: 기사 + 오피니언 동시 수집 (별도 DB 세션) ---
    news_list = []
    opinion_list = []

    def _crawl_articles():
        db = SessionLocal()
        try:
            return run_article_crawler(db, target_companies=TARGET_COMPANIES)
        finally:
            db.close()

    def _crawl_opinions():
        db = SessionLocal()
        try:
            return run_opinion_crawler(db, target_companies=TARGET_COMPANIES)
        finally:
            db.close()

    print("  🇰🇷📝 기사 + 오피니언 동시 수집 중...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_news = executor.submit(_crawl_articles)
        f_opinion = executor.submit(_crawl_opinions)
        news_list = f_news.result()
        opinion_list = f_opinion.result()

    # --- Step 2: 메인 스레드에서 DB 저장 ---
    db = SessionLocal()
    try:
        for news in news_list:
            company = get_or_create_company_by_raw_name(db, news["company_name"])
            create_news(
                db,
                title=news["title"],
                contents=news["contents"],
                url=news["url"],
                company_id=company.company_id,
                is_domestic=True,
                category=news.get("category"),
                img_urls=news.get("img_urls"),
                created_at=(
                    datetime.fromisoformat(news["time"])
                    if news["time"] != "시간 정보 없음"
                    else datetime.now()
                ),
            )
        db.commit()
        print(f"     -> 기사 {len(news_list)}건 저장")

        for opinion in opinion_list:
            company = get_or_create_company_by_raw_name(db, opinion["company_name"])
            create_news(
                db,
                title=opinion["title"],
                contents=opinion["contents"],
                url=opinion["url"],
                company_id=company.company_id,
                is_domestic=True,
                category="오피니언",
                img_urls=opinion.get("img_urls"),
                created_at=(
                    datetime.fromisoformat(opinion["time"])
                    if opinion["time"] != "시간 정보 없음"
                    else datetime.now()
                ),
                is_opinion=True,
                author=opinion.get("author"),
            )
        db.commit()
        print(f"     -> 오피니언 {len(opinion_list)}건 저장")

        # --- Step 3: 군집화 및 AI 분석 ---
        print("  🤖 군집화 및 AI 이슈 분석 중...")
        run_issue_clustering(db, days=3)
        process_news_pipeline()
        db.commit()

        print("  ✅ [Realtime] 사이클 완료")

    except Exception as e:
        print(f"  ❌ [Realtime Error] {e}")
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------
# 백그라운드 워커 메인
# ---------------------------------------------------------
def run_background_worker():
    print("🚀 [System] 백그라운드 워커 가동 시작")

    # 1회성: DB가 비어있으면 1일치 시드
    db = SessionLocal()
    news_count = db.query(News).count()
    db.close()

    if news_count == 0:
        run_initial_seed()
    else:
        print(f"📊 [System] DB에 {news_count}건의 뉴스가 존재합니다. 시드를 건너뜁니다.")

    # 실시간 루프
    while True:
        run_realtime_cycle()
        print("💤 [Sleep] 5분 대기 중...")
        time.sleep(300)


# --- [FastAPI 앱 설정] ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 앱 시작 시 DB 테이블 생성
    Base.metadata.create_all(bind=engine)

    # 백그라운드 스레드 시작
    worker_thread = threading.Thread(target=run_background_worker, daemon=True)
    worker_thread.start()

    yield
    print("👋 서버 종료")


app = FastAPI(lifespan=lifespan)

# --------------------------------------------------
#             프론트-백 FastAPI 연결
from fastapi.middleware.cors import CORSMiddleware

# 서버목록
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://172.30.1.92:3000",
    "http://168.107.51.224:3000",
    "http://43.203.207.47:3000",
]

import os
cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env else origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
from routers import (
    ai_news,
    news,
    users,
    auth,
    statistics,
    categories,
    search_logs,
    reactions,
    search,
)

app.include_router(ai_news.router)
app.include_router(news.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(statistics.router)
app.include_router(categories.router)
app.include_router(search_logs.router)
app.include_router(reactions.router)
app.include_router(search.router)


@app.get("/health")
def health_check():
    """서버 상태 확인용 엔드포인트"""
    return {"status": "ok"}


# DB 세션 의존성 (legacy support)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
