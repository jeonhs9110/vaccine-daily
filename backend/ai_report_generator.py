import os
import re
import json
from openai import OpenAI
from dotenv import load_dotenv


load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def generate_balanced_article(model_name: str, cluster_topic: str, articles: list[dict]) -> str:
    """
    cluster_topic: 해당 군집의 주제 (예: 'IT/과학', '경제')
    articles: 해당 군집에 속한 기사 리스트
    """

    model_name = (model_name or "").strip()

    # 0) 사전 체크
    if "gpt" not in model_name.lower():
        return f"⚠️ 지원되지 않는 모델입니다: {model_name} (현재 GPT만 지원)"
    if not openai_client:
        return "⚠️ OpenAI 키 없음"
    if not articles:
        return "⚠️ 기사 소스가 비어 있습니다."

    # 1) 기사 내용 합치기
    context_parts = []
    for idx, art in enumerate(articles, start=1):
        company = art.get("company_name", "언론사 미상")
        title = art.get("title", "제목 없음")
        contents = art.get("contents", "")
        context_parts.append(f"[{idx}] 언론사: {company} | 제목: {title}\n    내용: {contents}\n")
    context_text = "\n".join(context_parts)

    # ------------------------------------------------------------------
    # [Agent 1] Writer Agent (Drafting)
    # ------------------------------------------------------------------
    def generate_draft():
        system_role = (
            "You are a 'fact-based' **Senior Reporter** writing straight news. "
            "Combine the facts from the provided source articles to write the most objective and dry news report."
        )
        user_prompt = f"""
Topic: {cluster_topic}
Source Articles:
{context_text}

[Instructions]
1. Synthesize all articles, avoiding duplication.
2. Exclude subjective interpretations or emotional expressions from specific media outlets; focus on facts.
3. Structure: Headline -> Lead -> Body -> Conclusion (Do NOT use labels like '[Lead]', '[Body]')
4. **Formatting**: Group related sentences into paragraphs (3-5 sentences per paragraph). Do NOT start a new line for every sentence.
5. **Language**: The articles must be written in **Korean**.

Response must be in JSON format only:
{{
    "title": "Headline in Korean (MUST be 50 characters or fewer)",
    "contents": "Article Body in Korean"
}}
"""
        return openai_client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_role}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

    # ------------------------------------------------------------------
    # [Agent 2] Critic Agent (Critique & Verification)
    # ------------------------------------------------------------------
    def generate_critique(draft_title, draft_contents):
        system_role = (
            "You are a strict and sharp **News Desk Editor (Critic)**. "
            "Review the drafted article for factual errors, bias, duplication, and sentence flow."
        )
        user_prompt = f"""
[Draft to Review]
Title: {draft_title}
Content: {draft_contents}

[Original Source Data]
{context_text}

[Evaluation Criteria]
1. **Fact Verification**: Is there any content not found in the source?
2. **Neutrality**: Is it biased towards a specific stance?
3. **Readability**: Are the sentences smooth and free of redundancy?
4. **Structure**: Is the news format (Lead, Body, etc.) appropriate?

Please provide **specific revision instructions** in English based on the above criteria.
If there are no issues, say "No specific revisions needed".
"""
        return openai_client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_role}, {"role": "user", "content": user_prompt}],
            temperature=0.1,
        )

    # ------------------------------------------------------------------
    # [Agent 3] Refiner Agent (Final Polish)
    # ------------------------------------------------------------------
    def generate_final(draft_title, draft_contents, critique):
        system_role = (
            "You are the **Editor-in-Chief**. "
            "Refine the article to perfection by accepting the Critic's feedback. "
            "Also, extract one key English search keyword for global readers."
        )
        user_prompt = f"""
[Draft]
Title: {draft_title}
Content: {draft_contents}

[Critic's Feedback]
{critique}

Refine the article by reflecting the above feedback.
**Language**: The final output must be in **Korean**.
**Formatting**: Ensure the text is divided into paragraphs of appropriate length (3-5 sentences). Do NOT make every sentence a new paragraph. REMOVE any structural labels.
Especially, remove all multimedia reference phrases like "as seen in the video", "as shown in the photo".

[Output Format - JSON]
{{
    "title": "Final Revised Headline (Korean, MUST be 50 characters or fewer)",
    "contents": "Final Revised Body (Korean)",
    "search_keyword": "English Search Keyword (e.g., Samsung earnings shock)"
}}
"""
        return openai_client.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_role}, {"role": "user", "content": user_prompt}],
            response_format={"type": "json_object"},
            temperature=0.2,
        )

    # ------------------------------------------------------------------
    # [Orchestration] 실행 파이프라인
    # ------------------------------------------------------------------
    try:
        # 1. Draft
        # 1. Draft
        print("[Writer] 초안 작성 중...")
        draft_resp = generate_draft()
        draft_data = json.loads(draft_resp.choices[0].message.content)

        # 2. Critique
        # 2. Critique
        print("[Critic] 기사 비평 및 검증 중...")
        critic_resp = generate_critique(draft_data.get("title"), draft_data.get("contents"))
        feedback = critic_resp.choices[0].message.content
        feedback = critic_resp.choices[0].message.content
        print(f"[Critic Feedback]: {feedback}")

        # 3. Refine
        # 3. Refine
        print("[Refiner] 최종 기사 편집 중...")
        final_resp = generate_final(draft_data.get("title"), draft_data.get("contents"), feedback)
        final_data = json.loads(final_resp.choices[0].message.content)

        return final_data

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback

        traceback.print_exc()
        return {"title": "생성 실패", "contents": f"AI 처리 중 오류가 발생했습니다: {str(e)}", "search_keyword": ""}
