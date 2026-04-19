# VaccineDailyReport/backend/clustering.py

import numpy as np
import re
import os
from dotenv import load_dotenv
import chromadb
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sentence_transformers import SentenceTransformer
import json
from openai import OpenAI
from kiwipiepy import Kiwi
from database.engine import SessionLocal, engine
from database.models import Base, News, Report
from database import crud
from sklearn.preprocessing import normalize
from sklearn.metrics.pairwise import cosine_similarity
import hdbscan

load_dotenv(override=False)  # 환경 변수가 이미 설정되어 있으면 덮어쓰지 않음
kiwi = Kiwi()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# -------------------------------------------------
# 1. 초기화 및 ChromaDB 설정 (Lazy Loading)
# -------------------------------------------------
print("--- [AI] 모델 및 ChromaDB 로딩 중... ---")

# [Refactor] vector_store 모듈 사용
from database.vector_store import get_collection, get_embed_model

# Lazy loading: 함수 호출 시점에 초기화
_collection = None
_embed_model = None

def _get_collection():
    global _collection
    if _collection is None:
        _collection = get_collection()
    return _collection

def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = get_embed_model()
    return _embed_model

# 하위 호환성을 위한 별칭
collection = None  # 실제로는 _get_collection()을 통해 접근
embed_model = None  # 실제로는 _get_embed_model()을 통해 접근

client = OpenAI(api_key=OPENAI_API_KEY)


# -------------------------------------------------
# 2. ChromaDB 기반 Embedding 캐시 로직 (팀원 버전 채택)
# -------------------------------------------------
def get_embeddings_with_cache(articles):
    """
    기사 목록의 임베딩을 ChromaDB에서 조회하고, 없으면 생성하여 저장합니다.
    """
    article_ids = [str(a.news_id) for a in articles]

    # 1. ChromaDB 조회
    existing_data = _get_collection().get(ids=article_ids, include=["embeddings"])
    id_to_embedding = {
        aid: np.array(emb, dtype=np.float32) for aid, emb in zip(existing_data["ids"], existing_data["embeddings"])
    }

    # 2. 없는 데이터 확인 및 생성
    to_embed_indices = [i for i, a in enumerate(articles) if str(a.news_id) not in id_to_embedding]

    if to_embed_indices:
        print(f"    [ChromaDB] {len(to_embed_indices)}건 신규 임베딩 생성 중...")
        to_embed_texts = []
        for i in to_embed_indices:
            a = articles[i]
            # 제목과 본문 앞부분을 결합하여 임베딩 품질 향상
            clean_title = re.sub(r"\[.*?\]|\(.*?\)", "", a.title).strip()
            clean_content = (a.contents or "")[:200].replace("\n", " ")
            to_embed_texts.append(f"제목: {clean_title} 내용: {clean_content}")

        new_embs = _get_embed_model().encode(to_embed_texts, normalize_embeddings=True)

        # ChromaDB 저장
        new_ids = [str(articles[i].news_id) for i in to_embed_indices]
        _get_collection().add(
            ids=new_ids,
            embeddings=new_embs.tolist(),
            metadatas=[{"title": articles[i].title} for i in to_embed_indices],
        )

        for aid, emb in zip(new_ids, new_embs):
            id_to_embedding[aid] = emb

    # 3. 입력 순서대로 정렬하여 반환
    return np.array([id_to_embedding[str(a.news_id)] for a in articles], dtype=np.float32)


# -------------------------------------------------
# 3. 보조 로직 (KG 체크 및 LLM 검증)
# -------------------------------------------------
def simple_kg_check(articles):
    """
    최소한의 공통 명사가 있는지 확인하여 엉뚱한 기사가 섞이는 것을 방지
    """
    if len(articles) < 3:
        return False

    stopwords = {
        "오늘",
        "내일",
        "속보",
        "단독",
        "종합",
        "기자",
        "보도",
        "사진",
        "포토",
        "관련",
        "어제",
        "진행",
        "개최",
        "출시",
        "등록",
        "확인",
        "발표",
        "예정",
        "위해",
        "의해",
        "정치",
        "지난",
        "이번",
        "통해",
        "대한",
        "업계",
        "시장",
        "국내",
        "글로벌",
        "의료",
        "의료계",
        "뉴스",
        "기사",
        "소식",
        "정보",
        "현장",
        "특징",
        "정리",
        "무단",
        "배포",
        "금지",
        "전재",
        "기업",
        "업체",
        "동향",
        "현황",
        "사업",
        "추진",
        "기대",
        "전망",
        "성장",
        "강화",
        "목표",
        "주목",
        "가속",
        "본격",
        "최근",
        "성공",
        "결과",
        "계획",
        "선정",
        "확대",
        "바이오",
        "제약사",
        "치료",
        "제품",
        "기술",
        "개발",
        "환자",
        "사용",
        "도움",
        "기능",
        "효과",
        "시스템",
        "도입",
        "제공",
        "서비스",
        "운영",
        "관리",
        "인증",
        "수상",
        "지원",
        "기본",
    }

    def extract_nouns(text):
        tokens = kiwi.tokenize(text)
        return set(t.form for t in tokens if t.tag in ["NNG", "NNP"] and t.form not in stopwords and len(t.form) > 1)

    docs_nouns = [extract_nouns(a.title) for a in articles]

    # [수정] 모든 기사의 교집합 대신, 과반수 이상의 기사에 등장하는 명사 확인
    # 모든 명사를 모아서 빈도 계산
    from collections import Counter
    all_nouns = []
    for nouns in docs_nouns:
        all_nouns.extend(nouns)

    noun_freq = Counter(all_nouns)
    threshold = len(articles) * 0.5  # 50% 이상의 기사에 등장

    # 과반수 이상의 기사에 등장하는 명사가 있으면 통과
    common_nouns = [noun for noun, freq in noun_freq.items() if freq >= threshold]

    return len(common_nouns) >= 1


def run_stage2_issue_refine(articles):
    """
    LLM을 사용하여 실제로 동일한 이슈인지 최종 검증
    """
    summaries = [f"[{i}] 제목: {a.title}\n요약: {(a.contents or '')[:150]}" for i, a in enumerate(articles[:10])]

    system_prompt = """
You are a veteran Desk Reporter with keen news insight.
Your goal is to group only the articles that report on the **"completely identical event"** from the provided list.

[Verification & Filtering Rules]
1. **Entity Consistency**: If the key main character (person, company, institution) is different, it is strictly NOT the same issue.
2. **Event Singularity**: Exclude articles that list multiple events, like "Industry Trends".
3. **Impurity Removal**: Exclude articles that have a different subject from the majority.
4. **Minimum Requirement**: If fewer than 3 articles cover the exact same event, return `valid_indices: []`.

[Output JSON Format]
{
    "valid_indices": [0, 1, 3], 
    "title": "One sentence summary title of the issue"
}
If none, return "valid_indices": []
"""

    user_prompt = f"""
[Article List]
{chr(10).join(summaries)}

Task: Identify the perfect cluster of articles covering the same event.
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt.strip()},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        content = response.choices[0].message.content
        parsed = json.loads(content)

        # Key validation
        valid_ids = parsed.get("valid_indices", [])
        title = parsed.get("title", "")

        return {"valid_ids": valid_ids, "title": title}

    except Exception as e:
        print(f"LLM 검증 오류 (OpenAI): {e}")
        return {"valid_ids": []}


# -------------------------------------------------
# 4. 메인 파이프라인
# -------------------------------------------------
def run_issue_clustering(db: Session, days=3, ref_date=None):
    Base.metadata.create_all(bind=engine)

    if ref_date is None:
        ref_date = datetime.now()

    # ref_date 기준 과거 days일 동안의 기사를 조회
    since = ref_date - timedelta(days=days)

    # 1. 기사 조회
    # [수정] get_recent_news가 since 이후의 기사를 가져오는데,
    # 과거 시점 크롤링의 경우 미래의 기사(ref_date 이후)가 포함되면 안될 수도 있음.
    # 하지만 여기서는 'since' 부터 'ref_date' 사이의 기사만 가져오는게 정확함.
    # 기존 crud.get_recent_news는 >= since 만 체크함.
    # 따라서 여기서 필터링을 추가하거나 crud를 수정해야 함.
    # 여기서는 간단히 가져온 후 필터링.

    articles = crud.get_recent_news(db, since)
    # ref_date보다 미래의 기사는 제외 (과거 시점 재현)
    articles = [a for a in articles if a.created_at <= ref_date + timedelta(days=1)]  # 하루 정도 여유

    # 오피니언/사설은 Phase 1에서 제외 (Phase 2에서 별도 배정)
    articles = [a for a in articles if not a.is_opinion]

    articles = [a for a in articles if not a.clusters]
    # print(f"🔍 [DEBUG] 조회된 기사 수: {len(articles) if articles else 0}개")

    if len(articles) < 3:
        print("⚠️ 기사가 부족하여 클러스터링을 종료합니다.")
        return

    # 런타임 처리를 위한 issue_id 초기화 (DB에는 없는 필드)
    for a in articles:
        a.issue_id = None

    # 2. 임베딩 확보
    embeddings = get_embeddings_with_cache(articles)

    # 3. [복구됨] 기존 이슈에 새 기사 병합 (Absorption)
    #    - 기존 이슈와 유사도가 매우 높으면(0.85 이상) 해당 이슈로 편입시킵니다.
    # print("🔄 [DEBUG] 기존 이슈와의 병합 검사 시작...")
    # [수정] recent_issues도 since 이후에 생성된 것들만 조회
    recent_issues = db.query(Report).filter(Report.created_at >= since).all()

    for issue in recent_issues:
        # 이슈에 연결된 기사 중 하나를 대표로 선정 (Cluster -> News 관계 활용)
        if not issue.cluster or not issue.cluster.news:
            continue

        sample_news = issue.cluster.news[0]

        # 대표 기사의 임베딩 가져오기 (ChromaDB 활용)
        res = _get_collection().get(ids=[str(sample_news.news_id)], include=["embeddings"])
        if len(res["embeddings"]) == 0:
            continue

        issue_vec = np.array(res["embeddings"][0]).reshape(1, -1)

        for i, a in enumerate(articles):
            # 이미 이슈가 할당된 기사는 패스
            if getattr(a, "issue_id", None) is not None:
                continue

            raw_sim = cosine_similarity(embeddings[i].reshape(1, -1), issue_vec)[0][0]
            sim = float(raw_sim)
            if sim >= 0.85:
                a.issue_id = issue.report_id
                # DB 연결: Cluster에 뉴스 추가
                crud.add_news_to_cluster(db, cluster_id=issue.cluster_id, news_id=a.news_id)
                print(f"  🔗 [병합] '{a.title}' -> 기존 이슈 '{issue.title}' (유사도: {sim:.2f})")

    # 4. 신규 클러스터링 (HDBSCAN)
    # print("🚀 [DEBUG] 신규 클러스터링 시작...")

    # 이슈가 할당되지 않은 기사들만 필터링
    rem = [(i, a) for i, a in enumerate(articles) if getattr(a, "issue_id", None) is None]

    if len(rem) < 3:
        print("⚠️ 남은 기사가 부족하여 신규 클러스터링을 생략합니다.")
        db.commit()
        return

    idxs, rem_articles = zip(*rem)
    rem_embs = normalize(embeddings[list(idxs)])

    # min_cluster_size=3 (팀원 코드 반영: 소규모 데이터 대응)
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=3,
        min_samples=1,
        metric="euclidean",
        cluster_selection_epsilon=0.33,
    )
    labels = clusterer.fit_predict(rem_embs)

    # 디버깅: 클러스터 레이블 분포 출력
    # unique_labels = set(labels)
    # print(f"   [DEBUG] HDBSCAN 결과: {len(unique_labels)}개 레이블 (노이즈 포함)")
    # for label in unique_labels:
    #     count = np.sum(labels == label)
    #     if label == -1:
    #         print(f"   [DEBUG]   레이블 {label} (노이즈): {count}개")
    #     else:
    #         print(f"   [DEBUG]   레이블 {label}: {count}개")

    for cid in set(labels):
        if cid == -1:  # 노이즈
            continue

        # 현재 클러스터에 속한 기사들
        cluster_indices = np.where(labels == cid)[0]
        cluster = [rem_articles[i] for i in cluster_indices]

        # 1차 검증: KG Check
        # print(f"   [DEBUG] 클러스터 {cid}: 1차 검증 시작 ({len(cluster)}개 기사)")
        if not simple_kg_check(cluster):
            # print(f"   [DEBUG] 클러스터 {cid}: 1차 검증 실패 (KG Check)")
            continue

        # 2차 검증: LLM Refine
        # print(f"   [DEBUG] 클러스터 {cid}: 2차 검증 시작 (LLM Refine)")
        res = run_stage2_issue_refine(cluster)
        valid_ids = res.get("valid_ids", [])

        if len(valid_ids) < 3:
            # print(f"   [DEBUG] 클러스터 {cid}: 2차 검증 실패 (valid_ids={len(valid_ids)} < 3)")
            continue

        # print(f"   [DEBUG] 클러스터 {cid}: 검증 통과! (valid_ids={len(valid_ids)}개)")

        picked = [cluster[i] for i in valid_ids if i < len(cluster)]
        final_title = res.get("title", picked[0].title)

        # 5. 이슈 생성 및 DB 저장
        issue = crud.create_report_issue(db, title=final_title, article_ids=[a.news_id for a in picked])

        # 런타임 객체에 issue_id 마킹 (중복 처리 방지용)
        for a in picked:
            a.issue_id = issue.report_id

        print(f"✨ [이슈 생성 완료] {final_title} (기사 {len(picked)}건)")

    db.commit()

    # Phase 2: 오피니언을 기존 클러스터에 배정
    assign_opinions_to_clusters(db, since, ref_date)

    print("--- [DONE] 모든 작업 완료 ---")


# -------------------------------------------------
# 5. Phase 2: 오피니언 → 기존 클러스터 배정
# -------------------------------------------------
def assign_opinions_to_clusters(db: Session, since, ref_date, threshold=0.75):
    """
    미배정 오피니언 기사를 임베딩 유사도 기반으로 기존 클러스터에 배정합니다.
    뉴스 군집화(Phase 1) 후 호출됩니다.
    """
    print("\n📝 [Phase 2] 오피니언 클러스터 배정 시작...")

    # 1. 미배정 오피니언 가져오기
    all_news = crud.get_recent_news(db, since)
    opinions = [
        a for a in all_news
        if a.is_opinion
        and a.created_at <= ref_date + timedelta(days=1)
        and not a.clusters
    ]

    if not opinions:
        print("  ⚠️ 배정할 오피니언이 없습니다.")
        return

    print(f"  📰 미배정 오피니언: {len(opinions)}건")

    # 2. 오피니언 임베딩 획득
    opinion_embeddings = get_embeddings_with_cache(opinions)

    # 3. 최근 클러스터 대표벡터 수집
    recent_issues = db.query(Report).filter(Report.created_at >= since).all()
    cluster_vecs = []  # [(issue, vector)]

    for issue in recent_issues:
        if not issue.cluster or not issue.cluster.news:
            continue
        # 클러스터 내 뉴스 기사(오피니언 제외)의 임베딩 평균을 대표벡터로 사용
        news_in_cluster = [n for n in issue.cluster.news if not n.is_opinion]
        if not news_in_cluster:
            continue

        news_ids = [str(n.news_id) for n in news_in_cluster]
        res = _get_collection().get(ids=news_ids, include=["embeddings"])
        if len(res["embeddings"]) == 0:
            continue

        avg_vec = np.mean(res["embeddings"], axis=0).reshape(1, -1)
        cluster_vecs.append((issue, avg_vec))

    if not cluster_vecs:
        print("  ⚠️ 배정 대상 클러스터가 없습니다.")
        return

    # 4. 각 오피니언을 가장 유사한 클러스터에 배정
    assigned = 0
    for i, opinion in enumerate(opinions):
        op_vec = opinion_embeddings[i].reshape(1, -1)

        best_sim = -1
        best_issue = None
        for issue, cvec in cluster_vecs:
            sim = float(cosine_similarity(op_vec, cvec)[0][0])
            if sim > best_sim:
                best_sim = sim
                best_issue = issue

        if best_sim >= threshold and best_issue:
            crud.add_news_to_cluster(db, cluster_id=best_issue.cluster_id, news_id=opinion.news_id)
            assigned += 1
            print(f"  🔗 '{opinion.title[:40]}...' → '{best_issue.title[:30]}...' (유사도: {best_sim:.2f})")

    db.commit()
    print(f"  ✅ 오피니언 {assigned}/{len(opinions)}건 클러스터 배정 완료")
