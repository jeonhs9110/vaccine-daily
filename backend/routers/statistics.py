"""
통계 관련 라우터
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from routers import get_db
from database.models import Report, Category
from database.crud import get_news_statistics, get_category_name

router = APIRouter(prefix="/statistics", tags=["Statistics"])


@router.get("/news")
def get_news_stats(db: Session = Depends(get_db)):
    """뉴스 통계 조회: 전체 개수 + 카테고리별 개수"""
    return get_news_statistics(db)


@router.get("/reports")
def get_report_stats(db: Session = Depends(get_db)):
    """AI 생성 리포트 통계 조회"""
    total = db.query(func.count(Report.report_id)).scalar()

    category_counts = (
        db.query(Report.category_id, func.count(Report.report_id))
        .group_by(Report.category_id)
        .all()
    )

    by_category = {}
    for cat_id, count in category_counts:
        if cat_id:
            cat_name = get_category_name(db, cat_id)
            by_category[cat_name or f"ID:{cat_id}"] = count
        else:
            by_category["미분류"] = count

    return {"total": total, "by_category": by_category}
