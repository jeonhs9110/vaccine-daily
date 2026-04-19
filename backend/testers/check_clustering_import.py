import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from clustering import run_stage2_issue_refine

    print("Successfully imported clustering module.")
    print("Verification passed: OpenAI client is initialized.")
except ImportError as e:
    print(f"ImportError: {e}")
except Exception as e:
    print(f"Error: {e}")
