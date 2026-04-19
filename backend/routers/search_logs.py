"""
검색 기록 관련 라우터
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from routers import get_db
from database.models import SearchLog
from database.crud import (
    create_search_log,
    delete_search_log,
    delete_user_search_logs,
    get_user_search_logs,
    get_user_by_login_id,
)

router = APIRouter(prefix="/users/{login_id}/search-logs", tags=["Search Logs"])


@router.post("")
def create_user_search_log(
    login_id: str,
    query: str = Query(..., min_length=1, description="검색어"),
    db: Session = Depends(get_db),
):
    """사용자의 검색 기록 저장"""
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    log = create_search_log(db, user_id=user.user_id, query=query)
    db.commit()

    return {
        "message": "검색 기록이 저장되었습니다.",
        "search_log_id": log.search_log_id,
        "query": log.query,
        "searched_at": log.searched_at,
    }


@router.get("")
def get_user_search_history(
    login_id: str,
    limit: int = Query(20, ge=1, le=100, description="조회할 개수"),
    db: Session = Depends(get_db),
):
    """사용자의 최근 검색 기록 조회"""
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    logs = get_user_search_logs(db, user_id=user.user_id, limit=limit)

    return {
        "login_id": login_id,
        "count": len(logs),
        "logs": [
            {"search_log_id": log.search_log_id, "query": log.query, "searched_at": log.searched_at} for log in logs
        ],
    }


@router.delete("/{log_id}")
def delete_user_search_log(
    login_id: str,
    log_id: int,
    db: Session = Depends(get_db),
):
    """특정 검색 기록 삭제"""
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    log = db.query(SearchLog).filter(SearchLog.search_log_id == log_id, SearchLog.user_id == user.user_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="검색 기록을 찾을 수 없습니다.")

    success = delete_search_log(db, log_id=log_id)
    db.commit()

    if success:
        return {"message": "검색 기록이 삭제되었습니다."}
    else:
        raise HTTPException(status_code=404, detail="검색 기록을 찾을 수 없습니다.")


@router.delete("")
def delete_all_user_search_logs(
    login_id: str,
    db: Session = Depends(get_db),
):
    """사용자의 모든 검색 기록 삭제"""
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    count = delete_user_search_logs(db, user_id=user.user_id)
    db.commit()

    return {"message": f"{count}개의 검색 기록이 삭제되었습니다.", "deleted_count": count}
