from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr
from datetime import datetime


# --- [Pydantic Models] Frontend Data Definitions ---
class NewsResponse(BaseModel):
    """
    뉴스 기사 응답 스키마

    news_id: 기사 ID
    title: 기사 제목
    contents: 기사 내용 (옵션)
    img_urls: 기사 내 사진 URL 목록 (옵션)
    url: 기사 URL
    company_name: 언론사명 (Company 테이블의 name)
    created_at: 기사 발행 시각
    is_domestic: bool
    """

    news_id: int
    title: Optional[str] = None
    contents: Optional[str] = None
    img_urls: Optional[List[str]] = None
    url: str
    company_name: Optional[str] = None  # 모델에서는 relation이지만, 응답엔 이름만 줘도 무방
    created_at: datetime
    is_domestic: bool

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    """
    AI 생성 기사 (Report) 응답 스키마

    report_id: 기사 ID
    title: 기사 제목
    contents: 기사 내용
    created_at: 기사 생성 시각
    analysis_result: AI 비교분석 (JSON)
    keywords: 키워드 (JSON)
    category_id: 카테고리 ID (옵션)
    category_name: 카테고리 이름 (옵션)
    """

    report_id: int
    cluster_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    title: Optional[str] = None
    contents: Optional[str] = None
    created_at: datetime
    analysis_result: Optional[Any]
    keywords: Optional[List[Dict[str, Any]]] = None
    image: Optional[str] = None  # Representative image URL

    # 반응/조회수 (옵션)

    # 반응/조회수 (옵션)
    like_count: int = 0
    dislike_count: int = 0

    class Config:
        from_attributes = True


# IssueResponse is essentially the same structure, often used for newly created issues
class IssueResponse(BaseModel):
    """
    AI 생성 기사 (Report) 응답 스키마 (IssueResponse)

    report_id: 기사 ID
    title: 기사 제목
    contents: 기사 내용

    ...
    """

    report_id: int
    cluster_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    title: Optional[str] = None
    contents: Optional[str] = None
    created_at: datetime
    analysis_result: Optional[Any]
    keywords: Optional[List[Dict[str, Any]]] = None

    # 반응/조회수 (옵션)
    like_count: int = 0
    dislike_count: int = 0

    class Config:
        from_attributes = True


# --- User Schemas (Restored) ---


class UserCreateRequest(BaseModel):
    login_id: str
    password_hash: str  # Frontend sends password in this field
    username: str
    email: str
    age_range: str
    gender: str
    subscribed_categories: Optional[List[str]] = []
    subscribed_keywords: Optional[List[str]] = []


class UserLoginRequest(BaseModel):
    login_id: str
    password: str


class UserFindIdRequest(BaseModel):
    username: str
    email: str


class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    age_range: Optional[str] = None
    gender: Optional[str] = None
    subscribed_categories: Optional[List[str]] = None
    subscribed_keywords: Optional[List[str]] = None


class UserResponse(BaseModel):
    user_id: int
    login_id: str
    username: Optional[str] = None
    email: Optional[str] = None
    user_status: int
    created_at: datetime
    subscribed_categories: List[str] = []
    subscribed_keywords: List[str] = []
    scraps: Optional[List[str]] = []

    class Config:
        from_attributes = True


class ScrapRequest(BaseModel):
    url: Optional[str] = None
    report_id: Optional[int] = None


class UserDashboardResponse(BaseModel):
    username: Optional[str]
    email: Optional[str]
    read_categories: Dict[str, int]
    read_keywords: Dict[str, int]
    subscribed_keywords: List[str]


class LogViewRequest(BaseModel):
    # Placeholder if needed by logging endpoints
    log_id: Optional[int] = None


# --- Demographics Schemas ---
class DemographicsData(BaseModel):
    """연령대별 조회 통계"""
    age: str
    count: int


class GenderData(BaseModel):
    """성별 조회 통계"""
    gender: str
    count: int


class ReaderDemographicsResponse(BaseModel):
    """기사 조회자 인구통계 응답"""
    age_distribution: List[DemographicsData]
    gender_distribution: List[GenderData]

