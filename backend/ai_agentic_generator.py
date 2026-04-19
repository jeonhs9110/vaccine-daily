import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


def generate_agentic_article(model_name: str, cluster_topic: str, articles: list[dict]) -> dict:
    """
    Agentic Workflow (Writer -> Critic -> Editor) for generating high-quality news reports.

    Roles:
    1. Writer: Writes the initial draft based on source articles.
    2. Critic: Reviews the draft for factuality, neutrality, and missing info.
    3. Editor: Refines the draft if the Critic has feedback.
    """

    # 0) Pre-check
    model_name = (model_name or "").strip()
    if "gpt" not in model_name.lower():
        return {"title": "오류", "contents": f"⚠️ 지원되지 않는 모델: {model_name}", "search_keyword": ""}
    if not openai_client:
        return {"title": "오류", "contents": "⚠️ OpenAI API 키 없음", "search_keyword": ""}
    if not articles:
        return {"title": "오류", "contents": "⚠️ 원본 기사 없음", "search_keyword": ""}

    # 1) Prepare Context
    context_parts = []
    for idx, art in enumerate(articles, start=1):
        company = art.get("company_name", "언론사 미상")
        title = art.get("title", "제목 없음")
        contents = art.get("contents", "")
        time = art.get("time", "")
        context_parts.append(f"[{idx}] 언론사: {company} | 제목: {title}\n    시간: {time}\n    내용: {contents}\n")
    context_text = "\n".join(context_parts)

    print(f"   🤖 [Agentic] 주제: {cluster_topic}")

    # ======================================================================================
    # Step 1: Writer Agent (Initial Draft)
    # ======================================================================================
    writer_system = (
        "You are a professional news reporter in Korea. Your task is to read multiple source articles and write an objective and balanced comprehensive news report **in Korean**."
        "Never write in English. All responses must be in JSON format."
    )
    writer_prompt = f"""
Topic: '{cluster_topic}'

Source Articles:
{context_text}

Task: Synthesize the above articles into a single complete news report **in Korean**.

Mandatory Requirements:
1. **Fact-based**: Never add information not present in the provided articles.
2. **Korean Writing**: All content MUST be written in Korean.
3. **Structure**: Write as natural flowing paragraphs. Do NOT use section headers, labels, or markers like 【헤드라인】, 【리드】, 【본문】, [Headline], [Lead], etc. Start with the most important fact, then provide context and details across multiple paragraphs.
4. **Neutrality**: Exclude emotional expressions; maintain a dry reporting style.
5. **Remove Multimedia References**: Remove expressions like "Photo above", "Video", "Table", "As seen in the picture", etc.

Output JSON Format:
{{
    "title": "Korean Headline (MUST be 50 characters or fewer)",
    "contents": "Full article body written in Korean",
    "search_keyword": "English Search Keyword (e.g., Samsung chip shortage)"
}}
"""

    draft_response = _call_llm(model_name, writer_system, writer_prompt, "json_object")
    draft_json = _safe_json_loads(draft_response)

    print(f"   📝 [Writer] 초안 생성: {draft_json.get('title', 'No Title')[:50]}")

    # ======================================================================================
    # Step 2: Critic Agent (Fact-Check & Review)
    # ======================================================================================
    critic_system = (
        "You are a strict Editor-in-Chief and Fact-Checker. Verify the draft written by the reporter against the source articles."
        "If there are hallucinations, omissions, or bias, return FAIL. If perfect, return PASS. The response must be in JSON."
    )
    critic_prompt = f"""
Source Articles:
{context_text}

Reporter's Draft:
Title: {draft_json.get('title')}
Content: {draft_json.get('contents')}

Evaluation Criteria:
1. **Hallucination**: Did the reporter invent information not in the source?
2. **Omission**: Are important dates, numbers, or names missing?
3. **Neutrality**: Is it objective?

Output JSON Format:
{{
    "status": "PASS" or "FAIL",
    "feedback": "Specific correction instructions in English (Empty if PASS)"
}}
"""

    critic_response = _call_llm(model_name, critic_system, critic_prompt, "json_object")
    critic_json = _safe_json_loads(critic_response)

    print(f"   🧐 [Critic] 평가: {critic_json.get('status')} - {critic_json.get('feedback', '')[:50]}")

    # ======================================================================================
    # Step 3: Editor Agent (Refine if needed)
    # ======================================================================================
    if critic_json.get("status") == "FAIL":
        editor_system = (
            "You are a Senior Editor. Revise the article based on the critic's feedback. "
            "All content MUST be written in **Korean**. The response must be in JSON."
        )
        editor_prompt = f"""
Draft to Revise:
Title: {draft_json.get('title')}
Content: {draft_json.get('contents')}
English Keyword: {draft_json.get('search_keyword')}

Critic's Feedback (Must be addressed):
{critic_json.get('feedback')}

Source Articles (For Reference):
{context_text}

Task: Rewrite the article incorporating the critic's feedback.
**Caution: You MUST strictly follow the JSON output format below.**

Output JSON Format:
{{
    "title": "Revised Korean Headline (MUST be 50 characters or fewer)",
    "contents": "Revised Full Article Body in Korean",
    "search_keyword": "English Search Keyword"
}}
"""

        final_response = _call_llm(model_name, editor_system, editor_prompt, "json_object")
        final_json = _safe_json_loads(final_response)

        # Double check if keys exist, if not try to recover or log raw
        if final_json.get("title") == "제목 없음":
            print(f"   ⚠️ [Editor] JSON 키 누락/파싱 실패. Raw Response: {final_response}")

        print(f"   ✅ [Editor] 수정 완료: {final_json.get('title', 'No Title')[:50]}")
        return final_json
    else:
        print(f"   ✅ [Agentic] 초안 승인: {draft_json.get('title', 'No Title')[:50]}")
        return draft_json


def _call_llm(model, system, user, format_type):
    try:
        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
            response_format={"type": format_type},
        )
        content = response.choices[0].message.content
        # print(f"      [LLM] 응답 길이: {len(content)} chars")
        return content
    except Exception as e:
        print(f"   ⚠️ [LLM 오류]: {e}")
        return '{"title": "LLM 오류", "contents": "API 호출 실패", "search_keyword": ""}'


def _safe_json_loads(json_str):
    try:
        # 1. Markdown Code Block 제거 (```json ... ```)
        cleaned = json_str.strip()
        if cleaned.startswith("```"):
            # 첫 번째 줄 제거 (```json)
            parts = cleaned.split("\n", 1)
            if len(parts) > 1:
                cleaned = parts[1]
            # 마지막 줄 제거 (```)
            if cleaned.strip().endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]

        result = json.loads(cleaned)

        # 2. 구조 평탄화 ( {"article": {...}} 형태 대응 )
        if "title" not in result and len(result) == 1:
            first_key = list(result.keys())[0]
            if isinstance(result[first_key], dict) and "title" in result[first_key]:
                result = result[first_key]

        # Ensure all required keys exist
        if "title" not in result:
            result["title"] = "제목 없음"
        if "contents" not in result:
            result["contents"] = "내용 생성 실패"
        if "search_keyword" not in result:
            result["search_keyword"] = ""
        return result
    except Exception as e:
        # 여기서 에러나면 Raw String을 반환하지 않고, 에러 객체를 반환하되 내용은 유지
        print(f"   ⚠️ [JSON 파싱 Exception]: {e}")
        return {"title": "JSON 파싱 오류", "contents": json_str, "search_keyword": ""}
