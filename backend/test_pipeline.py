"""
최근 10분 동안의 기사를 수집하고 전체 파이프라인을 테스트하는 스크립트
"""
import sys
import io
import os

# Windows 콘솔에서 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 로컬 테스트를 위해 ChromaDB 모드를 로컬로 설정 (import 전에 설정!)
os.environ["CHROMA_MODE"] = "local"
print(f"[DEBUG] CHROMA_MODE set to: {os.getenv('CHROMA_MODE')}")

# .env 파일 로드하되, 이미 설정된 환경 변수는 덮어쓰지 않음
from dotenv import load_dotenv
load_dotenv(override=False)
print(f"[DEBUG] After dotenv, CHROMA_MODE: {os.getenv('CHROMA_MODE')}")

import asyncio
from datetime import datetime
from database.engine import SessionLocal
from database.crud import create_news, get_or_create_company_by_raw_name
from scraper import run_article_crawler, run_opinion_crawler
from clustering import run_issue_clustering
from ai_processor import process_news_async_internal

TARGET_COMPANIES = [
    "조선", "KBS", "MBC", "SBS", "연합",
    "한겨레", "중앙", "경향", "한국", "JTBC",
]

def main():
    print("=" * 80)
    print("[TEST] 전체 파이프라인 테스트 시작")
    print("=" * 80)

    db = SessionLocal()

    try:
        # Step 1: 최근 기사 수집
        print("\n[Step 1] 최근 기사 수집 중...")
        news_list = run_article_crawler(db, target_companies=TARGET_COMPANIES)
        print(f"   수집된 기사: {len(news_list)}개")

        # Step 2: DB에 저장
        print("\n[Step 2] DB 저장 중...")
        saved_count = 0
        for news in news_list:
            try:
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
                saved_count += 1
            except Exception as e:
                print(f"   [WARNING] 저장 실패: {news['title'][:30]}... - {e}")

        db.commit()
        print(f"   저장된 기사: {saved_count}개")

        # Step 3: 오피니언 수집
        print("\n[Step 3] 오피니언 수집 중...")
        opinion_list = run_opinion_crawler(db, target_companies=TARGET_COMPANIES)
        print(f"   수집된 오피니언: {len(opinion_list)}개")

        # Step 4: 오피니언 저장
        print("\n[Step 4] 오피니언 저장 중...")
        opinion_saved = 0
        for opinion in opinion_list:
            try:
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
                opinion_saved += 1
            except Exception as e:
                print(f"   [WARNING] 저장 실패: {opinion['title'][:30]}... - {e}")

        db.commit()
        print(f"   저장된 오피니언: {opinion_saved}개")

        # Step 5: 클러스터링
        print("\n[Step 5] 이슈 클러스터링 중...")
        run_issue_clustering(db, days=3)
        print(f"   클러스터링 완료")

        # Step 6: AI 분석
        print("\n[Step 6] AI 분석 시작...")
        asyncio.run(process_news_async_internal())
        print(f"   AI 분석 완료")

        # Step 7: 결과 확인
        print("\n[Step 7] 결과 확인...")
        from database.models import Report, Cluster

        # 최근 생성된 리포트 확인
        reports = db.query(Report).order_by(Report.created_at.desc()).limit(5).all()
        print(f"   최근 생성된 리포트: {len(reports)}개")
        for i, report in enumerate(reports, 1):
            print(f"      {i}. [{report.report_id}] {report.title}")
            print(f"         - 내용: {len(report.contents or '')}자")
            print(f"         - 키워드: {report.keywords}")
            print(f"         - 분석 결과: {'있음' if report.analysis_result else '없음'}")
            if report.analysis_result:
                # 분석 결과의 키 확인
                analysis_keys = list(report.analysis_result.keys()) if isinstance(report.analysis_result, dict) else []
                print(f"         - 분석 결과 키: {analysis_keys}")

        # 클러스터 확인
        clusters = db.query(Cluster).order_by(Cluster.created_at.desc()).limit(5).all()
        print(f"\n   최근 생성된 클러스터: {len(clusters)}개")
        for i, cluster in enumerate(clusters, 1):
            print(f"      {i}. [{cluster.cluster_id}] {cluster.cluster_name}")
            print(f"         - 뉴스 개수: {len(cluster.news or [])}개")

        print("\n" + "=" * 80)
        print("[SUCCESS] 전체 파이프라인 테스트 완료!")
        print("=" * 80)

    except Exception as e:
        print(f"\n[ERROR] 테스트 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
