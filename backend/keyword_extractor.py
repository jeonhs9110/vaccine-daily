import json
import re
import os
import networkx as nx
from kiwipiepy import Kiwi
from krwordrank.word import KRWordRank

# 이 파일은 텍스트에서 주요 키워드를 추출하는 기능을 담당합니다.
# init.sql 파일에서 기사 데이터를 읽어 분석하고, 분석 결과를 다시 init.sql에 업데이트하며,
# 프론트엔드에서 사용할 수 있도록 JSON 파일로도 저장합니다.

class KeywordExtractor:
    def __init__(self):
        # 형태소 분석을 위해 Kiwi 초기화
        self.kiwi = Kiwi()
        # 불용어 리스트: 키워드 추출에서 제외할 단어들
        self.stopwords = {'같은', '있다', '관련', '위한', '것으로', '반면', '이날', '상위', '대해', '가장', '통해'}

    def preprocess(self, text):
        """
        1단계: 조사 및 부사 필터링
        """
        if not text:
            return []

        try:
            tokens = self.kiwi.tokenize(text)
            keywords = []
            for token in tokens:
                # 일반 명사(NNG), 고유 명사(NNP), 외국어(SL) 유지
                if token.tag in ['NNG', 'NNP', 'SL']:
                    if len(token.form) > 1 and token.form not in self.stopwords:
                        keywords.append(token.form)
            return keywords
        except Exception as e:
            print(f"Error in preprocessing: {e}")
            return []

    def apply_textrank(self, tokens, window_size=3, top_k=10):
        """
        2단계: 반복 명사 가중치 부여 (TextRank)
        """
        if not tokens:
            return []

        nodes = list(set(tokens))
        graph = nx.Graph()
        graph.add_nodes_from(nodes)

        for i in range(len(tokens)):
            for j in range(i + 1, min(i + window_size, len(tokens))):
                w1 = tokens[i]
                w2 = tokens[j]
                if w1 != w2:
                    if graph.has_edge(w1, w2):
                        graph[w1][w2]['weight'] += 1
                    else:
                        graph.add_edge(w1, w2, weight=1)

        try:
            scores = nx.pagerank(graph)
            ranked_keywords = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            return ranked_keywords[:top_k]
        except Exception as e:
            print(f"Error in TextRank: {e}")
            return []

    def extract_new_words(self, text, top_k=10):
        """
        3단계: KR-WordRank를 사용한 신조어 처리
        """
        if not text:
            return []

        sentences = text.replace('.', '\n').split('\n')
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            return []

        try:
            wordrank_extractor = KRWordRank(min_count=2, max_length=10, verbose=False)
            keywords, rank, graph = wordrank_extractor.extract(sentences, 0.85, 10)

            filtered_keywords = {word: score for word, score in keywords.items() if word not in self.stopwords}
            sorted_keywords = sorted(filtered_keywords.items(), key=lambda x: x[1], reverse=True)
            return sorted_keywords[:top_k]
        except Exception:
            return []

    def process_content(self, title, content):
        """
        기사 제목과 본문을 분석하여 가중치가 적용된 상위 10개 키워드를 반환합니다.
        """
        tokens = self.preprocess(content)
        textrank_keywords = self.apply_textrank(tokens, top_k=30)
        new_words = self.extract_new_words(content, top_k=30)

        combined_scores = {}

        # TextRank 점수 정규화 및 합산
        if textrank_keywords:
            max_tr = textrank_keywords[0][1]
            for word, score in textrank_keywords:
                norm_score = (score / max_tr) * 100 if max_tr > 0 else 0
                combined_scores[word] = combined_scores.get(word, 0) + norm_score

        # KR-WordRank 점수 정규화 및 합산
        if new_words:
            max_kr = new_words[0][1]
            for word, score in new_words:
                norm_score = (score / max_kr) * 100 if max_kr > 0 else 0
                combined_scores[word] = combined_scores.get(word, 0) + norm_score

        # 제목 가중치 적용
        if title:
            for word in combined_scores:
                if word in title:
                    combined_scores[word] *= 1.5

        # 노이즈 필터링: 2글자 미만의 영어 단어 제거 (예: 'Te', 'Mi', 'Go' 등)
        # 단, 예외적으로 허용할 단어 리스트 정의
        allowed_short_english = {'AI', 'AR', 'VR', 'XR', '5G', '6G', 'DB', 'IT', 'SW', 'UX', 'UI', 'PC', 'OS'}

        filtered_scores = {}
        for word, score in combined_scores.items():
            # 영어로만 구성된 단어인지 확인
            if re.match(r'^[a-zA-Z]+$', word):
                 # 3글자 미만이면서 허용 리스트에 없으면 제거
                 if len(word) < 3 and word.upper() not in allowed_short_english:
                     continue
            filtered_scores[word] = score

        combined_scores = filtered_scores

        # 정렬 및 상위 40개 추출 (기존 10개에서 증가)
        final_ranked = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)[:40]

        # 프론트엔드(react-d3-cloud) 형식에 맞게 변환: [{"text": "단어", "value": 점수}]
        result = [{"text": word, "value": int(score)} for word, score in final_ranked]
        return result

    def process_sql_file(self, sql_path, json_output_path):
        """
        init.sql 파일을 읽어 분석하고, 업데이트된 내용을 저장하며, JSON 파일도 생성합니다.
        """
        print(f"Reading SQL file: {sql_path}")

        if not os.path.exists(sql_path):
            print("Error: init.sql file not found.")
            return

        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # INSERT 문 파싱 (정규표현식 사용)
        # 예: INSERT INTO issues (title, contents, analysis_result, created_at) VALUES ...
        # 괄호 안의 내용을 캡처합니다. 복잡한 SQL 이스케이프 처리는 간단히 가정합니다.

        # 1. VALUES 이후의 튜플들을 찾습니다.
        # 이 정규식은 기본적인 구조만 처리하며, 데이터 내에 괄호나 따옴표가 복잡하게 얽혀있으면 수정이 필요할 수 있습니다.
        pattern = re.compile(r"\(\s*'([^']*)',\s*'([^']*)',\s*'(\{.*?\})',\s*'([^']*)'\s*\)")

        matches = list(pattern.finditer(sql_content))
        print(f"Found {len(matches)} articles in init.sql.")

        new_sql_content = sql_content
        frontend_data = []

        # 역순으로 교체해야 인덱스가 꼬이지 않습니다 (string replacement approach) 
        # 하지만 여기서는 전체 내용을 재구성하는 것이 안전합니다.
        # 정규식으로 찾은 부분을 순회하며 데이터를 가공합니다.

        updated_insert_values = []

        for idx, match in enumerate(matches):
            full_match = match.group(0)
            title = match.group(1)
            content = match.group(2)
            analysis_json_str = match.group(3)
            created_at = match.group(4)

            # 따옴표 이스케이프 처리 복구 (SQL '' -> ')
            clean_title = title.replace("''", "'")
            clean_content = content.replace("''", "'")
            clean_analysis_str = analysis_json_str.replace("''", "'")

            try:
                analysis_data = json.loads(clean_analysis_str)
            except json.JSONDecodeError:
                print(f"Warning: JSON decode error at article {idx}. Skipping.")
                updated_insert_values.append(full_match)
                continue

            # 키워드 추출 및 가중치 계산
            weighted_keywords = self.process_content(clean_title, clean_content)

            # 기존 analysis_result 업데이트
            # 프론트엔드용 JSON에 맞게 저장
            analysis_data['keywords'] = weighted_keywords
            # 점수도 저장
            # analysis_data['score'] = ... (기존 유지)

            # JSON 덤프 (다시 SQL 이스케이프 처리: ' -> '')
            new_analysis_str = json.dumps(analysis_data, ensure_ascii=False)
            escaped_analysis_str = new_analysis_str.replace("'", "''")

            # 새로운 VALUES 튜플 생성
            new_value_tuple = f"(\n    '{match.group(1)}',\n    '{match.group(2)}',\n    '{escaped_analysis_str}',\n    '{created_at}'\n)"
            updated_insert_values.append(new_value_tuple)

            # 프론트엔드용 데이터 수집
            frontend_data.append({
                "id": idx + 1,
                "title": clean_title,
                "keywords": weighted_keywords,
                "created_at": created_at
            })

        # 새로운 SQL 파일 내용 작성
        # VALUES 이전 부분만 보존 + 새로운 VALUES
        if "VALUES" in sql_content:
            header_part = sql_content.split("VALUES")[0] + "VALUES \n"
            new_values_str = ",\n".join(updated_insert_values) + ";"

            final_sql = header_part + new_values_str

            with open(sql_path, 'w', encoding='utf-8') as f:
                f.write(final_sql)
            print(f"Updated {sql_path} with weighted keywords.")
        else:
            print("Error: Could not find VALUES clause in init.sql")

        # 프론트엔드용 JSON 저장
        os.makedirs(os.path.dirname(json_output_path), exist_ok=True)
        with open(json_output_path, 'w', encoding='utf-8') as f:
            json.dump(frontend_data, f, ensure_ascii=False, indent=2)
        print(f"Exported frontend data to {json_output_path}")

if __name__ == "__main__":
    extractor = KeywordExtractor()

    # 경로 설정
    # backend/keyword_extractor.py 위치 기준으로 경로 계산
    base_dir = os.path.dirname(os.path.abspath(__file__)) # c:\Users\201-05\Desktop\VaccineDailyReport-main\backend
    project_root = os.path.dirname(base_dir) # c:\Users\201-05\Desktop\VaccineDailyReport-main\

    target_sql = os.path.join(base_dir, "init.sql")
    # c:\Users\201-05\Desktop\VaccineDailyReport-main\frontend\src\sample_\issues_data.json
    target_json = os.path.join(project_root, "frontend", "src", "sample_", "issues_data.json")

    extractor.process_sql_file(target_sql, target_json)