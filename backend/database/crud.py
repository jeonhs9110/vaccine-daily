# crud.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, List, Optional, Sequence, Tuple, Dict

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import (
    Company,
    User,
    News,
    Report,
    Cluster,
    Category,
    NewsReaction,
    NewsView,
    SearchLog,
    KwStat,
    KwSub,
    cluster_news_link,
)


# -------------------------
# 작은 유틸
# -------------------------
def normalize_keyword(s: str) -> str:
    # 최소 정규화: 앞뒤 공백 제거 + 내부 연속 공백 1개로
    s = (s or "").strip()
    s = " ".join(s.split())
    return s


# -------------------------
# Company / Alias
# -------------------------
def get_company_by_id(db: Session, company_id: int) -> Optional[Company]:
    return db.get(Company, company_id)


def get_company_by_name(db: Session, name: str) -> Optional[Company]:
    name = (name or "").strip()
    return db.execute(select(Company).where(Company.name == name)).scalar_one_or_none()


def get_or_create_company_by_raw_name(
    db: Session,
    raw_company_name: str,
    display_name: Optional[str] = None,
) -> Company:
    """
    크롤러가 준 raw_company_name으로:
    1) Company.name으로 찾기
    2) 없으면 새로 생성
    """
    raw = (raw_company_name or "").strip()
    if not raw:
        raise ValueError("raw_company_name is empty")

    # 1) Company.name으로 찾기
    company = get_company_by_name(db, raw)
    if company:
        return company

    # 2) 새로 만들기
    company = Company(name=raw, display_name=display_name)
    db.add(company)
    db.flush()  # company.company_id 확보
    return company


# -------------------------
# News
# -------------------------
def create_news(
    db: Session,
    *,
    title: Optional[str],
    contents: Optional[str],
    url: str,
    company_id: int,
    is_domestic: bool = True,
    category: Optional[str] = None,  # 정치, 경제, 사회, 생활/문화, 세계, IT/과학, 오피니언
    img_urls: Optional[dict | list] = None,
    created_at: Optional[datetime] = None,
    is_opinion: bool = False,
    author: Optional[str] = None,
) -> Optional[News]:
    # Check if news with this URL already exists
    existing = get_news_by_url(db, url)
    if existing:
        return None  # Already exists, don't create

    # Category 처리: 문자열을 받아서 Category 테이블에서 찾거나 생성
    category_id = None
    if category:
        category_name = category.strip()
        cat = db.execute(select(Category).where(Category.name == category_name)).scalar_one_or_none()
        if not cat:
            cat = Category(name=category_name)
            db.add(cat)
            db.flush()
        category_id = cat.category_id

    obj = News(
        title=title,
        contents=contents,
        url=url,
        company_id=company_id,
        is_domestic=is_domestic,
        category_id=category_id,
        img_urls=img_urls,
        created_at=created_at or datetime.utcnow(),
        is_opinion=is_opinion,
        author=author,
    )
    db.add(obj)
    db.flush()
    return obj


def get_news_statistics(db: Session) -> dict:
    """
    News 통계 반환: 전체 개수 + 카테고리별 개수
    Returns:
        {
            "total": 100,
            "by_category": {
                "정치": 20,
                "경제": 30,
                ...
            }
        }
    """
    from sqlalchemy import func

    # 전체 개수
    total = db.query(func.count(News.news_id)).scalar()

    # 카테고리별 개수 (category_id, count)
    category_counts = db.query(News.category_id, func.count(News.news_id)).group_by(News.category_id).all()

    # category_id를 category name으로 변환
    by_category = {}
    for cat_id, count in category_counts:
        if cat_id:
            cat_name = get_category_name(db, cat_id)
            by_category[cat_name or f"ID:{cat_id}"] = count
        else:
            by_category["미분류"] = count

    return {"total": total, "by_category": by_category}


def get_news_by_url(db: Session, url: str) -> Optional[News]:
    return db.execute(select(News).where(News.url == url)).scalar_one_or_none()


def get_news(db: Session, news_id: int) -> Optional[News]:
    return db.get(News, news_id)


def get_recent_news(db: Session, since: datetime) -> List[News]:
    return db.query(News).filter(News.created_at >= since).all()


# -------------------------
# Cluster
# -------------------------
def create_cluster(db: Session, *, title: str) -> Cluster:
    obj = Cluster(title=title)
    db.add(obj)
    db.flush()
    return obj


def get_cluster(db: Session, cluster_id: int) -> Optional[Cluster]:
    return db.get(Cluster, cluster_id)


def add_news_to_cluster(db: Session, *, cluster_id: int, news_id: int) -> None:
    """
    M:N 연결 테이블(cluster_news_link)에 (cluster_id, news_id) 추가.
    """
    # 이미 있으면 아무 것도 안 함(중복 시 IntegrityError 회피)
    exists = db.execute(
        select(cluster_news_link.c.cluster_id).where(
            and_(
                cluster_news_link.c.cluster_id == cluster_id,
                cluster_news_link.c.news_id == news_id,
            )
        )
    ).first()
    if exists:
        return

    db.execute(cluster_news_link.insert().values(cluster_id=cluster_id, news_id=news_id))


def remove_news_from_cluster(db: Session, *, cluster_id: int, news_id: int) -> int:
    """
    삭제된 row 수 반환
    """
    res = db.execute(
        delete(cluster_news_link).where(
            and_(
                cluster_news_link.c.cluster_id == cluster_id,
                cluster_news_link.c.news_id == news_id,
            )
        )
    )
    return res.rowcount or 0


def get_original_news_details_by_cluster(db: Session, cluster_id: int, include_contents: bool = True) -> List[dict]:
    """
    cluster_id를 받아서 연결된 원본 기사들의 [제목, URL, 언론사명]을 반환합니다.
    include_contents=False: contents 제외 (메인 페이지용 경량 응답)
    """
    # 1. News, Company, cluster_news_link 3개를 조인(Join)합니다.
    columns = [
        News.news_id,
        News.title,
        News.url,
        Company.name.label("company_name"),
        News.img_urls,
        News.created_at,
    ]
    if include_contents:
        columns.append(News.contents)

    results = (
        db.query(*columns)
        .join(cluster_news_link, News.news_id == cluster_news_link.c.news_id)
        .join(Company, News.company_id == Company.company_id)
        .filter(cluster_news_link.c.cluster_id == cluster_id)
        .all()
    )

    # 2. 프론트엔드가 쓰기 편한 리스트 형태로 변환
    response = []
    for row in results:
        item = {
            "news_id": row.news_id,
            "title": row.title,
            "company_name": row.company_name,
            "url": row.url,
            "img_urls": row.img_urls,
            "created_at": row.created_at,
        }
        if include_contents:
            item["contents"] = row.contents
        response.append(item)
    return response


# -------------------------
# Report (prev. AiGeneratedNews)
# -------------------------
def create_report(
    db: Session,
    *,
    cluster_id: int,
    title: Optional[str],
    contents: Optional[str],
    keywords: Optional[list],
    analysis_result: Optional[dict],
    category_id: Optional[int] = None,
    created_at: Optional[datetime] = None,
) -> Report:
    obj = Report(
        cluster_id=cluster_id,
        category_id=category_id,
        title=title,
        contents=contents,
        keywords=keywords,
        analysis_result=analysis_result,
        created_at=created_at or datetime.utcnow(),
        like_count=0,
        dislike_count=0,
    )
    db.add(obj)
    db.flush()
    return obj


def get_report(db: Session, report_id: int) -> Optional[Report]:
    return db.get(Report, report_id)


def list_reports_by_cluster(db: Session, cluster_id: int, limit: int = 50) -> List[Report]:
    return list(
        db.execute(
            select(Report).where(Report.cluster_id == cluster_id).order_by(Report.created_at.desc()).limit(limit)
        ).scalars()
    )


def list_reports_by_category(db: Session, category_id: int, limit: int = 50) -> List[Report]:
    """
    특정 카테고리의 AI 생성 뉴스 목록 조회.
    """
    return list(
        db.execute(
            select(Report).where(Report.category_id == category_id).order_by(Report.created_at.desc()).limit(limit)
        ).scalars()
    )


def create_report_issue(
    db: Session, *, title: str, article_ids: List[int], category_id: Optional[int] = None
) -> Report:
    """
    clustering.py에서 사용하는 이슈 생성 함수.
    Cluster를 생성하고, Report와 News를 연결합니다.
    """
    # 1. Cluster 생성
    cluster = Cluster(title=title)
    db.add(cluster)
    db.flush()  # cluster.cluster_id 확보

    # 2. Report 생성
    issue = Report(cluster_id=cluster.cluster_id, category_id=category_id, title=title, created_at=datetime.utcnow())
    db.add(issue)
    db.flush()

    # 3. 기사 연결 (M:N 관계 테이블에 추가)
    if article_ids:
        # bulk insert for M:N
        # 이미 존재하는지 체크하지 않고 넣으면 중복 에러 가능성 있음
        # 하지만 새로 만든 클러스터라 비어있음이 보장됨.
        vals = [{"cluster_id": cluster.cluster_id, "news_id": nid} for nid in article_ids]
        db.execute(cluster_news_link.insert(), vals)
        db.flush()

    return issue


# -------------------------
# User
# -------------------------
def create_user(
    db: Session,
    *,
    login_id: str,
    password_hash: str,
    username: Optional[str] = None,
    email: Optional[str] = None,
    age_range: Optional[str] = None,
    gender: Optional[str] = None,
    # fcm_token removed
    # marketing_agree removed
    user_status: int = 1,
    subscribed_categories: Optional[List[str]] = None,
    subscribed_keywords: Optional[List[str]] = None,
) -> User:
    obj = User(
        login_id=login_id,
        password_hash=password_hash,
        username=username,
        email=email,
        age_range=age_range,
        gender=gender,
        # fcm_token removed
        # marketing_agree removed
        user_status=user_status,
        created_at=datetime.utcnow(),
    )
    db.add(obj)
    db.commit()  # To get obj.user_id

    # Handle Subscriptions
    if subscribed_categories:
        for cat_name in subscribed_categories:
            cat_name = cat_name.strip()
            if not cat_name:
                continue

            # Check if category exists, if not create it
            cat = db.execute(select(Category).where(Category.name == cat_name)).scalar_one_or_none()
            if not cat:
                cat = Category(name=cat_name)
                db.add(cat)
                db.flush()  # Ensure ID is generated and name persistence

            # Now append to user subscriptions
            # Avoid duplicates if user sends same category twice
            if cat not in obj.subscribed_categories:
                obj.subscribed_categories.append(cat)

    if subscribed_keywords:
        for keyword in subscribed_keywords:
            # Check for existing subscription to avoid duplicates handled by unique constraint or add logic
            # Since it's a new user, we can just add.
            # But safer to use the helper or just add manually.
            # Using normalize_keyword helper if available or just strip.
            # crud.py has normalize_keyword at top.
            normalized_kw = normalize_keyword(keyword)
            if normalized_kw:
                obj.keyword_subscriptions.append(KwSub(keyword=normalized_kw))

    if subscribed_categories or subscribed_keywords:
        db.commit()

    db.refresh(obj)  # 최신 상태로 갱신
    return obj


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def get_user_by_login_id(db: Session, login_id: str) -> Optional[User]:
    # print(f"[DEBUG] get_user_by_login_id called with login_id: '{login_id}'")  # 디버깅용
    result = db.execute(select(User).where(User.login_id == login_id)).scalar_one_or_none()
    # print(f"[DEBUG] Query result: {result}")  # 디버깅용
    return result


def get_user_by_name_and_email(db: Session, username: str, email: str) -> Optional[User]:
    return db.execute(select(User).where(and_(User.username == username, User.email == email))).scalar_one_or_none()


def delete_user_account(db: Session, *, user_id: int) -> bool:
    """
    사용자 계정을 완전히 삭제합니다.
    cascade delete로 관련된 모든 데이터도 함께 삭제됩니다:
    - UserKeywordReadStat
    - NewsView
    - NewsReaction
    - SearchLog
    - UserKeywordSubscription
    - user_category_subscriptions (M:N)

    Returns: True if user was deleted, False if user not found
    """
    user = db.get(User, user_id)
    if not user:
        return False

    db.delete(user)
    db.flush()
    return True


def update_user_subscriptions(
    db: Session, user: User, new_categories: Optional[List[str]], new_keywords: Optional[List[str]]
) -> None:
    """
    사용자의 구독 정보(카테고리, 키워드)를 완전히 교체(Replace)합니다.
    None이 들어오면 해당 항목은 건드리지 않고, 빈 리스트([])가 들어오면 모두 삭제합니다.
    """
    # 1. Categories
    if new_categories is not None:
        # 기존 구독 모두 해제 (관계만 끊김)
        user.subscribed_categories.clear()

        for cat_name in new_categories:
            cat_name = cat_name.strip()
            if not cat_name:
                continue

            # Find or Create
            cat = db.execute(select(Category).where(Category.name == cat_name)).scalar_one_or_none()
            if not cat:
                cat = Category(name=cat_name)
                db.add(cat)
                db.flush()

            if cat not in user.subscribed_categories:
                user.subscribed_categories.append(cat)

    # 2. Keywords
    if new_keywords is not None:
        # Validate keyword count (max 20)
        if len(new_keywords) > 20:
            raise ValueError("키워드는 최대 20개까지만 등록할 수 있습니다.")

        # Normalize new keywords
        normalized_new = set()
        for k in new_keywords:
            # Validate keyword length (max 60 bytes)
            if len(k.encode("utf-8")) > 60:
                raise ValueError(f"키워드 '{k}'는 60바이트를 초과합니다. 더 짧은 키워드를 사용해주세요.")

            n = normalize_keyword(k)
            if n:
                # Double-check normalized keyword length
                if len(n.encode("utf-8")) > 60:
                    raise ValueError(f"키워드 '{n}'는 60바이트를 초과합니다.")
                normalized_new.add(n)

        # Validate normalized keyword count (max 20)
        if len(normalized_new) > 20:
            raise ValueError("키워드는 최대 20개까지만 등록할 수 있습니다.")

        # Get existing keywords
        # user.keyword_subscriptions is a list of KwSub objects
        existing_map = {ks.keyword: ks for ks in user.keyword_subscriptions}
        existing_keys = set(existing_map.keys())

        # Determine what to remove and what to add
        to_remove = existing_keys - normalized_new
        to_add = normalized_new - existing_keys

        # Remove
        if to_remove:
            # We can modify the relationship list directly
            # Or delete via DB query if we want to be explicit, but manipulating the list is more ORM-idiomatic
            # However, modifying the list while iterating is dangerous.
            # Let's rebuild the list or use individual removes.
            # Safe way: keep only those NOT in to_remove
            user.keyword_subscriptions = [ks for ks in user.keyword_subscriptions if ks.keyword not in to_remove]

        # Add
        for kw in to_add:
            user.keyword_subscriptions.append(KwSub(keyword=kw))

    db.flush()


# -------------------------
# Search log
# -------------------------
def add_search_log(db: Session, *, user_id: int, query: str) -> SearchLog:
    obj = SearchLog(user_id=user_id, query=query, searched_at=datetime.utcnow())
    db.add(obj)
    db.flush()
    return obj


# -------------------------
# Views (AiGeneratedNews 기준)
# -------------------------
def add_view(
    db: Session,
    *,
    user_id: int,
    ai_news_id: int,
    unique_per_user: bool = True,
) -> None:
    """
    unique_per_user=True: (user_id, ai_news_id) 이미 있으면 업데이트만(또는 무시)
    unique_per_user=False: 볼 때마다 이벤트 row 추가
    """
    # [Fix] 카테고리 ID 조회
    report = db.get(Report, ai_news_id)
    cat_id = report.category_id if report else None

    if not unique_per_user:
        db.add(NewsView(user_id=user_id, news_id=ai_news_id, category_id=cat_id, viewed_at=datetime.utcnow()))
        db.flush()
        return

    # 이미 있으면 viewed_at만 갱신(원하면 갱신 없이 return 해도 됨)
    existing = db.execute(
        select(NewsView).where(and_(NewsView.user_id == user_id, NewsView.news_id == ai_news_id))
    ).scalar_one_or_none()

    if existing:
        existing.viewed_at = datetime.utcnow()
        # 카테고리가 누락된 경우 업데이트
        if existing.category_id is None and cat_id is not None:
            existing.category_id = cat_id
        db.flush()
        return

    try:
        db.add(NewsView(user_id=user_id, news_id=ai_news_id, category_id=cat_id, viewed_at=datetime.utcnow()))
        db.flush()
    except IntegrityError:
        db.rollback()
        # Race condition: already inserted by another request.
        # We can optionally update the existing one here, or just ignore since it's "viewed"
        pass


def has_viewed(db: Session, *, user_id: int, ai_news_id: int) -> bool:
    row = db.execute(
        select(NewsView.news_view_id).where(and_(NewsView.user_id == user_id, NewsView.news_id == ai_news_id)).limit(1)
    ).first()
    return row is not None


# -------------------------
# Reactions (AiGeneratedNews 기준)
# -------------------------
def set_reaction(
    db: Session,
    *,
    user_id: int,
    ai_news_id: int,
    value: int,  # 1 or -1
) -> Tuple[str, int, int]:
    """
    좋아요/싫어요 토글 로직 + AiGeneratedNews의 like_count/dislike_count 동기화.
    반환: (status, like_count, dislike_count)
      status:
        - "set"      : 새로 설정
        - "switched" : like<->dislike 변경
        - "cleared"  : 같은 값 재클릭으로 취소
    """
    if value not in (1, -1):
        raise ValueError("value must be 1 or -1")

    report = db.get(Report, ai_news_id)
    if not report:
        raise ValueError("Report not found")

    r = db.execute(
        select(NewsReaction).where(and_(NewsReaction.user_id == user_id, NewsReaction.news_id == ai_news_id))
    ).scalar_one_or_none()

    # 없으면 새로 생성
    if r is None:
        db.add(NewsReaction(user_id=user_id, news_id=ai_news_id, value=value))
        if value == 1:
            report.like_count += 1
        else:
            report.dislike_count += 1
        db.flush()
        return ("set", report.like_count, report.dislike_count)

    # 같은 값을 누르면 취소
    if r.value == value:
        db.delete(r)
        if value == 1 and report.like_count > 0:
            report.like_count -= 1
        if value == -1 and report.dislike_count > 0:
            report.dislike_count -= 1
        db.flush()
        return ("cleared", report.like_count, report.dislike_count)

    # 반대 값으로 변경
    old = r.value
    r.value = value

    if old == 1 and report.like_count > 0:
        report.like_count -= 1
    if old == -1 and report.dislike_count > 0:
        report.dislike_count -= 1

    if value == 1:
        report.like_count += 1
    else:
        report.dislike_count += 1

    db.flush()
    return ("switched", report.like_count, report.dislike_count)


def get_reaction(db: Session, *, user_id: int, ai_news_id: int) -> Optional[int]:
    r = db.execute(
        select(NewsReaction.value).where(and_(NewsReaction.user_id == user_id, NewsReaction.news_id == ai_news_id))
    ).scalar_one_or_none()
    return r


def get_view_count(db: Session, *, news_id: int) -> int:
    """
    뉴스의 조회수 반환. (Report id)
    """
    return db.query(NewsView).filter(NewsView.news_id == news_id).count()


def get_reaction_counts(db: Session, *, news_id: int) -> Dict[str, int]:
    """
    뉴스의 like/dislike 수 반환.
    """
    """
    뉴스의 like/dislike 수 반환.
    """
    report = db.get(Report, news_id)
    if report:
        return {"likes": report.like_count, "dislikes": report.dislike_count}

    # Fallback if news not found or relying on table count (though ai table is source of truth now)
    likes = db.query(NewsReaction).filter(NewsReaction.news_id == news_id, NewsReaction.value == 1).count()
    dislikes = db.query(NewsReaction).filter(NewsReaction.news_id == news_id, NewsReaction.value == -1).count()
    return {"likes": likes, "dislikes": dislikes}


# -------------------------
# Category subscriptions
# -------------------------
def get_category_name(db: Session, category_id: int) -> Optional[str]:
    """
    category_id로 카테고리 이름 조회
    """
    cat = db.get(Category, category_id)
    return cat.name if cat else None


def subscribe_category(db: Session, *, user_id: int, category_id: int) -> None:
    user = db.get(User, user_id)
    cat = db.get(Category, category_id)
    if not user or not cat:
        raise ValueError("user or category not found")

    if cat not in user.subscribed_categories:
        user.subscribed_categories.append(cat)
        db.flush()


def unsubscribe_category(db: Session, *, user_id: int, category_id: int) -> None:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("user not found")
    user.subscribed_categories = [c for c in user.subscribed_categories if c.category_id != category_id]
    db.flush()


def list_subscribed_categories(db: Session, *, user_id: int) -> List[Category]:
    user = db.get(User, user_id)
    if not user:
        return []
    return list(user.subscribed_categories)


# -------------------------
# Keyword subscriptions (문자열)
# -------------------------
def subscribe_keyword(db: Session, *, user_id: int, keyword: str) -> None:
    keyword = normalize_keyword(keyword)
    if not keyword:
        raise ValueError("keyword is empty")

    if not keyword:
        raise ValueError("keyword is empty")

    existing = db.get(KwSub, {"user_id": user_id, "keyword": keyword})
    if existing:
        return

    db.add(KwSub(user_id=user_id, keyword=keyword))
    db.flush()


def unsubscribe_keyword(db: Session, *, user_id: int, keyword: str) -> int:
    keyword = normalize_keyword(keyword)
    if not keyword:
        return 0

    res = db.execute(delete(KwSub).where(and_(KwSub.user_id == user_id, KwSub.keyword == keyword)))
    return res.rowcount or 0


def list_subscribed_keywords(db: Session, *, user_id: int) -> List[str]:
    return list(db.execute(select(KwSub.keyword).where(KwSub.user_id == user_id)).scalars())


# -------------------------
# KwStat (읽은 기사 기반)
# -------------------------
def bump_user_keyword_stats_from_report(
    db: Session,
    *,
    user_id: int,
    report_id: int,
    inc: int = 1,
    keyword_limit: int = 200,
) -> int:
    """
    Report.keywords(JSON 배열)를 읽어서 KwStat(user_id, keyword) count를 +inc.
    반환: 업데이트된 키워드 개수

    keyword_limit: 한 기사에서 처리할 최대 키워드 수(폭주 방지)
    """
    report = db.get(Report, report_id)
    if not report:
        raise ValueError("Report not found")

    kws = report.keywords or []
    if not isinstance(kws, list):
        return 0

    updated = 0
    for raw_kw in kws[:keyword_limit]:
        # [Fix] 문자열 또는 딕셔너리({"text": "...", "value": ...}) 처리
        kw_str = None
        if isinstance(raw_kw, str):
            kw_str = raw_kw
        elif isinstance(raw_kw, dict) and "text" in raw_kw:
            kw_str = raw_kw["text"]

        if not kw_str:
            continue

        kw = normalize_keyword(kw_str)
        if not kw:
            continue

        stat = db.get(KwStat, {"user_id": user_id, "keyword": kw})
        if stat:
            stat.count += inc
            stat.read_at = datetime.utcnow()
        else:
            db.add(KwStat(user_id=user_id, keyword=kw, count=inc, read_at=datetime.utcnow()))
        updated += 1

    db.flush()
    return updated


def list_user_top_keywords(db: Session, *, user_id: int, limit: int = 1000) -> List[Tuple[str, int]]:
    rows = db.execute(
        select(KwStat.keyword, KwStat.count)
        .where(KwStat.user_id == user_id)
        .order_by(KwStat.count.desc(), KwStat.read_at.desc())
        .limit(limit)
    ).all()
    return [(r[0], r[1]) for r in rows]


def clear_user_keyword_stats(db: Session, *, user_id: int) -> int:
    """
    사용자의 모든 관심 키워드 통계를 삭제합니다.
    Returns: 삭제된 레코드 개수
    """
    count = db.query(KwStat).filter(KwStat.user_id == user_id).delete()
    db.flush()
    return count


# -------------------------
# Media Focus Analysis
# -------------------------
def get_media_focus_stats(db: Session, cluster_id: int) -> dict:
    """
    특정 이슈(Cluster)에 대해 각 언론사가 얼마나 집중하고 있는지 분석합니다.
    Focus Index = (해당 이슈 내 언론사 점유율) / (전체 뉴스 내 언론사 점유율)
    """
    # 1. 해당 클러스터의 언론사별 뉴스 개수 조회
    # (Cluster -> News -> Company)
    # 1. 해당 클러스터의 언론사별 뉴스 개수 조회
    # (Cluster -> News -> Company)
    cluster_counts = (
        db.query(Company.name, func.count(News.news_id))
        .join(News, News.company_id == Company.company_id)
        .join(cluster_news_link, News.news_id == cluster_news_link.c.news_id)
        .filter(cluster_news_link.c.cluster_id == cluster_id)
        .group_by(Company.name)
        .all()
    )
    # e.g., [('조선일보', 5), ('한겨레', 2), ...]

    if not cluster_counts:
        return {"media_focus": []}

    total_cluster_news = sum(count for _, count in cluster_counts)

    # [수정] 기준 시점(ref_date) 결정
    # 클러스터 내 뉴스들의 생성일 중 '중간값' 또는 '최신값'을 기준으로 잡아야
    # 과거 데이터(예: 2021년) 분석 시에도 2021년 당시의 전체 뉴스 분포와 비교할 수 있음.
    # 현재는 가장 간단하게 '뉴스 중 가장 늦은 날짜'를 기준으로 잡음.
    ref_date = datetime.now()
    
    # 클러스터 내 뉴스 날짜 조회
    news_dates = (
        db.query(News.created_at)
        .join(cluster_news_link, News.news_id == cluster_news_link.c.news_id)
        .filter(cluster_news_link.c.cluster_id == cluster_id)
        .all()
    )
    if news_dates:
        # news_dates는 [(datetime,), (datetime,), ...] 형태
        dates = [d[0] for d in news_dates if d[0]]
        if dates:
            ref_date = max(dates) # 가장 최신 기사 기준

    # 2. 전체 뉴스에서의 언론사별 점유율 조회 (Baseline)
    # 데이터가 오래된 경우(데모 환경)를 대비해 기간을 동적으로 확장
    from datetime import timedelta
    
    # 시도할 기간: 24시간 -> 3일 -> 7일 -> 30일 -> 전체
    time_windows = [24, 72, 168, 720] 
    
    global_counts = []
    total_global_news = 0
    used_window = "All Time"

    for hours in time_windows:
        # [수정] ref_date 기준으로 과거 N시간 조회
        since = ref_date - timedelta(hours=hours)
        # 미래 기사가 있을 수도 있으므로(데이터 오류 등), window는 [since ~ ref_date + 1day] 정도로 잡거나
        # 그냥 >= since 로 하되, 너무 먼 미래는 제외? -> 일단 >= since 만 해도 충분.
        
        # 주의: 비교 대상은 '전체 뉴스'여야 함 (특정 클러스터 아님)
        temp_counts = (
            db.query(Company.name, func.count(News.news_id))
            .join(News, News.company_id == Company.company_id)
            .filter(News.created_at >= since)
            # ref_date보다 너무 미래의 뉴스는 제외하는 게 맞음 (당시 시점 재현)
            # .filter(News.created_at <= ref_date + timedelta(days=1)) 
            .group_by(Company.name)
            .all()
        )
        temp_total = sum(count for _, count in temp_counts)
        
        if temp_total > 50: # 표본이 충분하면 채택
            global_counts = temp_counts
            total_global_news = temp_total
            used_window = f"{hours}h (from {ref_date.date()})"
            break
    
    # 여전히 부족하면 전체 기간 사용 (fallback)
    if total_global_news < 10:
        global_counts = (
            db.query(Company.name, func.count(News.news_id))
            .join(News, News.company_id == Company.company_id)
            .group_by(Company.name)
            .all()
        )
        total_global_news = sum(count for _, count in global_counts)
        used_window = "All Time (Fallback)"

    if total_global_news == 0:
        return {"media_focus": []}

    # 맵으로 변환
    global_map = {name: count for name, count in global_counts}

    # 3. Focus Percentage 계산 (보도 비중)
    # "이 언론사가 쓴 전체 기사 중, 이 이슈가 차지하는 비중"
    
    results = []
    
    # 전체 시장 평균 비중
    # (이 이슈 전체 기사 수 / 전체 언론사 전체 기사 수)
    market_avg_pct = 0
    if total_global_news > 0:
        market_avg_pct = (total_cluster_news / total_global_news) * 100

    for company_name, count in cluster_counts:
        # 해당 언론사의 전체 기사 수
        company_total = global_map.get(company_name, 0)
        
        # 데이터 정합성 보정 (크롤링 시차 등으로 인해 global에 없을 경우)
        if company_total < count:
            company_total = count
            
        if company_total == 0:
            focus_pct = 0
        else:
            focus_pct = (count / company_total) * 100
            
        # 신뢰도 필터: 기사 수가 너무 적은 언론사가 1개만 써도 100%가 되는 왜곡 방지
        # 예: 전체 기사가 5개 미만이면 패널티 or 제외? 
        # 일단 그대로 두되 UI에서 "기사 수"도 같이 보여주는게 좋음.

        results.append({
            "company": company_name,
            "focus_pct": round(focus_pct, 1),
            "issue_count": count,
            "total_count": company_total
        })

    # 비중이 높은 순으로 정렬
    results.sort(key=lambda x: x["focus_pct"], reverse=True)

    return {
        "media_focus": results,
        "market_avg_pct": round(market_avg_pct, 1)
    }


# -------------------------
# Feed helpers (예시)
# -------------------------
def list_reports_feed_for_user(
    db: Session,
    *,
    user_id: int,
    limit: int = 50,
    exclude_viewed: bool = True,
) -> List[Report]:
    """
    단순 예시: 최신 Report를 가져오되, exclude_viewed면 이미 본 것 제외.
    (추천/구독 기반 필터는 여기서 추가하면 됨)
    """
    stmt = select(Report).order_by(Report.created_at.desc()).limit(limit)

    if exclude_viewed:
        viewed_subq = select(NewsView.news_id).where(NewsView.user_id == user_id).scalar_subquery()
        stmt = stmt.where(Report.report_id.notin_(viewed_subq))

    return list(db.execute(stmt).scalars())


# -------------------------
# Search Log (검색 기록)
# -------------------------
def create_search_log(db: Session, *, user_id: int, query: str) -> SearchLog:
    """
    검색 기록 저장
    """
    log = SearchLog(user_id=user_id, query=query)
    db.add(log)
    db.flush()
    return log


def delete_search_log(db: Session, *, log_id: int) -> bool:
    """
    특정 검색 기록 삭제
    Returns: 삭제 성공 여부
    """
    log = db.get(SearchLog, log_id)
    if log:
        db.delete(log)
        db.flush()
        return True
    return False


def delete_user_search_logs(db: Session, *, user_id: int) -> int:
    """
    사용자의 모든 검색 기록 삭제
    Returns: 삭제된 개수
    """
    count = db.query(SearchLog).filter(SearchLog.user_id == user_id).delete()
    db.flush()
    return count


def get_user_search_logs(db: Session, *, user_id: int, limit: int = 20) -> List[SearchLog]:
    """
    사용자의 최근 검색 기록 조회
    """
    return db.query(SearchLog).filter(SearchLog.user_id == user_id).order_by(SearchLog.searched_at.desc()).limit(limit)


# -------------------------
# Image Helpers
# -------------------------
def get_representative_image(db: Session, cluster_id: int) -> Optional[str]:
    """
    클러스터에 포함된 뉴스 중 대표 이미지 URL을 하나 가져옵니다.
    """
    import random

    # News와 cluster_news_link 조인
    news_list = (
        db.query(News.img_urls)
        .join(cluster_news_link, News.news_id == cluster_news_link.c.news_id)
        .filter(cluster_news_link.c.cluster_id == cluster_id)
        .limit(10)
        .all()
    )

    candidates = []
    for row in news_list:
        imgs = row.img_urls
        if not imgs:
            continue

        if isinstance(imgs, list):
            candidates.extend([url for url in imgs if url])
        elif isinstance(imgs, dict):
            candidates.extend([v for v in imgs.values() if v])
        elif isinstance(imgs, str) and imgs.startswith("http"):
            candidates.append(imgs)

    if candidates:
        return random.choice(candidates)

    return None


# -------------------------
# Demographics (연령대/성별 통계)
# -------------------------
def get_report_demographics(db: Session, report_id: int) -> Dict[str, List[Dict[str, any]]]:
    """
    특정 기사(Report)를 조회한 사용자들의 연령대/성별 통계 집계
    
    Args:
        db: Database session
        report_id: Report ID
    
    Returns:
        {
            "age_distribution": [{"age": "10대", "count": 15}, ...],
            "gender_distribution": [{"gender": "남성", "count": 245}, ...]
        }
    """
    # 연령대별 집계
    age_results = (
        db.query(User.age_range, func.count(NewsView.news_view_id).label('count'))
        .join(NewsView, User.user_id == NewsView.user_id)
        .filter(NewsView.news_id == report_id)
        .filter(User.age_range.isnot(None))
        .group_by(User.age_range)
        .all()
    )
    
    # 성별 집계
    gender_results = (
        db.query(User.gender, func.count(NewsView.news_view_id).label('count'))
        .join(NewsView, User.user_id == NewsView.user_id)
        .filter(NewsView.news_id == report_id)
        .filter(User.gender.isnot(None))
        .group_by(User.gender)
        .all()
    )
    
    # 연령대 순서 정의 (10대, 20대, 30대, 40대, 50대, 60대+)
    age_order = ["10대", "20대", "30대", "40대", "50대", "60대+"]
    age_map = {row.age_range: row.count for row in age_results}
    
    # 순서대로 정렬 (없는 연령대는 제외)
    age_distribution = []
    for age in age_order:
        if age in age_map:
            age_distribution.append({"age": age, "count": age_map[age]})
    
    # 성별 결과
    gender_distribution = [
        {"gender": row.gender, "count": row.count}
        for row in gender_results
    ]
    
    return {
        "age_distribution": age_distribution,
        "gender_distribution": gender_distribution
    }


TARGET_COMPANIES = ["조선", "KBS", "MBC", "SBS", "연합", "한겨레", "중앙", "경향", "한국", "JTBC"]


def get_opinions_for_report(db: Session, report_id: int, limit: int = 10) -> List[dict]:
    """
    Report의 클러스터에 배정된 오피니언/사설/칼럼 기사를 반환합니다.
    임베딩 유사도 기반으로 클러스터에 배정된 오피니언만 조회합니다.
    10개 주요 언론사로 제한합니다.
    """
    report = db.get(Report, report_id)
    if not report or not report.cluster:
        return []

    # 클러스터에 연결된 오피니언 기사만 필터
    opinions = [n for n in report.cluster.news if n.is_opinion]

    # 10개 주요 언론사 필터
    opinions = [
        o for o in opinions
        if o.company_name and any(c in o.company_name for c in TARGET_COMPANIES)
    ]

    # 최신순 정렬 후 limit 적용
    opinions.sort(key=lambda o: o.created_at or datetime.min, reverse=True)
    opinions = opinions[:limit]

    return [
        {
            "news_id": o.news_id,
            "title": o.title,
            "url": o.url,
            "contents": o.contents or "",
            "company_name": o.company_name,
            "author": o.author,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in opinions
    ]

