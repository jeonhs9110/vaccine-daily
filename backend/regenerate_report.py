"""
리포트 AI 파이프라인 재실행 CLI 도구

사용법:
  python regenerate_report.py 91              # 단일 리포트
  python regenerate_report.py 79 91 49        # 여러 리포트
  python regenerate_report.py 80-90           # 범위 지정
  python regenerate_report.py --all           # 전체 리포트
  python regenerate_report.py 91 --only graph # 특정 단계만 (article, graph, keyword)

파이프라인:
  1. Agentic 기사 생성 (Writer -> Critic -> Editor)
  2. GraphRAG 비교분석 (news mode)
  3. GraphRAG 오피니언 분석 (opinion mode)
  4. 키워드 추출
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm.attributes import flag_modified
from dotenv import load_dotenv

load_dotenv(override=True)

from database.engine import SessionLocal
from database.models import Report
from ai_graph_comparer import compare_articles_with_graph
from ai_agentic_generator import generate_agentic_article as generate_balanced_article
from keyword_extractor import KeywordExtractor

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


async def regenerate_report(report_id: int, steps: set[str] = None):
    """
    특정 리포트에 대해 AI 파이프라인을 재실행합니다.

    steps: 실행할 단계 (None이면 전체)
      - "article": Agentic 기사 생성
      - "graph":   GraphRAG 비교분석 (news + opinion)
      - "keyword": 키워드 추출
    """
    if steps is None:
        steps = {"article", "graph", "keyword"}

    db = SessionLocal()
    kw_extractor = KeywordExtractor() if "keyword" in steps else None

    try:
        report = db.get(Report, report_id)
        if not report:
            print(f"[!] Report {report_id} not found")
            return False

        print(f"\n{'='*60}")
        print(f"Report #{report_id}: {report.title}")
        print(f"{'='*60}")

        cluster = report.cluster
        if not cluster or not cluster.news:
            print("[!] No cluster or no articles")
            return False

        all_articles = cluster.news
        news_articles = [a for a in all_articles if not a.is_opinion]
        opinion_articles = [a for a in all_articles if a.is_opinion]

        print(f"News: {len(news_articles)}, Opinion: {len(opinion_articles)}")

        if not news_articles:
            print("[!] No news articles, skip")
            return False

        articles_data = [
            {
                "news_id": a.news_id,
                "company_name": a.company_name,
                "title": a.title,
                "contents": a.contents,
                "time": a.created_at,
            }
            for a in news_articles
        ]

        summary_result = None

        # --- Step 1: Agentic 기사 생성 ---
        if "article" in steps:
            print("\n[1/4] Agentic article generation...")
            summary_result = generate_balanced_article(
                model_name=MODEL, cluster_topic=report.title, articles=articles_data
            )
            report.title = summary_result.get("title", report.title)
            report.contents = summary_result.get("contents", "")
            report.search_keyword = summary_result.get("search_keyword", "")
            print(f"  -> {report.title}")
        else:
            print("\n[1/4] Skip (article)")

        # --- Step 2: GraphRAG 비교분석 ---
        if "graph" in steps:
            print("\n[2/4] GraphRAG news comparison...")
            final_report = await compare_articles_with_graph(articles_data, mode="news")

            # Step 3: GraphRAG 오피니언
            if opinion_articles:
                print("\n[3/4] GraphRAG opinion analysis...")
                opinion_data = [
                    {
                        "news_id": a.news_id,
                        "company_name": a.company_name,
                        "title": a.title,
                        "contents": a.contents,
                    }
                    for a in opinion_articles
                ]
                opinion_report = await compare_articles_with_graph(opinion_data, mode="opinion")
                opinion_bullets = opinion_report.get("opinion_bullets", [])
                if opinion_bullets:
                    final_report["opinion_bullets"] = opinion_bullets
                    print(f"  -> {len(opinion_bullets)} opinion bullets")
            else:
                print("\n[3/4] No opinions, skip")

            report.analysis_result = final_report
            flag_modified(report, "analysis_result")

            bullets = final_report.get("media_comparison_bullets", [])
            print(f"  -> {len(bullets)} media comparison bullets")
        else:
            print("\n[2/4] Skip (graph)")
            print("[3/4] Skip (graph)")

        # --- Step 4: 키워드 추출 ---
        if "keyword" in steps:
            print("\n[4/4] Keyword extraction...")
            content = ""
            if summary_result:
                content = summary_result.get("contents", "")
            elif report.contents:
                content = report.contents

            try:
                extracted_kws = kw_extractor.process_content(
                    title=report.title, content=content
                )
                report.keywords = extracted_kws
                flag_modified(report, "keywords")
                top5 = [kw["text"] for kw in extracted_kws[:5]]
                print(f"  -> {len(extracted_kws)} keywords (top5: {', '.join(top5)})")
            except Exception as e:
                print(f"  -> Keyword extraction failed: {e}")
        else:
            print("\n[4/4] Skip (keyword)")

        db.commit()
        print(f"\nDone! Report #{report_id} saved.")
        return True

    except Exception as e:
        print(f"\n[ERROR] Report #{report_id}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def parse_report_ids(args: list[str]) -> list[int]:
    """인자를 파싱하여 리포트 ID 리스트를 반환합니다."""
    ids = []
    for arg in args:
        if "-" in arg and not arg.startswith("-"):
            start, end = arg.split("-", 1)
            ids.extend(range(int(start), int(end) + 1))
        else:
            ids.append(int(arg))
    return ids


async def main():
    parser = argparse.ArgumentParser(description="리포트 AI 파이프라인 재실행")
    parser.add_argument("reports", nargs="*", help="리포트 ID (예: 91, 79-91, 79 91 49)")
    parser.add_argument("--all", action="store_true", help="전체 리포트 재실행")
    parser.add_argument(
        "--only", nargs="+",
        choices=["article", "graph", "keyword"],
        help="특정 단계만 실행 (article, graph, keyword)"
    )

    args = parser.parse_args()

    steps = set(args.only) if args.only else None

    if args.all:
        db = SessionLocal()
        report_ids = [r.report_id for r in db.query(Report).all()]
        db.close()
        print(f"Total {len(report_ids)} reports to process")
    elif args.reports:
        report_ids = parse_report_ids(args.reports)
    else:
        parser.print_help()
        return

    success = 0
    fail = 0
    for rid in report_ids:
        ok = await regenerate_report(rid, steps)
        if ok:
            success += 1
        else:
            fail += 1

    print(f"\n{'='*60}")
    print(f"Complete: {success} success, {fail} fail (total {len(report_ids)})")


if __name__ == "__main__":
    asyncio.run(main())
