"""
로그인 관련 라우터
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import bcrypt

from routers import get_db
from database.crud import get_user_by_login_id
from schemas import UserLoginRequest

router = APIRouter(tags=["Users"])


@router.post("/login")
def login(request: UserLoginRequest, db: Session = Depends(get_db)):
    """
    로그인을 합니다. ID나 비밀번호가 맞는지 비교하며, 응답문은 JSON 형태입니다.
    JSON의 success 항목이 True면 로그인에 성공한 것입니다.
    """
    user = get_user_by_login_id(db, request.login_id)

    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 잘못되었습니다.")

    # bcrypt 해시는 "$2b$" 또는 "$2a$"로 시작함
    stored = user.password_hash
    is_bcrypt = stored.startswith("$2b$") or stored.startswith("$2a$")

    if is_bcrypt:
        # 이미 해시된 비밀번호 — bcrypt 검증
        if not bcrypt.checkpw(request.password.encode("utf-8"), stored.encode("utf-8")):
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 잘못되었습니다.")
    else:
        # 레거시 평문 비밀번호 — 직접 비교 후 자동 마이그레이션
        if stored != request.password:
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 잘못되었습니다.")
        # 로그인 성공 시 bcrypt로 자동 업그레이드
        user.password_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        db.commit()

    return {
        "success": True,
        "message": "로그인에 성공하였습니다!",
        "user_id": user.user_id,
        "login_id": user.login_id,
        "username": user.username,
    }
