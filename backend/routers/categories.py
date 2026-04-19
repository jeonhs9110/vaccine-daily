"""
카테고리 관련 라우터
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from routers import get_db
from database.models import Category

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    """모든 카테고리 목록 조회"""
    categories = db.query(Category).all()
    return [{"category_id": cat.category_id, "name": cat.name} for cat in categories]
