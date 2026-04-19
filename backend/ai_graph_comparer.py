import os
import json
import asyncio
from typing import List, Dict, Any
from collections import defaultdict
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(override=True)

api_key = os.getenv("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=api_key) if api_key else None
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ======================================================================================
# Core Logic: GraphRAG-Lite Comparator
# ======================================================================================


async def compare_articles_with_graph(articles: List[Dict[str, Any]], mode: str = "news") -> Dict[str, Any]:
    """
    Main entry point for GraphRAG comparison.
    mode="news":    팩트 기사 비교분석 → media_comparison_bullets
    mode="opinion": 오피니언/사설 비교분석 → opinion_bullets

    1. Group: Group articles by company.
    2. Extract: Extract triples from EVERY article individually (parallel).
    3. Normalize: Merge synonyms across all triples (dedup).
    4. Analyze: Compare stances on the same entities from the full graph.
    """
    label = "Opinion" if mode == "opinion" else "News"
    print(f"   [GraphRAG-{label}] Starting Comparative Analysis...")

    # 1. Group articles by company
    company_groups = defaultdict(list)
    for art in articles:
        c = art.get("company_name", "Unknown")
        company_groups[c].append(art)

    # 2. Extract triples from EVERY article individually (parallel)
    #    → 기사별 추출 후 언론사별로 합산 → 중복은 엔티티 정규화에서 자동 제거
    tasks = []
    task_meta = []  # (company, article_index) tracking
    for comp, arts in company_groups.items():
        for i, art in enumerate(arts):
            text = f"[제목] {art.get('title')}\n[본문] {art.get('contents', '')}"
            tasks.append(extract_triples(comp, text))
            task_meta.append(comp)

    print(f"   [GraphRAG-{label}] Extracting triples from {len(tasks)} articles across {len(company_groups)} companies...")
    results = await asyncio.gather(*tasks)

    # Merge triples by company
    all_triples_map = defaultdict(list)
    for comp, result in zip(task_meta, results):
        all_triples_map[comp].extend(result.get("triples", []))

    # 3. Entity Normalization
    # Collect all entities
    all_entities = set()
    for trips in all_triples_map.values():
        for t in trips:
            all_entities.add(t.get("subject"))
            all_entities.add(t.get("object"))

    entity_map = await normalize_entities(list(all_entities))

    # Apply normalization
    normalized_graph = defaultdict(list)  # { "CanonEntity": [ {company, predicate, original_entity} ] }

    for comp, trips in all_triples_map.items():
        for t in trips:
            subj = entity_map.get(t.get("subject"), t.get("subject"))
            # We focus on Subject-centric comparison for now
            normalized_graph[subj].append(
                {
                    "company": comp,
                    "predicate": t.get("predicate"),
                    "object": entity_map.get(t.get("object"), t.get("object")),
                    "sentiment": t.get("sentiment"),
                }
            )

    # 4. Generate Final Report
    report = await generate_graph_report(normalized_graph, company_groups.keys(), mode=mode)

    return report


# ======================================================================================
# Step 2: Extraction
# ======================================================================================
async def extract_triples(company: str, text: str) -> Dict[str, Any]:
    system_prompt = (
        "You are a Knowledge Graph Extractor. Extract key 'Entity-Relation-Entity' triples from the news article. "
        "Focus on the main political/economic actors and their specific actions or stances. "
        'Output JSON: { "triples": [ {"subject": "...", "predicate": "...", "object": "...", "sentiment": "positive/negative/neutral"} ] }'
    )
    user_prompt = f"""
    Press: {company}
    Article:
    {text[:4000]}

    Extract 3-7 key semantic triples from this single article.
    """

    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        data = json.loads(resp.choices[0].message.content)
        return {"company": company, "triples": data.get("triples", [])}
    except Exception as e:
        print(f"   [Graph] Extraction failed for {company}: {e}")
        return {"company": company, "triples": []}


# ======================================================================================
# Step 3: Normalization
# ======================================================================================
async def normalize_entities(entities: List[str]) -> Dict[str, str]:
    if not entities:
        return {}

    # Too many entities? Slice top 50 to save tokens based on simple heuristics if needed
    # For now, we assume manageable size (<100)
    entities_str = ", ".join(entities)

    system_prompt = (
        "You are an Entity Resolver. Group synonymous entities into a single canonical name. "
        "Map specific names to general representative names if they refer to the same person/org in this context. "
        'Output JSON: { "mapping": { "Variant": "Canonical", ... } }'
    )
    user_prompt = f"""
    Entities: {entities_str}
    
    Task: Return a mapping dictionary where keys are the input entities and values are their unified canonical names. 
    Only include pairs that need normalization. If an entity is already canonical, you can omit it.
    Example: {{ "Samsung Electronics": "Samsung", "Samsung": "Samsung", "Donald Trump": "Trump" }}
    """

    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        data = json.loads(resp.choices[0].message.content)
        return data.get("mapping", {})
    except:
        return {}


# ======================================================================================
# Step 4: Reporting
# ======================================================================================
async def generate_graph_report(graph: Dict[str, List[Dict]], companies: List[str], mode: str = "news") -> Dict[str, Any]:
    # Select Top 5 most discussed entities (keys with most list items)
    top_entities = sorted(graph.keys(), key=lambda k: len(graph[k]), reverse=True)[:5]

    # Serialize relevant subgraph
    graph_summary = ""
    for ent in top_entities:
        graph_summary += f"## Entity: {ent}\n"
        # Group by press to show contrast
        press_view = defaultdict(list)
        for edge in graph[ent]:
            press_view[edge["company"]].append(f"{edge['predicate']} -> {edge['object']} ({edge['sentiment']})")

        for press, views in press_view.items():
            graph_summary += f"  - {press}: {'; '.join(views)}\n"
        graph_summary += "\n"

    # mode에 따라 프롬프트 분기
    if mode == "opinion":
        output_key = "opinion_bullets"
        system_prompt = (
            "You are an Opinion/Editorial Analyst. Compare the editorial stances of different media outlets "
            "based on the provided Knowledge Graph data extracted from their opinion columns and editorials. "
            "Focus on the SUBJECTIVE positions, arguments, and editorial framing rather than factual reporting. "
            "The output MUST be in Korean. "
            "STRICTLY NO English words or parentheses in the output. "
            "Generate a structured JSON output with hashtags, a one-liner summary, and detailed evidence."
            f'Output JSON: {{ "{output_key}": [ {{ "company": "MediaName", "hashtags": ["#Keyword1", "#Keyword2", "#Keyword3"], "summary": "One sentence summary.", "evidence": "Detailed explanation supporting the summary." }}, ... ] }}'
        )

        user_prompt = f"""
    Media Outlets Involved: {", ".join(companies)}

    Key Entity Analysis (Graph Data from Opinion/Editorial Articles):
    {graph_summary}

    Task: Write a comparative analysis of editorial stances in Korean.

    Formatting Rules:
    1. **Structure**: Return a list of objects. Each object must have:
       - "company": The specific media outlet name.
       - "hashtags": A list of exactly 3 identifying keywords (Korean), starting with '#'. These should represent the editorial's unique ARGUMENTATIVE frame.
       - "summary": A SINGLE sentence summarizing their editorial stance/argument (max 15 words). MUST end with '~ㅂ니다' style. Focus on OPINION, not facts.
       - "evidence": A detailed explanation (2-3 sentences) supporting the summary with specific arguments from the editorials. MUST end with '~ㅂ니다' style.
    2. **Tone**: Polite and formal ('~ㅂ니다' style).

    Constraint Rules (CRITICAL):
    1. **NO English**: Do NOT use any English words in 'summary' or 'evidence'. Translate all terms to Korean.
    2. **NO Parentheses**: Do NOT use `( )` or `[ ]` in the text.
    3. Hashtags should represent the editorial's unique argumentative frames, NOT factual topics.
    4. The evidence should highlight the OPINION and ARGUMENT, citing specific stances from the graph.
    """
    else:
        output_key = "media_comparison_bullets"
        system_prompt = (
            "You are a News Analyst. Compare the viewpoints of different media outlets based on the provided Knowledge Graph data. "
            "The output MUST be in Korean. "
            "STRICTLY NO English words or parentheses in the output. "
            "Generate a structured JSON output with hashtags, a one-liner summary, and detailed evidence."
            f'Output JSON: {{ "{output_key}": [ {{ "company": "MediaName", "hashtags": ["#Keyword1", "#Keyword2", "#Keyword3"], "summary": "One sentence summary.", "evidence": "Detailed explanation supporting the summary." }}, ... ] }}'
        )

        user_prompt = f"""
    Media Outlets Involved: {", ".join(companies)}

    Key Entity Analysis (Graph Data):
    {graph_summary}

    Task: Write a comparative analysis in Korean. Focus on what makes EACH outlet's coverage UNIQUELY DIFFERENT from the others.

    Core Principle (CRITICAL):
    - First identify facts/angles that ALL outlets share (common ground).
    - Then for each outlet, find what ONLY THAT outlet emphasizes, frames differently, or includes exclusively.
    - NEVER describe a commonly shared fact as if it were a unique characteristic of one outlet.
    - When a clear unique angle EXISTS: describe it (unique facts, exclusive framing, distinct tone).
    - When NO clear unique angle exists: instead describe the outlet's NARRATIVE STRUCTURE — what topics it covers in what order, what it leads with, what it closes with, and how it organizes information. Even identical facts can be arranged differently.

    Formatting Rules:
    1. **Structure**: Return a list of objects. EXACTLY ONE object per media outlet. Each object must have:
       - "company": The specific media outlet name (always a single outlet, never grouped).
       - "hashtags": A list of exactly 3 identifying keywords (Korean), starting with '#'. These should capture the outlet's unique angle or narrative approach.
       - "summary": A SINGLE, punchy sentence summarizing their unique stance OR narrative approach (max 15 words). MUST end with '~ㅂ니다' style.
       - "evidence": A detailed explanation (2-3 sentences) supporting the summary. MUST end with '~ㅂ니다' style. When describing narrative structure, mention what the article leads with, how it develops, and what it emphasizes in closing.
    2. **Tone**: Polite and formal ('~ㅂ니다' style).

    Constraint Rules (CRITICAL):
    1. **NO English**: Do NOT use any English words in 'summary' or 'evidence'. Translate all terms to Korean.
    2. **NO Parentheses**: Do NOT use `( )` or `[ ]` in the text. Explain the context in words instead.
    3. Hashtags should represent the unique frames or narrative choices of each media outlet, not shared topics.
    4. Do NOT fabricate artificial differences. If the content is similar, focus on structural/organizational differences instead.
    """

    try:
        resp = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return json.loads(resp.choices[0].message.content)
    except:
        return {output_key: ["분석 실패: 데이터를 처리할 수 없습니다."]}


