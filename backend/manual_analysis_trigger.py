import asyncio
import os
import sys
from sqlalchemy.orm import Session
from database.engine import SessionLocal
from database.models import Report
from ai_graph_comparer import compare_articles_with_graph

# Add current directory to path so imports work
sys.path.append(os.getcwd())

async def manual_analyze_latest_report():
    db = SessionLocal()
    try:
        # 1. Fetch Specific Report (ID 91)
        print("[INFO] Fetching report ID 91...")
        latest_report = db.query(Report).filter(Report.report_id == 91).first()
        
        if not latest_report:
            print("[ERROR] No reports found.")
            return

        print(f"[INFO] Found Report: ID {latest_report.report_id} - {latest_report.title}")
        
        cluster = latest_report.cluster
        if not cluster or not cluster.news:
            print("[ERROR] No cluster or news associated with this report.")
            return
            
        articles = cluster.news
        print(f"[INFO] Found {len(articles)} articles in cluster.")
        
        # 2. Prepare Data
        articles_data = []
        for art in articles:
            articles_data.append({
                "news_id": art.news_id,
                "company_name": art.company_name,
                "title": art.title,
                "contents": art.contents,
                "time": art.created_at,
            })
            
        # 3. Running Analysis
        print("[INFO] Running AI Graph Comparer...")
        final_report = await compare_articles_with_graph(articles_data)
        
        print("[INFO] Analysis Result:")
        import json
        print(json.dumps(final_report, ensure_ascii=False, indent=2))
        
        # 4. Update DB
        print("[INFO] Updating Report in Database...")
        # Merge existing analysis results if any, or overwrite? 
        # Since we changed the structure, let's overwrite or carefully merge.
        # But report.analysis_result is a JSON field.
        
        current_analysis = latest_report.analysis_result or {}
        
        # FORCE UPDATE: Clear first to ensure SQLAlchemy detects change
        latest_report.analysis_result = None
        db.commit()
        
        # Update media_comparison_bullets
        current_analysis['media_comparison_bullets'] = final_report.get('media_comparison_bullets', [])
        
        # Need to re-assign
        latest_report.analysis_result = dict(current_analysis)
        
        db.commit()
        print("[SUCCESS] Successfully updated DB.")
        
        # Immediate Verification
        db.refresh(latest_report)
        saved_data = latest_report.analysis_result.get('media_comparison_bullets', [])
        import json
        print(f"[VERIFY] Saved Data in DB ({len(saved_data)} items):")
        print(json.dumps(saved_data, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(manual_analyze_latest_report())
