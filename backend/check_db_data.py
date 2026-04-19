import sys
import os
from database.engine import SessionLocal
from database.models import Report
import json

sys.path.append(os.getcwd())

def check_data():
    db = SessionLocal()
    try:
        report = db.get(Report, 91)
        if not report:
            print("Report 91 not found")
            return
            
        result = report.analysis_result
        if not result:
            print("No analysis_result")
            return
            
        bullets = result.get('media_comparison_bullets', [])
        print(json.dumps(bullets, indent=2, ensure_ascii=False))
        
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
