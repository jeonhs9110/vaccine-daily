"""
사용자 관련 라우터
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
import bcrypt

from routers import get_db
from database.crud import (
    create_user,
    get_user_by_login_id,
    update_user_subscriptions,
    add_view,
    bump_user_keyword_stats_from_report,
    list_user_top_keywords,
    clear_user_keyword_stats,
    delete_user_account,
    get_report,
    get_reaction,
    get_representative_image,
    get_user_by_name_and_email,
)
from schemas import (
    UserCreateRequest,
    UserLoginRequest,
    UserUpdate,
    UserDashboardResponse,
    ReportResponse,
    UserFindIdRequest,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("")  # response_model 제거
def signup(user: UserCreateRequest, db: Session = Depends(get_db)):
    """
    새 사용자 정보로 회원가입을 합니다. (중복 아이디 체크 포함)
    """
    existing_user = get_user_by_login_id(db, user.login_id)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 존재하는 아이디입니다.")

    hashed_pw = bcrypt.hashpw(user.password_hash.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_user = create_user(
        db,
        login_id=user.login_id,
        username=user.username,
        password_hash=hashed_pw,
        email=user.email,
        age_range=user.age_range,
        gender=user.gender,
        subscribed_categories=user.subscribed_categories,
        subscribed_keywords=user.subscribed_keywords,
    )
    # create_user 내부에서 commit/refresh 하므로 id확보됨

    # 응답 포맷 구성
    return {
        "user_id": new_user.user_id,
        "login_id": new_user.login_id,
        "username": new_user.username,
        "email": new_user.email,
        "user_status": new_user.user_status,
        "created_at": new_user.created_at,
        "subscribed_categories": [cat.name for cat in new_user.subscribed_categories],
        "subscribed_keywords": [kw.keyword for kw in new_user.keyword_subscriptions],
    }


@router.post("/find-id")
def find_id(req: UserFindIdRequest, db: Session = Depends(get_db)):
    """
    이름과 이메일로 아이디 찾기
    """
    user = get_user_by_name_and_email(db, req.username, req.email)
    if not user:
        raise HTTPException(status_code=404, detail="해당 정보와 일치하는 사용자를 찾을 수 없습니다.")

    return {"login_id": user.login_id}


@router.delete("/{login_id}/keywords/stats")
def clear_interest_keywords(login_id: str, db: Session = Depends(get_db)):
    """
    사용자의 모든 관심 키워드 통계 초기화
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    deleted_count = clear_user_keyword_stats(db, user_id=user.user_id)
    db.commit()

    return {"message": "Keywords cleared", "deleted_count": deleted_count}


@router.delete("/{login_id}")
def delete_user_account_endpoint(login_id: str, db: Session = Depends(get_db)):
    """
    사용자 계정 완전 삭제 (회원탈퇴)
    모든 관련 데이터도 함께 삭제됩니다.
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    success = delete_user_account(db, user_id=user.user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete account")

    db.commit()

    return {"message": "Account deleted successfully"}


@router.get("/{login_id}/reactions/{news_id}")
def get_user_reaction(login_id: str, news_id: int, db: Session = Depends(get_db)):
    """
    사용자의 특정 기사에 대한 좋아요/싫어요 상태 조회
    Returns: {"value": 1 or -1 or null}
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reaction_value = get_reaction(db, user_id=user.user_id, ai_news_id=news_id)

    return {"value": reaction_value}


@router.get("/{login_id}")  # response_model 제거
def read_user(login_id: str, db: Session = Depends(get_db)):
    """
    특정 사용자 ID의 정보를 가져옵니다.
    """
    user = get_user_by_login_id(db, login_id)

    if user is None:
        raise HTTPException(status_code=404, detail="해당 아이디의 유저를 찾을 수 없습니다.")

    subscribed_categories = [cat.name for cat in user.subscribed_categories]
    subscribed_keywords = [kw.keyword for kw in user.keyword_subscriptions]

    return {
        "user_id": user.user_id,
        "login_id": user.login_id,
        "username": user.username,
        "email": user.email,
        "age_range": user.age_range,
        "gender": user.gender,
        "subscribed_categories": subscribed_categories,
        "subscribed_keywords": subscribed_keywords,
        "scraps": user.scraps or [],
    }


@router.put("/{login_id}")
def update_user(login_id: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    """
    사용자 정보 업데이트
    """
    user = get_user_by_login_id(db, login_id)

    if not user:
        raise HTTPException(status_code=404, detail="해당 아이디의 유저를 찾을 수 없습니다.")

    update_data = user_update.model_dump(exclude_unset=True)
    excluded_fields = {"subscribed_categories", "subscribed_keywords"}

    for key, value in update_data.items():
        if key in excluded_fields:
            continue
        elif key == "password":
            user.password_hash = bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        else:
            setattr(user, key, value)

    if user_update.subscribed_categories is not None or user_update.subscribed_keywords is not None:
        try:
            update_user_subscriptions(db, user, user_update.subscribed_categories, user_update.subscribed_keywords)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="DB 업데이트 실패")

    return {"message": f"'{login_id}'님의 정보가 수정되었습니다."}


@router.post("/{login_id}/read/{news_id}")
def record_article_read(login_id: str, news_id: int, db: Session = Depends(get_db)):
    """
    기사 읽음 처리:
    1. NewsView에 기록 (중복이면 시간 갱신)
    2. ai_generated_news에서 키워드 추출하여 UserKeywordReadStat 업데이트
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. View 기록
    # unique_per_user=True: 같은 기사를 여러 번 봐도 카운트는 1번만 오르거나, viewed_at만 갱신
    # 여기서는 "읽은 이력" 자체를 남기는 게 중요하므로 add_view 호출
    add_view(db, user_id=user.user_id, ai_news_id=news_id, unique_per_user=True)

    # 2. 키워드 가중치 업데이트
    # 기사 정보를 가져와서 키워드가 있다면 +1
    # 이미 본 기사라도 다시 읽으면 관심도가 올라간다고 가정할 수 있음.
    # 단, 너무 루프 도는 것을 방지하려면 has_viewed 체크를 할 수도 있으나,
    # 여기서는 "읽을 때마다 관심도 증가"로 구현.
    try:
        bump_user_keyword_stats_from_report(db, user_id=user.user_id, report_id=news_id, inc=1)
    except Exception as e:
        # 키워드 업데이트 실패해도 view는 기록
        print(f"[Warning] Keyword stats update failed: {e}")

    db.commit()
    return {"message": "Read recorded"}


@router.get("/{login_id}/dashboard", response_model=UserDashboardResponse)
def get_user_dashboard(login_id: str, db: Session = Depends(get_db)):
    """
    마이페이지 대시보드 데이터 조회
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Top Interest Keywords (상위 50개 - 개인화 점수 산정에 충분)
    top_kws_list = list_user_top_keywords(db, user_id=user.user_id, limit=50)
    read_keywords_map = {kw: count for kw, count in top_kws_list}

    # 2. Category Read Counts (JOIN으로 한 번에 조회 - N+1 제거)
    from sqlalchemy import func
    from database.models import NewsView, Category

    cat_counts = (
        db.query(Category.name, func.count(NewsView.news_view_id))
        .join(Category, NewsView.category_id == Category.category_id)
        .filter(NewsView.user_id == user.user_id)
        .filter(NewsView.category_id.isnot(None))
        .group_by(Category.name)
        .all()
    )

    read_categories_map = {name: count for name, count in cat_counts}

    # 3. Subscribed Keywords
    sub_kws = [k.keyword for k in user.keyword_subscriptions]

    return UserDashboardResponse(
        username=user.username,
        email=user.email,
        read_categories=read_categories_map,
        read_keywords=read_keywords_map,
        subscribed_keywords=sub_kws,
        scraps=user.scraps or [],
    )


from schemas import ScrapRequest


@router.post("/{login_id}/scraps")
def toggle_scrap(login_id: str, req: ScrapRequest, db: Session = Depends(get_db)):
    """
    스크랩 토글 (ID 또는 URL 추가/삭제)
    권장: report_id (int) 사용
    """
    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_scraps = list(user.scraps) if user.scraps else []

    # Identifier determined by request
    # If report_id is provided, use it (int). Else use url (str).
    target_item = req.report_id if req.report_id is not None else req.url

    if not target_item:
        raise HTTPException(status_code=400, detail="report_id or url required")

    # [Fix] Handle loose type matching (int vs str) for removal
    # We want to remove the item if it exists as either int or str
    found_index = -1
    for idx, s in enumerate(current_scraps):
        # Strict match or String conversion match
        if s == target_item or str(s) == str(target_item):
            found_index = idx
            break

    if found_index != -1:
        current_scraps.pop(found_index)
        action = "removed"
    else:
        current_scraps.append(target_item)
        action = "added"

    user.scraps = list(current_scraps)

    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(user, "scraps")

    db.commit()

    return {"message": f"Scrap {action}", "scraps": user.scraps}


@router.get("/{login_id}/liked-news", response_model=list[ReportResponse])
def get_user_liked_news(login_id: str, db: Session = Depends(get_db)):
    """
    사용자가 좋아요(1)를 누른 기사 목록 조회
    """
    from database.models import NewsReaction, Report

    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Join Report and NewsReaction
    # Filter by user_id AND value=1
    liked_reports = (
        db.query(Report)
        .join(NewsReaction, Report.report_id == NewsReaction.news_id)
        .filter(NewsReaction.user_id == user.user_id, NewsReaction.value == 1)
        .order_by(NewsReaction.news_reaction_id.desc())
        .all()
    )

    # Inject like count if needed, or Report already has it in cache col.

    # Inject category_name and image
    for r in liked_reports:
        if r.category:
            r.category_name = r.category.name
        else:
            r.category_name = None

        # Inject Image
        r.image = get_representative_image(db, r.cluster_id)

    return liked_reports


@router.get("/{login_id}/scrapped-news", response_model=list[ReportResponse])
def get_user_scrapped_news(login_id: str, db: Session = Depends(get_db)):
    """
    사용자가 스크랩한 기사 목록 조회
    report_id(int)로 저장된 스크랩만 조회 가능 (URL은 제외)
    """
    from database.models import Report

    user = get_user_by_login_id(db, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.scraps:
        return []

    # Filter only integer IDs from mixed list
    scrap_ids = [item for item in user.scraps if isinstance(item, int)]

    if not scrap_ids:
        return []

    # Fetch reports
    reports = (
        db.query(Report)
        .options(joinedload(Report.category))  # Optimization
        .filter(Report.report_id.in_(scrap_ids))
        .all()
    )

    # Sort by order in scraps list (lifo or fifo?) - DB `IN` doesn't preserve order.
    # To preserve 'recently scrapped first', we can reverse the list map.
    report_map = {r.report_id: r for r in reports}
    ordered_reports = []

    # Iterate scraps in reverse (LIFO)
    for sid in reversed(scrap_ids):
        if sid in report_map:
            r = report_map[sid]
            if r.category:
                r.category_name = r.category.name
            else:
                r.category_name = None

            # Inject Image
            r.image = get_representative_image(db, r.cluster_id)

            ordered_reports.append(r)

    return ordered_reports
