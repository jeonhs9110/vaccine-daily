
import asyncio
from datetime import datetime, timedelta
from database.engine import SessionLocal
from scraper import crawl_news_by_period
from clustering import run_issue_clustering
from ai_processor import process_news_async_internal

def run_pipeline_for_date(target_date_str):
    print(f"\n🚀 [Pipeline Start] {target_date_str} -------------------------")
    db = SessionLocal()
    try:
        # 1. 수집 (하루치만)
        print(f"📰 1. 뉴스 수집")
        crawler_res = crawl_news_by_period(db, target_date_str, target_date_str, pages_per_day=5)
        print(f"   -> 수집된 기사: {len(crawler_res)}건")
        
        # 2. 클러스터링
        print(f"🧩 2. 이슈 클러스터링")
        target_date = datetime.strptime(target_date_str, "%Y%m%d")
        # 해당 날짜 기준 과거 3일치 기사를 묶어서 클러스터링 (이슈 생성)
        # ref_date를 해당 날짜의 23:59:59 로 설정하여 그 날까지의 기사를 다 포함하도록 함
        ref_date = target_date.replace(hour=23, minute=59, second=59)
        run_issue_clustering(db, days=3, ref_date=ref_date)
        
        # 3. AI 분석
        print(f"🧠 3. AI 분석 (비동기)")
        asyncio.run(process_news_async_internal())
        
    except Exception as e:
        print(f"❌ 파이프라인 오류 ({target_date_str}): {e}")
    finally:
        db.close()
    print(f"✅ [Pipeline End] {target_date_str} -------------------------")

def main():
    print("🔁 과거 데이터 전체 파이프라인 (수집 -> 클러스터링 -> 분석)")
    print("YYYYMMDD 형식으로 입력해주세요 (예: 20240101)")
    
    start_date = input("시작 날짜: ").strip()
    end_date = input("종료 날짜: ").strip()
    
    if len(start_date) != 8 or len(end_date) != 8:
        print("❌ 날짜 형식이 올바르지 않습니다.")
        return

    s_dt = datetime.strptime(start_date, "%Y%m%d")
    e_dt = datetime.strptime(end_date, "%Y%m%d")
    
    curr = s_dt
    while curr <= e_dt:
        t_str = curr.strftime("%Y%m%d")
        run_pipeline_for_date(t_str)
        curr += timedelta(days=1)
        
    print("\n🎉 모든 기간 처리가 완료되었습니다.")

if __name__ == "__main__":
    main()
