"""
통합 검색 라우터
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from routers import get_db
from search_agent import (
    search_issues_by_keyword,
    search_hot_topics_by_keyword,
    search_articles_by_keyword,
)

router = APIRouter(prefix="/api", tags=["Search"])


@router.get("/comprehensive-search")
def comprehensive_search(keyword: str = Query(..., min_length=1, description="검색어"), db: Session = Depends(get_db)):
    """
    통합 검색 API: AI 요약, 핫토픽, 관련 기사를 한 번에 반환합니다.

    Returns:
        keyword (str): 검색 키워드
        ai_summaries (list): AI가 요약한 관련 이슈 목록
        hot_topics (list): 이미지가 포함된 실시간 핫토픽 기사 목록
        articles (list): 이미지 여부와 무관한 최신 관련 기사 목록 (Related News용)
    """

    # 1. AI 이슈 요약 검색 (DB: Issue)
    ai_summaries = search_issues_by_keyword(db, keyword)

    # 2. 핫토픽 검색 (DB: Article, 이미지 포함 & 조회수/최신순)
    hot_topics = search_hot_topics_by_keyword(db, keyword)

    # 3. 관련 기사 검색 (DB: Article, 최신순)
    articles = search_articles_by_keyword(db, keyword)

    return {
        "keyword": keyword,
        "ai_summaries": ai_summaries,
        "hot_topics": hot_topics,
        "articles": articles,
    }
