"""
간단한 뉴스 수집 테스트 (클러스터링/AI 분석 제외)
"""
import sys
import io

# Windows 콘솔에서 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from datetime import datetime
from database.engine import SessionLocal
from database.crud import create_news, get_or_create_company_by_raw_name
from scraper import run_article_crawler, run_opinion_crawler

TARGET_COMPANIES = [
    "조선", "KBS", "MBC", "SBS", "연합",
    "한겨레", "중앙", "경향", "한국", "JTBC",
]

def main():
    print("=" * 80)
    print("[TEST] 뉴스 수집 테스트 시작")
    print("=" * 80)

    db = SessionLocal()

    try:
        # Step 1: 최근 기사 수집
        print("\n[Step 1] 최근 기사 수집 중...")
        news_list = run_article_crawler(db, target_companies=TARGET_COMPANIES)
        print(f"\n수집된 기사: {len(news_list)}개")

        if len(news_list) == 0:
            print("[WARNING] 수집된 기사가 없습니다. 뉴스가 최신이 아니거나 이미 DB에 저장되어 있을 수 있습니다.")
            return

        # 수집된 기사 목록 출력
        print("\n[수집된 기사 목록]")
        for i, news in enumerate(news_list[:10], 1):  # 최대 10개만 출력
            print(f"   {i}. [{news['company_name']}] {news['title'][:50]}...")
            print(f"      시간: {news['time']}")
            print(f"      카테고리: {news['category']}")
            print(f"      URL: {news['url'][:80]}...")
            print()

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
        print(f"저장된 기사: {saved_count}개")

        # Step 3: 오피니언 수집
        print("\n[Step 3] 오피니언 수집 중...")
        opinion_list = run_opinion_crawler(db, target_companies=TARGET_COMPANIES)
        print(f"수집된 오피니언: {len(opinion_list)}개")

        if len(opinion_list) > 0:
            print("\n[수집된 오피니언 목록]")
            for i, opinion in enumerate(opinion_list[:5], 1):
                print(f"   {i}. [{opinion['company_name']}] {opinion['title'][:50]}...")
                print(f"      저자: {opinion.get('author', 'N/A')}")
                print()

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
        print(f"저장된 오피니언: {opinion_saved}개")

        print("\n" + "=" * 80)
        print("[SUCCESS] 뉴스 수집 테스트 완료!")
        print(f"총 수집: 기사 {saved_count}개 + 오피니언 {opinion_saved}개")
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
