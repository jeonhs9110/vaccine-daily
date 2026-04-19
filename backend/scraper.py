# scraper.py
import requests
from bs4 import BeautifulSoup
import re
import time
import threading
import concurrent.futures
from datetime import datetime, timedelta
from sqlalchemy import and_
from database.models import News, Company


# ---------------------------------------------------------
# 0. 네이버 요청 속도 제한 (스레드 안전)
# ---------------------------------------------------------
class RateLimiter:
    """Token-bucket 방식 글로벌 속도 제한기."""
    def __init__(self, max_per_second=10.0):
        self._lock = threading.Lock()
        self._min_interval = 1.0 / max_per_second
        self._last_time = 0.0

    def acquire(self):
        with self._lock:
            now = time.monotonic()
            wait = self._last_time + self._min_interval - now
            if wait > 0:
                time.sleep(wait)
            self._last_time = time.monotonic()


_naver_rate_limiter = RateLimiter(max_per_second=10)


# ---------------------------------------------------------
# 1. 유틸리티 함수
# ---------------------------------------------------------
def is_korean_article(text, threshold=0.25):
    if not text:
        return False
    korean_chars = re.findall(r"[가-힣]", text)
    total_chars = len(text.replace(" ", ""))
    if total_chars == 0:
        return False
    return (len(korean_chars) / total_chars) >= threshold


def get_news_data(url):
    # [설정] 네이버 차단을 피하기 위한 헤더
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        title_el = soup.select_one("h2#title_area span")
        raw_title = title_el.get_text(strip=True) if title_el else "제목 없음"

        content_area = soup.select_one("#newsct_article")
        if not content_area:
            return None

        for extra in content_area.select(".img_desc, .article_caption, em, script, style, .sidebar, .ad"):
            extra.decompose()

        contents = content_area.get_text(separator=" ", strip=True)

        # 본문 정제 로직
        contents = re.sub(r"^[가-힣]{2,4}\s?=\s?[가-힣]{2,5}뉴스\)", "", contents)
        contents = re.sub(r".*?기자\s?=", "", contents)
        contents = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "", contents)
        contents = re.sub(r"[^\w\s가-힣.?!,]", " ", contents)

        stop_phrases = ["무단전재", "재배포 금지", "저작권자", "Copyrights"]
        for phrase in stop_phrases:
            if phrase in contents:
                contents = contents.split(phrase)[0].strip()

        contents = re.sub(r"\s+", " ", contents).strip()

        if not is_korean_article(contents) or len(contents) < 200:
            return None

        # 이미지 URL 추출
        img_urls = [img.get("data-src") or img.get("src") for img in soup.select("#newsct_article img")]

        return {
            "title": raw_title,
            "contents": contents,
            "time": (
                soup.select_one("._ARTICLE_DATE_TIME")["data-date-time"]
                if soup.select_one("._ARTICLE_DATE_TIME")
                else "시간 정보 없음"
            ),
            "company_name": (
                soup.select_one(".media_end_head_top_logo img")["title"]
                if soup.select_one(".media_end_head_top_logo img")
                else "언론사 미상"
            ),
            "img_urls": img_urls,
            "url": url,
            "category": "미분류",  # 기본값 설정
        }
    except Exception as e:
        # print(f"파싱 에러: {e}")
        return None


# ---------------------------------------------------------
# 2. 메인 크롤러 (작성하신 DB 체크 버전)
# ---------------------------------------------------------
def run_article_crawler(db_session, target_companies=None):
    """
    3-Phase 병렬 크롤러:
      Phase 1: URL 수집 + DB URL 중복 체크 (순차)
      Phase 2: HTTP fetch 병렬 처리 (ThreadPoolExecutor)
      Phase 3: 메모리/DB 중복 체크 + 결과 조립 (순차)
    """
    sections = ["100", "101", "102", "103", "104", "105"]
    section_names = {"100": "정치", "101": "경제", "102": "사회", "103": "생활/문화", "104": "세계", "105": "IT/과학"}

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }

    # ── Phase 1: URL 수집 + DB 중복 체크 (순차) ──
    urls_to_fetch = []  # [(url, sid), ...]

    for sid in sections:
        print(f"\n--- [{section_names[sid]}] 섹션 스캔 중... ---")
        list_url = f"https://news.naver.com/main/list.naver?mode=LSD&mid=sec&sid1={sid}"

        try:
            res = requests.get(list_url, headers=headers, timeout=10)
            soup = BeautifulSoup(res.text, "html.parser")
            atags = soup.select(".list_body a, .sa_text_title")
            urls = list(set(a.get("href") for a in atags if a.get("href") and "article" in a.get("href")))

            for url in urls:
                if db_session.query(News.news_id).filter(News.url == url).first():
                    continue
                urls_to_fetch.append((url, sid))

        except Exception as e:
            print(f"  ❌ [{sid}] 섹션 오류: {e}")
            continue

    print(f"\n--- 총 {len(urls_to_fetch)}개 기사 병렬 수집 시작 ---")

    # ── Phase 2: HTTP fetch 병렬 처리 ──
    fetched_results = []  # [(data, sid), ...]

    def _fetch_news(url):
        _naver_rate_limiter.acquire()
        return get_news_data(url)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_meta = {
            executor.submit(_fetch_news, url): (url, sid)
            for url, sid in urls_to_fetch
        }
        for future in concurrent.futures.as_completed(future_to_meta):
            url, sid = future_to_meta[future]
            try:
                data = future.result()
                if data:
                    fetched_results.append((data, sid))
                    print(f"  📥 [{section_names[sid]}] {data['company_name']} | {data['title'][:40]}")
            except Exception as e:
                print(f"  ❌ fetch 실패: {url}: {e}")

    # ── Phase 3: 중복 체크 + 필터 + 결과 조립 (순차) ──
    new_news_list = []
    collected_titles = set()

    for data, sid in fetched_results:
        clean_title = data["title"].strip()
        title_key = (data["company_name"], clean_title)

        if title_key in collected_titles:
            continue

        exists_content = (
            db_session.query(News)
            .join(Company)
            .filter(News.title == data["title"], Company.name == data["company_name"])
            .first()
        )
        if exists_content:
            collected_titles.add(title_key)
            continue

        if target_companies:
            if not any(tc in data["company_name"] for tc in target_companies):
                continue

        data["category"] = section_names[sid]
        if data["category"] == "생활/문화":
            data["category"] = "사회"

        collected_titles.add(title_key)
        new_news_list.append(data)
        print(f"  ✅ [NEW] {data['company_name']} | {clean_title[:30]}...")

    return new_news_list


def crawl_n_days(
    db_session,  # [수정] DB 세션 필수 추가
    n_days: int,
    sections=("100", "101", "102", "103", "104", "105"),
    pages_per_day=5,
    target_companies=None,
    sleep_sec=0.1,
):
    """
    네이버 뉴스 '목록'을 날짜(date=YYYYMMDD)와 페이지(page=)로 확장해서 n일치 기사 수집.
    [필수] db_session: 중복 체크를 위한 DB 세션
    """
    section_names = {
        "100": "정치",
        "101": "경제",
        "102": "사회",
        "103": "생활/문화",
        "104": "세계",
        "105": "IT/과학",
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }

    all_news_data = []

    # [수정] 메모리 중복 방지 (이번 실행 텀에서 중복 방지)
    collected_titles = set()

    today = datetime.now()

    for d in range(n_days):
        day = today - timedelta(days=d)
        ymd = day.strftime("%Y%m%d")
        print(f"\n📅 [날짜 수집] {ymd} (D-{d})")

        for sid in sections:
            print(f"   └─ [{section_names.get(sid, sid)}] 섹션 스캔 중...")

            for page in range(1, pages_per_day + 1):
                list_url = (
                    "https://news.naver.com/main/list.naver" f"?mode=LSD&mid=sec&sid1={sid}&date={ymd}&page={page}"
                )

            try:
                resp = requests.get(list_url, headers=headers, timeout=10)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")

                # 목록에서 기사 URL 추출
                atags = soup.select(".list_body a, .sa_text_title, a[href*='article']")
                urls = [a.get("href") for a in atags if a.get("href") and "article" in a.get("href")]

                if not urls:
                    break

                for url in set(urls):
                    # ---------------------------------------------------------
                    # 1. DB URL 중복 체크 (run_article_crawler와 로직 통일)
                    # ---------------------------------------------------------
                    if db_session.query(News.news_id).filter(News.url == url).first():
                        # print(f"     [PASS] 이미 수집된 URL")
                        continue

                    data = get_news_data(url)  # 상세 파싱
                    if not data:
                        continue

                    # ---------------------------------------------------------
                    # 2. 제목+언론사 중복 체크 (메모리 + DB)
                    # ---------------------------------------------------------
                    clean_title = data["title"].strip()
                    title_key = (data["company_name"], clean_title)

                    # [메모리 체크]
                    if title_key in collected_titles:
                        continue

                    # [DB 정밀 체크]
                    exists_content = (
                        db_session.query(News)
                        .join(Company)
                        .filter(News.title == data["title"], Company.name == data["company_name"])
                        .first()
                    )

                    if exists_content:
                        collected_titles.add(title_key)
                        continue

                    # ---------------------------------------------------------
                    # 3. 필터링 및 데이터 처리
                    # ---------------------------------------------------------
                    if data.get("category") == "미분류":
                        data["category"] = section_names.get(sid, "미분류")

                    # [추가] 생활/문화 -> 사회 로 통합 저장
                    if data["category"] == "생활/문화":
                        data["category"] = "사회"

                    if target_companies and not any(tc in data["company_name"] for tc in target_companies):
                        continue

                    # 수집 성공
                    all_news_data.append(data)
                    collected_titles.add(title_key)
                    print(f"     ✅ [GET] {data['company_name']} | {data['title'][:20]}...")

                    time.sleep(sleep_sec)

            except Exception as e:
                print(f"     ❌ [오류] {ymd} sid={sid} page={page} | {e}")
                continue

    return all_news_data

def crawl_news_by_period(
    db_session,
    start_date_str: str,
    end_date_str: str,
    sections=("100", "101", "102", "103", "104", "105"),
    pages_per_day=5,
    sleep_sec=0.1
):
    """
    특정 기간 뉴스 수집 (3-Phase 병렬 패턴, 날짜별 처리).
    Format: 'YYYYMMDD'
    """
    from database.crud import get_or_create_company_by_raw_name, create_news

    try:
        start_dt = datetime.strptime(start_date_str, "%Y%m%d")
        end_dt = datetime.strptime(end_date_str, "%Y%m%d")
    except ValueError:
        print("❌ 날짜 형식 오류 (YYYYMMDD 포맷 필요)")
        return []

    if start_dt > end_dt:
        print("❌ 시작일이 종료일보다 늦습니다.")
        return []

    date_list = []
    curr = start_dt
    while curr <= end_dt:
        date_list.append(curr)
        curr += timedelta(days=1)

    total_collected = []
    section_names = {
        "100": "정치", "101": "경제", "102": "사회",
        "103": "생활/문화", "104": "세계", "105": "IT/과학",
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }
    collected_titles = set()

    print(f"🚀 기간 수집 시작: {start_date_str} ~ {end_date_str} (총 {len(date_list)}일)")

    for target_date in date_list:
        ymd = target_date.strftime("%Y%m%d")
        print(f"\n📅 [Target] {ymd}")

        # ── Phase 1: 해당 날짜의 모든 URL 수집 (순차) ──
        urls_to_fetch = []  # [(url, sid), ...]

        for sid in sections:
            for page in range(1, pages_per_day + 1):
                list_url = f"https://news.naver.com/main/list.naver?mode=LSD&mid=sec&sid1={sid}&date={ymd}&page={page}"
                try:
                    resp = requests.get(list_url, headers=headers, timeout=10)
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "html.parser")
                    atags = soup.select(".list_body a, .sa_text_title, a[href*='article']")
                    urls = list(set(a.get("href") for a in atags if a.get("href") and "article" in a.get("href")))

                    if not urls:
                        break

                    for url in urls:
                        if db_session.query(News.news_id).filter(News.url == url).first():
                            continue
                        urls_to_fetch.append((url, sid))

                except Exception as e:
                    print(f"     ❌ [Error] {ymd} {sid} p{page}: {e}")
                    continue

        # ── Phase 2: HTTP fetch 병렬 처리 ──
        fetched_results = []  # [(data, sid), ...]

        def _fetch(url):
            _naver_rate_limiter.acquire()
            return get_news_data(url)

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_map = {
                executor.submit(_fetch, url): (url, sid)
                for url, sid in urls_to_fetch
            }
            for future in concurrent.futures.as_completed(future_map):
                url, sid = future_map[future]
                try:
                    data = future.result()
                    if data:
                        fetched_results.append((data, sid))
                        print(f"     📥 {data['company_name']} | {data['title'][:40]}")
                except Exception:
                    pass

        # ── Phase 3: 중복 체크 + DB 저장 (순차) ──
        day_count = 0
        for data, sid in fetched_results:
            clean_title = data["title"].strip()
            title_key = (data["company_name"], clean_title)

            if title_key in collected_titles:
                continue

            exists = (
                db_session.query(News)
                .join(Company)
                .filter(News.title == data["title"], Company.name == data["company_name"])
                .first()
            )
            if exists:
                collected_titles.add(title_key)
                continue

            if data.get("category") == "미분류":
                data["category"] = section_names.get(sid, "미분류")
            if data["category"] == "생활/문화":
                data["category"] = "사회"

            company = get_or_create_company_by_raw_name(db_session, data["company_name"])
            created_at = datetime.now()
            if data["time"] != "시간 정보 없음":
                try:
                    created_at = datetime.strptime(data["time"], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass

            create_news(
                db_session,
                title=data["title"],
                contents=data["contents"],
                url=data["url"],
                company_id=company.company_id,
                is_domestic=True,
                category=data["category"],
                img_urls=data.get("img_urls"),
                created_at=created_at
            )

            collected_titles.add(title_key)
            total_collected.append(data)
            day_count += 1
            print(f"     ✅ [Saved] {data['company_name']} | {clean_title[:15]}...")

        db_session.commit()
        print(f"  -> {ymd}: {day_count}건 저장")

    return total_collected


# ---------------------------------------------------------
# 4. 오피니언 크롤러 (사설, 칼럼, 기자의 시각)
# ---------------------------------------------------------
def get_opinion_data(url):
    """
    오피니언 기사 파싱. get_news_data()와 동일한 로직 + 작성자(author) 추출.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        title_el = soup.select_one("h2#title_area span")
        raw_title = title_el.get_text(strip=True) if title_el else "제목 없음"

        content_area = soup.select_one("#newsct_article")
        if not content_area:
            return None

        for extra in content_area.select(".img_desc, .article_caption, em, script, style, .sidebar, .ad"):
            extra.decompose()

        contents = content_area.get_text(separator=" ", strip=True)

        # 본문 정제 로직 (get_news_data와 동일)
        contents = re.sub(r"^[가-힣]{2,4}\s?=\s?[가-힣]{2,5}뉴스\)", "", contents)
        contents = re.sub(r".*?기자\s?=", "", contents)
        contents = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "", contents)
        contents = re.sub(r"[^\w\s가-힣.?!,]", " ", contents)

        stop_phrases = ["무단전재", "재배포 금지", "저작권자", "Copyrights"]
        for phrase in stop_phrases:
            if phrase in contents:
                contents = contents.split(phrase)[0].strip()

        contents = re.sub(r"\s+", " ", contents).strip()

        # 오피니언은 일반 뉴스보다 짧을 수 있으므로 100자 기준
        if not is_korean_article(contents) or len(contents) < 100:
            return None

        # 작성자(author) 추출
        author = None
        journalist_el = soup.select_one(".media_end_head_journalist_name")
        if journalist_el:
            author = journalist_el.get_text(strip=True)
        if not author:
            byline_el = soup.select_one(".byline, .journalist, .article_writer")
            if byline_el:
                author = byline_el.get_text(strip=True)

        img_urls = [img.get("data-src") or img.get("src") for img in soup.select("#newsct_article img")]

        return {
            "title": raw_title,
            "contents": contents,
            "time": (
                soup.select_one("._ARTICLE_DATE_TIME")["data-date-time"]
                if soup.select_one("._ARTICLE_DATE_TIME")
                else "시간 정보 없음"
            ),
            "company_name": (
                soup.select_one(".media_end_head_top_logo img")["title"]
                if soup.select_one(".media_end_head_top_logo img")
                else "언론사 미상"
            ),
            "img_urls": img_urls,
            "url": url,
            "category": "오피니언",
            "author": author,
            "is_opinion": True,
        }
    except Exception as e:
        return None


def run_opinion_crawler(db_session, target_companies=None):
    """
    3-Phase 병렬 오피니언 크롤러.
    """
    opinion_sections = {
        "263": "사설",
        "264": "칼럼",
        "265": "기자의 시각",
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }

    # ── Phase 1: URL 수집 + DB 중복 체크 (순차) ──
    urls_to_fetch = []

    for sid2, section_name in opinion_sections.items():
        print(f"\n--- [오피니언 / {section_name}] 섹션 스캔 중... ---")
        list_url = f"https://news.naver.com/main/list.naver?mode=LSD&mid=sec&sid1=110&sid2={sid2}"

        try:
            res = requests.get(list_url, headers=headers, timeout=10)
            soup = BeautifulSoup(res.text, "html.parser")
            atags = soup.select(".list_body a, .sa_text_title, a[href*='article']")
            urls = list(set(a.get("href") for a in atags if a.get("href") and "article" in a.get("href")))

            for url in urls:
                if db_session.query(News.news_id).filter(News.url == url).first():
                    continue
                urls_to_fetch.append(url)

        except Exception as e:
            print(f"  ❌ [오피니언/{section_name}] 오류: {e}")
            continue

    print(f"\n--- 총 {len(urls_to_fetch)}개 오피니언 병렬 수집 시작 ---")

    # ── Phase 2: HTTP fetch 병렬 처리 ──
    fetched_results = []

    def _fetch_opinion(url):
        _naver_rate_limiter.acquire()
        return get_opinion_data(url)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_map = {executor.submit(_fetch_opinion, url): url for url in urls_to_fetch}
        for future in concurrent.futures.as_completed(future_map):
            try:
                data = future.result()
                if data:
                    fetched_results.append(data)
                    print(f"  📥 [오피니언] {data['company_name']} | {data['title'][:40]}")
            except Exception as e:
                print(f"  ❌ 오피니언 fetch 실패: {e}")

    # ── Phase 3: 중복 체크 + 필터 + 결과 조립 (순차) ──
    new_opinions = []
    collected_titles = set()

    for data in fetched_results:
        clean_title = data["title"].strip()
        title_key = (data["company_name"], clean_title)

        if title_key in collected_titles:
            continue

        exists_content = (
            db_session.query(News)
            .join(Company)
            .filter(News.title == data["title"], Company.name == data["company_name"])
            .first()
        )
        if exists_content:
            collected_titles.add(title_key)
            continue

        if target_companies:
            if not any(tc in data["company_name"] for tc in target_companies):
                continue

        collected_titles.add(title_key)
        new_opinions.append(data)
        print(f"  ✅ [OPINION] {data['company_name']} | {clean_title[:30]}...")

    return new_opinions
