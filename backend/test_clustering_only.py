"""
클러스터링만 테스트
"""
import sys
import io
import os

# Windows 콘솔에서 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 로컬 테스트를 위해 ChromaDB 모드를 로컬로 설정
os.environ["CHROMA_MODE"] = "local"

from dotenv import load_dotenv
load_dotenv(override=False)

from database.engine import SessionLocal
from clustering import run_issue_clustering

db = SessionLocal()

try:
    print("=" * 80)
    print("[TEST] 클러스터링 테스트 시작")
    print("=" * 80)

    print("\n클러스터링 실행 중...")
    run_issue_clustering(db, days=3)

    print("\n클러스터링 완료!")

    # 결과 확인
    from database.models import Cluster
    clusters = db.query(Cluster).all()
    print(f"\n생성된 클러스터: {len(clusters)}개")

    for i, cluster in enumerate(clusters[:5], 1):
        print(f"  {i}. {cluster.cluster_name}")
        print(f"     뉴스 개수: {len(cluster.news or [])}개")

except Exception as e:
    print(f"\n[ERROR] {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
