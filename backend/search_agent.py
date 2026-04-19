import os
from dotenv import load_dotenv

from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Dict, Any
from database.models import Report, News

# OpenAI Import
from openai import OpenAI

# Initialize OpenAI Client
# ------------------------------------

load_dotenv(override=True)

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Get model from environment variable, default to gpt-4o-mini
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ------------------------------------


def get_llm_summary(prompt: str) -> str:
    """
    OpenAI API를 사용하여 요약/분석을 생성합니다.
    """
    try:
        # OpenAI Chat Completions API 호출
        response = openai_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes and analyzes text in Korean accurately and concisely. Always answer in Korean.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=1000,
            temperature=0.7,
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"LLM Error: {e}")
        return "시스템 오류로 인해 AI 요약을 생성할 수 없습니다."


# 2. AI 요약(Issues) 검색 (Section 2)
def search_issues_by_keyword(db: Session, keyword: str) -> Dict[str, Any]:
    """
    DB AiGeneratedNews 테이블에서만 키워드가 포함된 이슈를 검색하고, LLM을 통해 분석합니다.
    (News 테이블은 참조하지 않음)
    """
    search_pattern = f"%{keyword}%"

    # Report 테이블 검색
    results = (
        db.query(Report)
        .filter(
            or_(
                Report.title.ilike(search_pattern),
                Report.contents.ilike(search_pattern),
            )
        )
        .order_by(Report.created_at.desc())
        .limit(30)
        .all()
    )

    issues_list = [
        {
            "report_id": issue.report_id,
            "title": issue.title,
            "contents": issue.contents,
            "created_at": issue.created_at,
        }
        for issue in results
    ]

    return {"analysis": None, "issues": issues_list}


def deduplicate_articles(articles: List[News], limit: int) -> List[News]:
    """
    기사 리스트에서 중복을 제거하고 대표 기사만 추려냅니다.
    1. issue_id가 있는 경우: 같은 이슈 그룹 중 가장 최신 기사 1개만 선택
    2. issue_id가 없는 경우: 그대로 유지 (단, 제목이 완전히 같다면 제거)
    """
    seen_ids = set()
    unique_articles = []

    # 제목 중복 방지용
    seen_titles = set()

    for art in articles:
        # 이미 충분한 수량이 모였으면 중단
        if len(unique_articles) >= limit:
            break

        # 1. 제목 완전 일치 중복 제거
        if art.title in seen_titles:
            continue
        seen_titles.add(art.title)

        # 2. 이슈 그룹 중복 제거
        if art.news_id in seen_ids:
            continue  # 이미 이 이슈의 기사가 하나 들어갔으므로 스킵
        seen_ids.add(art.news_id)

        # 통과한 기사 추가
        unique_articles.append(art)

    return unique_articles


# 3. 핫토픽(Articles) 검색 (Section 3)
def search_hot_topics_by_keyword(db: Session, keyword: str) -> List[Dict[str, Any]]:
    """
    DB News 테이블에서 키워드가 포함되고 이미지가 있는 기사를 검색합니다.
    """
    search_pattern = f"%{keyword}%"

    articles = (
        db.query(News)
        .filter(or_(News.title.ilike(search_pattern), News.contents.ilike(search_pattern)))
        .order_by(News.created_at.desc())
        .limit(100)
        .all()
    )

    # 중복 제거 로직 적용 (최대 10개)
    unique_articles = deduplicate_articles(articles, limit=10)

    hot_topics = []
    for art in unique_articles:
        if art.img_urls and len(art.img_urls) > 0:
            hot_topics.append(
                {
                    "news_id": art.news_id,
                    "title": art.title,
                    "img_urls": art.img_urls,
                    "url": art.url,
                    "company_name": art.company.name,
                }
            )

    return hot_topics


# 4. 일반 기사 검색 (Related News용) (Section 3)
def search_articles_by_keyword(db: Session, keyword: str) -> List[Dict[str, Any]]:
    """
    DB News 테이블에서 키워드가 포함된 기사를 검색합니다.
    """
    search_pattern = f"%{keyword}%"

    articles = (
        db.query(News)
        .filter(or_(News.title.ilike(search_pattern), News.contents.ilike(search_pattern)))
        .order_by(News.created_at.desc())  # time → created_at
        .limit(100)  # 필터링 위해 넉넉히
        .all()
    )

    # 중복 제거 로직 적용 (최대 20개)
    unique_articles = deduplicate_articles(articles, limit=20)

    return [
        {
            "news_id": art.news_id,
            "title": art.title,
            "url": art.url,
            "company_name": art.company_name,
            "view_count": 0,
        }
        for art in unique_articles
    ]
