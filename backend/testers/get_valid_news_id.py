from sqlalchemy.orm import Session
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.engine import SessionLocal
from database.models import Report


def get_valid_id():
    db: Session = SessionLocal()
    try:
        # Fetch the most recent report
        report = db.query(Report).order_by(Report.report_id.desc()).first()
        if report:
            print(f"Valid Report ID: {report.report_id}")
            print(f"Cluster ID: {report.cluster_id}")
            if report.category:
                print(f"Category: {report.category.name}")
            else:
                print("Category: None")
        else:
            print("No reports found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    get_valid_id()
