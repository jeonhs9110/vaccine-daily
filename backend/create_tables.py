"""
DB 테이블 생성 스크립트
"""
from database.engine import engine
from database.models import Base

print("=" * 80)
print("[DB] 테이블 생성 시작...")
print("=" * 80)

try:
    Base.metadata.create_all(bind=engine)
    print("\n[SUCCESS] 모든 테이블이 생성되었습니다!")

    # 생성된 테이블 목록 출력
    print("\n[생성된 테이블 목록]")
    for table in Base.metadata.sorted_tables:
        print(f"  - {table.name}")

    print("\n" + "=" * 80)

except Exception as e:
    print(f"\n[ERROR] 테이블 생성 실패: {e}")
    import traceback
    traceback.print_exc()
