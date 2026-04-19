"""
DB에 저장된 데이터 확인
"""
import sys
import io

# Windows 콘솔에서 UTF-8 출력 설정
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from database.engine import SessionLocal
from database.models import News, Report, Cluster
from datetime import datetime, timedelta

db = SessionLocal()

try:
    # 최근 1시간 동안 생성된 뉴스
    one_hour_ago = datetime.now() - timedelta(hours=1)
    recent_news = db.query(News).filter(News.created_at >= one_hour_ago).count()
    print(f"최근 1시간 동안 생성된 뉴스: {recent_news}개")

    # 전체 뉴스 개수
    total_news = db.query(News).count()
    print(f"전체 뉴스: {total_news}개")

    # 최근 뉴스 5개
    latest_news = db.query(News).order_by(News.created_at.desc()).limit(5).all()
    print(f"\n최근 뉴스 5개:")
    for i, news in enumerate(latest_news, 1):
        print(f"  {i}. [{news.company_name}] {news.title[:50]}...")
        print(f"     생성 시간: {news.created_at}")
        print(f"     카테고리: {news.category}")

    # Report (AI 생성 기사) 개수
    total_reports = db.query(Report).count()
    print(f"\n전체 AI 생성 리포트: {total_reports}개")

    # 최근 Report 5개
    latest_reports = db.query(Report).order_by(Report.created_at.desc()).limit(5).all()
    print(f"\n최근 AI 생성 리포트 5개:")
    for i, report in enumerate(latest_reports, 1):
        print(f"  {i}. [{report.report_id}] {report.title[:60]}...")
        print(f"     생성 시간: {report.created_at}")
        print(f"     내용 길이: {len(report.contents or '')}자")
        print(f"     분석 결과: {'있음' if report.analysis_result else '없음'}")
        if report.analysis_result:
            keys = list(report.analysis_result.keys()) if isinstance(report.analysis_result, dict) else []
            print(f"     분석 결과 키: {keys[:5]}")  # 처음 5개만

    # Cluster 개수
    total_clusters = db.query(Cluster).count()
    print(f"\n전체 클러스터: {total_clusters}개")

    # 최근 Cluster 5개
    latest_clusters = db.query(Cluster).order_by(Cluster.created_at.desc()).limit(5).all()
    print(f"\n최근 클러스터 5개:")
    for i, cluster in enumerate(latest_clusters, 1):
        print(f"  {i}. [{cluster.cluster_id}] {cluster.cluster_name[:60]}...")
        print(f"     생성 시간: {cluster.created_at}")
        print(f"     포함된 뉴스: {len(cluster.news or [])}개")

finally:
    db.close()
