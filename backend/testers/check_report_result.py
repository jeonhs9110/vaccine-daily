import sys
import os
import json

# Force correct DB path (backend/sql.db)
os.environ["DATABASE_URL"] = "sqlite:///backend/sql.db"

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.engine import SessionLocal
from database.models import Report


def check_report(news_id):
    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.report_id == news_id).first()
        if report and report.analysis_result:
            bullets = report.analysis_result.get("media_comparison_bullets", [])
            print(json.dumps(bullets, indent=2, ensure_ascii=False))
        else:
            print("Report or analysis not found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    check_report(51)
