"""
공통 의존성 및 유틸리티
"""

from fastapi import Depends
from sqlalchemy.orm import Session
from database.engine import SessionLocal


def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
