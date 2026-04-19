# backend/scraper_en.py
import time
import re
import feedparser
from urllib.parse import quote
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from datetime import datetime

class GlobalNewsScraper:
    def __init__(self):
        self.base_url = 'https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en'
        
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        # 최적화: 이미지 로딩 차단 및 페이지 로드 전략 설정
        prefs = {"profile.managed_default_content_settings.images": 2}
        chrome_options.add_experimental_option("prefs", prefs)
        chrome_options.page_load_strategy = 'eager'
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

        self.service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=self.service, options=chrome_options)
        self.driver.set_page_load_timeout(30)

    def get_content_with_selenium(self, url):
        try:
            self.driver.get(url)
            time.sleep(2) 

            html = self.driver.page_source
            soup = BeautifulSoup(html, 'html.parser')

            # 이미지 URL 추출 (og:image 등)
            img_tag = soup.find("meta", property="og:image") or \
                      soup.find("meta", {"name": "twitter:image"}) or \
                      soup.find("link", {"rel": "image_src"})
            
            image_url = img_tag['content'] if img_tag and img_tag.has_attr('content') else \
                        img_tag['href'] if img_tag and img_tag.has_attr('href') else None

            # 본문 추출 및 정제
            for junk in soup(["script", "style", "nav", "header", "footer", "button"]):
                junk.extract()

            paragraphs = soup.find_all('p')
            content = " ".join([p.get_text().strip() for p in paragraphs if len(p.get_text().strip()) > 50])
            
            # 본문 전처리 (뉴스 크롤러와 동일한 정제 로직)
            content = re.sub(r'\s+', ' ', content).strip()
            
            return {
                "text": content if len(content) > 200 else None,
                "image": image_url
            }
        except Exception as e:
            print(f"❌ [Selenium Error] {url} : {e}")
            return {"text": None, "image": None}

    def run(self, keyword):
        """뉴스 데이터를 수집하여 리스트(Dict) 형식으로 반환"""
        # 공신력 있는 외신 필터
        site_filter = "site:bbc.co.uk OR site:reuters.com OR site:aljazeera.com OR site:theguardian.com OR site:cnn.com OR site:bloomberg.com OR site:cnbc.com"
        query = quote(f"{keyword} ({site_filter})")
        feed = feedparser.parse(self.base_url.format(query=query))
        
        all_news_data = []
        
        # 상위 5개 기사만 순회 (속도 최적화)
        for entry in feed.entries[:5]:
            print(f"📡 [해외 뉴스 수집] {entry.title[:50]}...")
            data = self.get_content_with_selenium(entry.link)
            
            # 본문 수집에 성공한 경우만 추가
            if data["text"]:
                all_news_data.append({
                    "title": entry.title,
                    "search_title": entry.title, # 분석용 정제 제목
                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), # RSS는 포맷이 다양하므로 현재 시간으로 대체
                    "company_name": entry.get('source', {}).get('title', 'Global News'),
                    "contents": data["text"],
                    "img_urls": [data["image"]] if data["image"] else [],
                    "url": entry.link,
                    "category": "세계"
                })

        # [중요] 여기있던 self.driver.quit() 제거함. 
        # main.py에서 인스턴스를 유지하며 여러 키워드를 검색해야 하기 때문입니다.
        return all_news_data

    def close(self):
        """브라우저 종료 헬퍼 메서드"""
        if self.driver:
            self.driver.quit()

if __name__ == "__main__":
    scraper = GlobalNewsScraper()
    try:
        news_list = scraper.run("AI Technology")
        print(f"\n✅ 총 {len(news_list)}건의 기사가 수집되었습니다.")
    finally:
        scraper.close()