"""
AI 생성 뉴스 관련 라우터
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc

from routers import get_db
from database.models import Report, Cluster
from database import crud
from ai_graph_comparer import compare_articles_with_graph

# schemas import 제거 - dict 반환으로 충분
from pydantic import BaseModel


class CitationRequest(BaseModel):
    cluster_id: int
    target_sentence: str


# -----------------------------------------------------------
# [Deep Citation Agent] Logic
# -----------------------------------------------------------
def split_sentences_positions(text: str):
    """
    텍스트를 문장 단위로 분리하고, 원본 텍스트 내의 위치(시작 인덱스 등)를 추적하거나
    최소한 '어느 문장이냐'를 리스트로 반환.
    여기서는 단순 split 후 strip 처리.
    """
    if not text:
        return []
    # 마침표, 물음표, 느낌표 뒤에 공백이 있는 경우 분리
    import re

    # 단순화된 정규식: 문장 종결 부호(.!?) 뒤에 공백 혹은 문자열 끝
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("")
def get_reports(
    skip: int = 0,
    limit: int = 10,
    category_id: Optional[int] = Query(None, description="카테고리 ID로 필터링"),
    db: Session = Depends(get_db),
):
    """
    AI가 생성한 리포트(뉴스)들을 가져옵니다.

    **skip**: 앞에서부터 건너뛸 데이터의 개수 (페이지 번호 구현 시 사용)<br/>
    **limit**: 한 번에 가져올 최대 데이터 개수 (페이지 당 목록 수)<br/>
    **category_id**: (선택) 특정 카테고리로 필터링<br/>
    """

    query = db.query(Report).options(joinedload(Report.category))

    # 본문이 없는(생성 중인) 리포트 제외
    query = query.filter(Report.contents != None, Report.contents != "")

    if category_id is not None:
        query = query.filter(Report.category_id == category_id)

    results = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()

    # 카테고리 이름 포함하여 반환
    response_data = []
    for item in results:
        # keywords가 JSON이면 string으로 변환
        keywords_value = item.keywords
        if isinstance(keywords_value, (dict, list)):
            import json

            keywords_value = json.dumps(keywords_value, ensure_ascii=False)

        item_dict = {
            "report_id": item.report_id,
            "cluster_id": item.cluster_id,
            "category_id": item.category_id,
            "category_name": item.category.name if item.category else None,
            "title": item.title,
            "contents": item.contents,
            "created_at": item.created_at,
            "analysis_result": item.analysis_result,
            "keywords": keywords_value,
            "like_count": item.like_count,
            "dislike_count": item.dislike_count,
        }
        response_data.append(item_dict)

    return response_data


@router.get("/search")
def search_reports(
    keyword: str = Query(..., min_length=1, description="검색어"),
    category_id: Optional[int] = Query(None, description="카테고리 ID로 필터링"),
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """
    AI가 생성한 리포트에서 '내용(contents)' 또는 '제목(title)'에 키워드가 포함된 리포트를 찾습니다.

    **keyword**: 검색할 키워드.<br/>
    **category_id**: (선택) 특정 카테고리로 필터링<br/>
    **skip**: 앞에서부터 건너뛸 데이터의 개수 (페이지 번호 구현 시 사용)<br/>
    **limit**: 한 번에 가져올 최대 데이터 개수 (페이지 당 목록 수)<br/>
    """

    search_pattern = f"%{keyword}%"

    query = (
        db.query(Report)
        .options(joinedload(Report.category))
        .filter(Report.contents != None, Report.contents != "")
        .filter(or_(Report.title.ilike(search_pattern), Report.contents.ilike(search_pattern)))
    )

    if category_id is not None:
        query = query.filter(Report.category_id == category_id)

    results = query.offset(skip).limit(limit).all()

    if results:
        response_data = []
        for item in results:
            # keywords가 JSON이면 string으로 변환
            keywords_value = item.keywords
            if isinstance(keywords_value, (dict, list)):
                import json

                keywords_value = json.dumps(keywords_value, ensure_ascii=False)

            item_dict = {
                "report_id": item.report_id,
                "cluster_id": item.cluster_id,
                "category_id": item.category_id,
                "category_name": item.category.name if item.category else None,
                "title": item.title,
                "contents": item.contents,
                "created_at": item.created_at,
                "analysis_result": item.analysis_result,
                "keywords": keywords_value,
                "like_count": item.like_count,
                "dislike_count": item.dislike_count,
            }
            response_data.append(item_dict)
        return response_data

    return []


@router.get("/{report_id}/demographics")
def get_report_demographics_endpoint(report_id: int, db: Session = Depends(get_db)):
    """
    특정 기사를 조회한 사용자들의 연령대/성별 통계를 반환합니다.
    
    Args:
        report_id: Report ID
        
    Returns:
        {
            "age_distribution": [{"age": "10대", "count": 15}, ...],
            "gender_distribution": [{"gender": "남성", "count": 245}, ...]
        }
    """
    # Report 존재 확인
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # 통계 조회
    result = crud.get_report_demographics(db, report_id)
    
    return result


@router.get("/{report_id}")
def get_report_detail(report_id: int, db: Session = Depends(get_db)):
    """
    AI가 생성한 리포트 중 특정 ID에 해당하는 리포트를 가져옵니다.

    **report_id**: AI가 생성한 리포트의 ID.
    """

    report = (
        db.query(Report)
        .options(joinedload(Report.cluster).joinedload(Cluster.news), joinedload(Report.category))
        .filter(Report.report_id == report_id)
        .first()
    )

    if not report:
        raise HTTPException(status_code=404, detail="해당 리포트를 찾을 수 없습니다.")

    # keywords가 JSON이면 string으로 변환
    keywords_value = report.keywords
    if isinstance(keywords_value, (dict, list)):
        import json

        keywords_value = json.dumps(keywords_value, ensure_ascii=False)

    return {
        "report_id": report.report_id,
        "cluster_id": report.cluster_id,
        "category_id": report.category_id,
        "category_name": report.category.name if report.category else None,
        "title": report.title,
        "contents": report.contents,
        "created_at": report.created_at,
        "analysis_result": report.analysis_result,
        "keywords": keywords_value,
        "like_count": report.like_count,
        "dislike_count": report.dislike_count,
        # "cluster": report.cluster, # 순환 참조 주의, 필요한 경우 serialize
    }


@router.get("/clusters/{cluster_id}/news")
def read_cluster_news(
    cluster_id: int,
    fields: Optional[str] = Query(None, description="반환할 필드 (예: 'light' = contents 제외)"),
    db: Session = Depends(get_db),
):
    """
    클러스터 ID를 받아서 연결된 원본 기사 목록(제목, URL, 언론사명)을 반환합니다.
    fields=light: contents 제외 (메인 페이지용 경량 응답)
    """
    original_news_list = crud.get_original_news_details_by_cluster(
        db, cluster_id, include_contents=(fields != "light")
    )

    return original_news_list


@router.post("/citation")
def check_citation(req: CitationRequest, db: Session = Depends(get_db)):
    """
    [Deep Citation Agent]
    특정 문장이 주어졌을 때, 해당 클러스터에 연결된 원본 기사들 중에서
    가장 유사한 문장(근거)을 찾아 반환합니다. (On-Demand Vector Search)
    반환값: 관련도(score)가 높은 순서대로 정렬된 '기사 목록'
    """
    from database.vector_store import encode_texts
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    # 1. 원본 기사 가져오기 (news_id, created_at 포함)
    original_news_list = crud.get_original_news_details_by_cluster(db, req.cluster_id)
    if not original_news_list:
        return {"match_found": False, "message": "원본 기사가 없습니다."}

    # 2. 모든 기사의 문장을 추출하여 후보군(Corpus) 생성
    candidates = []
    # candidates 구조: { "text": 문장, "doc_title": 기사제목, "company": 언론사, "url": 기사URL, "news_id": ID, ... }

    for news in original_news_list:
        sentences = split_sentences_positions(str(news["contents"]))
        for s in sentences:
            if len(s) < 10:
                continue  # 너무 짧은 문장은 제외
            candidates.append(
                {
                    "text": s,
                    "doc_title": news["title"],
                    "company": news["company_name"],
                    "url": news["url"],
                    "news_id": news.get("news_id"),  # crud 업데이트 필요
                    "created_at": news.get("created_at"),  # crud 업데이트 필요
                    "full_contents": news["contents"],
                }
            )

    if not candidates:
        return {"match_found": False, "message": "비교할 문장이 없습니다."}

    # 3. 임베딩 생성 (Target 1개 + Candidates N개)
    #    속도 최적화를 위해 한 번에 encoding
    all_texts = [req.target_sentence] + [c["text"] for c in candidates]

    # vector_store의 encode_texts 사용
    embeddings = encode_texts(all_texts)

    target_vec = embeddings[0].reshape(1, -1)
    candidate_vecs = embeddings[1:]

    # 4. 유사도 계산
    sim_scores = cosine_similarity(target_vec, candidate_vecs)[0]

    # 5. 기사별 최고 점수 집계 (Article-based Aggregation)
    article_scores = {}  # news_id -> { score, match_sentence, ... }

    for idx, score in enumerate(sim_scores):
        if score < 0.2:  # 노이즈 제거 (Threshold)
            continue

        cand = candidates[idx]
        nid = cand["news_id"]

        # 이미 저장된 기사보다 점수가 높으면 갱신
        if nid not in article_scores or score > article_scores[nid]["score"]:
            article_scores[nid] = {
                "score": score,
                "match_sentence": cand["text"],
                "news_id": nid,
                "title": cand["doc_title"],
                "company": cand["company"],
                "url": cand["url"],
                "created_at": cand["created_at"],
                "contents": cand["full_contents"],
            }

    # 6. 정렬 (점수 내림차순)
    sorted_articles = sorted(article_scores.values(), key=lambda x: x["score"], reverse=True)

    # 상위 5개만
    top_articles = sorted_articles[:5]

    results = []
    for art in top_articles:
        # 날짜 포맷
        date_str = ""
        if art["created_at"]:
            date_str = str(art["created_at"])

        results.append(
            {
                "id": art["news_id"],
                "score": round(float(art["score"]) * 100, 1),
                "match_text": art["match_sentence"],  # 가장 유사한 문장
                "company": art["company"],
                "title": art["title"],
                "url": art["url"],
                "date": date_str,
                "content": art["contents"],  # 전체 본문 (or 요약)
            }
        )

    return {"match_found": len(results) > 0, "matches": results}


@router.get("/{report_id}/related")
def get_related_reports(report_id: int, limit: int = 3, db: Session = Depends(get_db)):
    """
    특정 AI 리포트와 연관된(키워드가 유사한) 다른 AI 리포트들을 추천합니다.
    [Fallback Logic]
    1. Top 3 키워드를 모두 포함하는 리포트 검색
    2. 부족하면 Top 2 키워드를 모두 포함하는 리포트 검색
    3. 부족하면 Top 1 키워드를 포함하는 리포트 검색
    """
    # 1. 현재 리포트 조회
    current_report = db.get(Report, report_id)
    if not current_report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 2. 키워드 추출
    if not current_report.keywords:
        return []

    current_kws = current_report.keywords
    if isinstance(current_kws, str):
        import json

        try:
            current_kws = json.loads(current_kws)
        except:
            current_kws = []

    try:
        sorted_kws = sorted(current_kws, key=lambda x: x.get("value", 0), reverse=True)
        # 상위 3개 단어 텍스트 추출
        all_top_keywords = [k.get("text") for k in sorted_kws if k.get("text")]
    except Exception as e:
        print(f"Error parsing keywords: {e}")
        return []

    if not all_top_keywords:
        return []

    final_results = []
    excluded_ids = {report_id}  # 자기 자신 제외

    # 3. Tiered Search Strategy (3 keywords -> 2 keywords -> 1 keyword)
    # 최대 3개까지만 시도 (키워드가 적으면 그만큼만)
    max_k = min(len(all_top_keywords), 3)

    # 3부터 1까지 역순으로 시도 (예: 3, 2, 1)
    for k_count in range(max_k, 0, -1):
        if len(final_results) >= limit:
            break

        needed = limit - len(final_results)
        target_keywords = all_top_keywords[:k_count]

        # 쿼리 생성: (제목이나 내용에 k1 포함) AND (제목이나 내용에 k2 포함) ...
        # excluded_ids에 없는 것만
        query = db.query(Report).filter(Report.report_id.notin_(excluded_ids))

        # AND 조건 추가
        conditions = []
        for kw in target_keywords:
            pattern = f"%{kw}%"
            conditions.append(or_(Report.title.ilike(pattern), Report.contents.ilike(pattern)))

        if conditions:
            query = query.filter(and_(*conditions))

        # 최신순 정렬하여 필요한 만큼 가져오기
        tier_results = query.order_by(Report.created_at.desc()).limit(needed).all()

        for item in tier_results:
            final_results.append(item)
            excluded_ids.add(item.report_id)

    # 4. 결과 포맷팅
    response_data = []
    for item in final_results:
        # 이미지 URL 로드 logic (Lazy load)
        img_url = None
        if item.cluster and item.cluster.news:
            for origin_news in item.cluster.news:
                if origin_news.img_urls:
                    urls = origin_news.img_urls
                    if isinstance(urls, str):
                        import json

                        try:
                            urls = json.loads(urls)
                        except:
                            urls = []

                    if isinstance(urls, list) and len(urls) > 0:
                        img_url = urls[0]
                        break

        summary = item.contents[:40] + "..." if item.contents and len(item.contents) > 40 else item.contents

        response_data.append(
            {"id": item.report_id, "title": item.title, "image_url": img_url, "contents_short": summary}
        )

    return response_data


@router.get("/{report_id}/opinions")
async def get_report_opinions(report_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    특정 리포트와 관련된 오피니언/사설/칼럼을 구조화된 형태로 반환합니다.
    ai_processor에서 미리 생성한 캐시가 있으면 사용하고, 없으면 실시간 분석합니다.
    반환: [{"company", "hashtags", "summary", "evidence"}]
    """
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 1. 캐시된 분석결과 확인 (ai_processor에서 저장한 것)
    if report.analysis_result and isinstance(report.analysis_result, dict):
        cached = report.analysis_result.get("opinion_bullets")
        if cached:
            return cached

    # 2. 캐시가 없으면 클러스터에서 오피니언 조회 후 GraphRAG 실시간 분석
    opinions = crud.get_opinions_for_report(db, report_id, limit=limit)
    if not opinions:
        return []

    opinion_report = await compare_articles_with_graph(opinions, mode="opinion")
    return opinion_report.get("opinion_bullets", [])


@router.get("/{report_id}/timeline")
def get_report_timeline(report_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """
    특정 이슈와 관련된 과거의 이슈들을 시간순(오래된 순)으로 나열하여 반환합니다.
    (키워드 기반 연관 검색)
    """
    # 1. 현재 리포트
    current_report = db.get(Report, report_id)
    if not current_report:
        raise HTTPException(status_code=404, detail="Report not found")

    # 2. 키워드 추출
    if not current_report.keywords:
        return []

    current_kws = current_report.keywords
    if isinstance(current_kws, str):
        import json
        try:
            current_kws = json.loads(current_kws)
        except:
            current_kws = []

    # 상위 3개 키워드 추출
    try:
        sorted_kws = sorted(current_kws, key=lambda x: x.get("value", 0), reverse=True)
        top_keywords = [k.get("text") for k in sorted_kws if k.get("text")][:3]
    except:
        return []

    if not top_keywords:
        return []

    # 3. 과거 리포트 검색 (현재 리포트보다 이전에 생성된 것들)
    # 조건: (키워드 중 하나라도 포함) AND (현재 리포트 아님) AND (현재 리포트보다 과거)
    query = db.query(Report).filter(
        and_(
            Report.report_id != report_id,
            Report.created_at < current_report.created_at
        )
    )

    conditions = []
    for kw in top_keywords:
        pattern = f"%{kw}%"
        # 각 키워드가 제목이나 내용에 있어야 함
        conditions.append(or_(Report.title.ilike(pattern), Report.contents.ilike(pattern)))
    
    # [수정] 모든 키워드를 다 포함해야 함 (AND)
    if conditions:
        query = query.filter(and_(*conditions))

    # 4. 정렬 (오래된 순? 최신순? 타임라인이니까 오래된 순이 흐름 보기에 좋음)
    # 하지만 "가까운 과거"가 더 관련성 높을 수 있으니, 
    # 일단 최신순으로 가져와서 뒤집거나, 아니면 그냥 최신순으로 보여줄 수도 있음.
    # User Request: "어떻게 변해왔는지" -> Chronological order (Old -> New) preferable.
    # 하지만 DB 쿼리는 limit을 걸어야 하므로, "가장 최근의 연관 기사 N개"를 가져와서 날짜순 정렬하는 게 합리적.
    
    related_past = query.order_by(Report.created_at.desc()).limit(limit).all()
    
    # 시간순(과거->현재) 정렬
    related_past.sort(key=lambda x: x.created_at)

    results = []
    for item in related_past:
        results.append({
            "id": item.report_id,
            "date": item.created_at.strftime("%Y.%m.%d"),
            "time": item.created_at.strftime("%H:%M"),
            "title": item.title,
        })

    results.append({
        "id": current_report.report_id,
        "date": current_report.created_at.strftime("%Y.%m.%d"),
        "time": current_report.created_at.strftime("%H:%M"),
        "title": current_report.title,
        "is_current": True
    })

    return results


class ClaimEvidenceRequest(BaseModel):
    cluster_id: int
    claim_text: str
    target_media: List[str]  # e.g., ["조선일보", "한겨레"]


@router.post("/claim-evidence")
def check_claim_evidence(req: ClaimEvidenceRequest, db: Session = Depends(get_db)):
    """
    [Fact-Check Agent]
    비교분석 문장(Claim)과 대상 언론사들이 주어졌을 때,
    각 언론사의 실제 기사에서 해당 주장을 뒷받침하는 가장 유사한 '문단(Paragraph)'을 찾습니다.
    (사용자 요청: 문장보다는 문맥이 있는 문단 단위가 낫다)
    """
    from database.vector_store import encode_texts
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    # 정크 문장 필터 (구독, 제보, 저작권 등)
    def is_junk_sentence(text: str) -> bool:
        t = text.replace(" ", "")  # 공백 제거 후 확인
        junk_keywords = [
            "제보",
            "구독",
            "채널추가",
            "무단전재",
            "재배포금지",
            "Copyright",
            "Allrightsreserved",
            "이메일",
            "카카오톡",
            "전화",
            "기자",
            "http",
            "www",
        ]

        # 특정 키워드가 포함되어 있고, 문장 길이가 홍보성 멘트처럼 짧거나(100자 이하)
        # 키워드가 아주 명확한 경우
        count = 0
        for kw in junk_keywords:
            if kw in t:
                count += 1

        # 키워드가 2개 이상이면 매우 유력 (예: 제보+전화)
        if count >= 2:
            return True

        # 단일 키워드지만 문맥상 쓰레기인 경우
        if "무단전재" in t or "재배포금지" in t or "Copyright" in t:
            return True

        return False

    # 1. 원본 기사 가져오기
    original_news_list = crud.get_original_news_details_by_cluster(db, req.cluster_id)
    if not original_news_list:
        return {"match_found": False, "message": "원본 기사가 없습니다."}

    # 2. 대상 언론사 필터링 & 후보군(문장) 생성
    candidates = []
    target_media_set = set(req.target_media)

    def is_target_media(company_name):
        if not target_media_set:
            return True
        for target in target_media_set:
            if target in company_name:
                return True
        return False

    for news in original_news_list:
        company = news["company_name"]
        if not is_target_media(company):
            continue

        raw_contents = str(news["contents"] or "")
        # [변경] 다시 문장 단위로 변경 (사용자 요청: 문단은 너무 길다)
        sentences_raw = split_sentences_positions(raw_contents)

        # 인덱스 추적을 위해 리스트업
        for i, s in enumerate(sentences_raw):
            if len(s) < 10:  # 너무 짧은 문장 제외
                continue

            # [Filter] 불필요한 홍보/구독/제보 문구 제거
            if is_junk_sentence(s):
                continue

            candidates.append(
                {
                    "text": s,
                    "doc_title": news["title"],
                    "company": company,
                    "url": news["url"],
                    "news_id": news.get("news_id"),
                    "index": i,
                    "total_len": len(sentences_raw),
                    "context_prev": sentences_raw[i - 1] if i > 0 else None,
                    "context_next": sentences_raw[i + 1] if i < len(sentences_raw) - 1 else None,
                }
            )

    if not candidates:
        return {"match_found": False, "message": "해당 언론사의 기사 내용을 찾을 수 없습니다."}

    # 3. 임베딩 & 유사도 계산
    all_texts = [req.claim_text] + [c["text"] for c in candidates]
    embeddings = encode_texts(all_texts)

    target_vec = embeddings[0].reshape(1, -1)
    candidate_vecs = embeddings[1:]

    sim_scores = cosine_similarity(target_vec, candidate_vecs)[0]

    # 임시 저장소: (score, candidate)
    scored_candidates = []
    for idx, score in enumerate(sim_scores):
        if score < 0.35:
            continue
        scored_candidates.append((score, candidates[idx]))

    # 언론사별 최고 점수 찾기
    best_per_company = {}

    for score, cand in scored_candidates:
        company = cand["company"]
        if company not in best_per_company or score > best_per_company[company]["score"]:
            best_per_company[company] = {"score": score, "cand": cand}

    # 4. 문맥 병합 (Context Merging)
    results = []
    for company, item in best_per_company.items():
        score = item["score"]
        cand = item["cand"]

        final_text = cand["text"]

        # 앞/뒤 문장 단순 병합 (문맥상 중요할 확률 높음)
        # 로직: 단순히 앞뒤 문장을 붙여서 보여줌으로서 '흐름'을 제공
        # 단, 너무 길어지지 않게 체크

        prev_text = cand["context_prev"] or ""
        next_text = cand["context_next"] or ""

        # 앞 문장이 있고, 너무 길지 않으면 추가 (문맥 연결)
        if prev_text and len(prev_text) < 100:
            final_text = prev_text + " " + final_text

        # 뒷 문장이 있고, 너무 길지 않으면 추가
        if next_text and len(next_text) < 100:
            final_text = final_text + " " + next_text

        # ... 처리
        if cand["index"] > 1:  # prev를 썼더라도 그 앞이 더 있으면
            final_text = "... " + final_text
        if cand["index"] < cand["total_len"] - 2:
            final_text = final_text + " ..."

        results.append(
            {
                "score": round(float(score) * 100, 1),
                "text": final_text,
                "title": cand["doc_title"],
                "url": cand["url"],
                "company": company,
            }
        )

    return {"match_found": len(results) > 0, "evidence": results}


@router.get("/{report_id}/media-focus")
def get_media_focus_analysis(report_id: int, db: Session = Depends(get_db)):
    """
    특정 리포트(이슈)에 대한 언론사별 집중도 지수를 반환합니다.
    """
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # cluster_id로 분석
    result = crud.get_media_focus_stats(db, report.cluster_id)
    return result




