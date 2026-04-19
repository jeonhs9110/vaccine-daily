"""
반응 및 조회 관련 라우터
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from routers import get_db
from database.models import NewsReaction, NewsView, Report
from database.crud import get_user_by_login_id

router = APIRouter(tags=["Reactions"])


@router.post("/news/{news_id}/reaction")
def add_news_reaction(
    news_id: int,
    value: int = Query(..., description="1 for like, -1 for dislike"),
    login_id: str = Query(..., description="User Login ID"),
    db: Session = Depends(get_db),
):
    """
    뉴스에 반응 추가.
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 뉴스 존재 확인
    news = db.query(Report).filter(Report.report_id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")

    try:
        # 기존 반응 찾기
        reaction = (
            db.query(NewsReaction).filter(NewsReaction.user_id == user.user_id, NewsReaction.news_id == news_id).first()
        )

        if reaction:
            if reaction.value == value:
                # 같은 반응 -> 취소
                db.delete(reaction)
                status_msg = "removed"
            else:
                # 다른 반응 -> 변경
                reaction.value = value
                status_msg = "changed"
        else:
            # 새 반응 추가
            reaction = NewsReaction(user_id=user.user_id, news_id=news_id, value=value)
            db.add(reaction)
            status_msg = "added"

        # 반응 변경사항을 flush하여 DB에 반영 (commit 전)
        db.flush()

        # 업데이트된 like/dislike 개수 계산
        likes = db.query(NewsReaction).filter(NewsReaction.news_id == news_id, NewsReaction.value == 1).count()
        dislikes = db.query(NewsReaction).filter(NewsReaction.news_id == news_id, NewsReaction.value == -1).count()

        # Report 테이블의 캐시 컬럼 업데이트
        news.like_count = likes
        news.dislike_count = dislikes
        
        # 모든 변경사항을 한 번에 커밋
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal Server Error")

    return {"message": "Reaction updated", "status": status_msg, "likes": likes, "dislikes": dislikes}


@router.post("/news/{news_id}/view")
def record_news_view(
    news_id: int,
    login_id: str = Query(..., description="User Login ID"),
    db: Session = Depends(get_db),
):
    """
    뉴스 조회 기록.
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 조회 기록 추가
    # [수정] NewsView에 category_id도 함께 저장 (통계용)
    news_item = db.query(Report).filter(Report.report_id == news_id).first()
    category_id = news_item.category_id if news_item else None

    view = NewsView(user_id=user.user_id, news_id=news_id, category_id=category_id)
    db.add(view)
    db.commit()

    return {"message": "View recorded"}
