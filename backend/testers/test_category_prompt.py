import sys
import os
import asyncio

# Ensure backend modules can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_report_comparer import build_company_system_prompt, CATEGORY_PROMPTS


def test_prompts():
    print("Testing Category Prompts...")

    # Test Politics
    prompt_politics = build_company_system_prompt("정치")
    if "정치적 역학 관계" in prompt_politics:
        print("[PASS] Politics prompt generated correctly.")
    else:
        print("[FAIL] Politics prompt missing key phrases.")

    # Test Economy
    prompt_economy = build_company_system_prompt("경제")
    if "시장 동향, 기업 전략" in prompt_economy:
        print("[PASS] Economy prompt generated correctly.")
    else:
        print("[FAIL] Economy prompt missing key phrases.")

    # Test Default
    prompt_default = build_company_system_prompt(None)
    if "사실 관계를 중심으로" in prompt_default:
        print("[PASS] Default prompt generated correctly.")
    else:
        print("[FAIL] Default prompt missing key phrases.")

    # Test Unknown Category (should use Default)
    prompt_unknown = build_company_system_prompt("UnknownCategory")
    if "사실 관계를 중심으로" in prompt_unknown:
        print("[PASS] Unknown category falls back to default correctly.")
    else:
        print("[FAIL] Unknown category fallback failed.")


if __name__ == "__main__":
    test_prompts()
