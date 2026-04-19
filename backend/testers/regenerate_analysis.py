import asyncio
import sys
import os
import json
from sqlalchemy.orm import Session

# Add backend directory to sys.path to ensure imports work if run from test dir
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Now we can import from backend modules
# Force correct DB path (backend/sql.db) when running from root
os.environ["DATABASE_URL"] = "sqlite:///backend/sql.db"

from database.engine import SessionLocal
import database.models as models
import database.models as models
import database.crud as crud
import ai_report_comparer


async def regenerate_analysis(news_id: int):
    db: Session = SessionLocal()
    try:
        # 1. Get Target AI News
        ai_news = db.query(models.Report).filter(models.Report.report_id == news_id).first()
        if not ai_news:
            print(f"[Error] AI News ID {news_id} not found.")
            return

        cluster_id = ai_news.cluster_id
        category_name = ai_news.category.name if ai_news.category else None
        print(f"[Info] Found Article {news_id}. Cluster ID: {cluster_id}, Category: {category_name}")

        # 2. Get Original News
        original_news_list = crud.get_original_news_details_by_cluster(db, cluster_id)
        if not original_news_list:
            print("[Error] No original news found for this cluster.")
            return

        print(f"[Info] Found {len(original_news_list)} original articles.")

        # 3. Prepare Data for Analysis
        # Ensure format matches what article_comparer expects (dictionaries)
        # crud returns dictionaries, so we are good.

        # 4. Run Analysis Pipeline
        print("[Info] Starting Analysis Pipeline...")

        # Step 1: Synthesize (Group by Company)
        synthesized_map = ai_report_comparer.get_synthesized_content_by_company(original_news_list)
        print(f"[Info] Grouped into {len(synthesized_map)} companies.")

        # Step 2: Map Phase (Analyze each company)
        print("[Info] Running Map Phase (Company Perspective Analysis)...")
        company_analyses = await ai_report_comparer.process_all_companies_async(
            synthesized_map, category_name=category_name
        )

        # Step 3: Reduce Phase (Compare)
        print("[Info] Running Reduce Phase (Final Comparison)...")
        final_report = await ai_report_comparer.generate_final_comparison_report(company_analyses)

        # 5. Update Database
        print("[Info] Updating Database...")

        # Only update analysis_result, keep other fields
        # final_report is a dict. SQLAlchemy needs it as JSON compatible.
        # usually stored as JSON type in DB.

        ai_news.analysis_result = final_report
        db.commit()
        db.refresh(ai_news)

        print(f"[Success] Updated Analysis Result for News ID {news_id}")
        print("=" * 60)
        print(json.dumps(final_report, indent=2, ensure_ascii=False))
        print("=" * 60)

    except Exception as e:
        print(f"[Error] {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python regenerate_analysis.py <news_id>")
        sys.exit(1)

    target_id = int(sys.argv[1])
    asyncio.run(regenerate_analysis(target_id))
