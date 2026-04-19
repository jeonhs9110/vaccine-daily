from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    ForeignKey,
    DateTime,
    JSON,
    Enum,
    Table,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.ext.hybrid import hybrid_property

Base = declarative_base()

# -------------------------
# Cluster <-> News (M:N)
# -------------------------
cluster_news_link = Table(
    "cluster_news_link",
    Base.metadata,
    Column("cluster_id", ForeignKey("clusters.cluster_id", ondelete="CASCADE"), primary_key=True),
    Column("news_id", ForeignKey("news.news_id", ondelete="CASCADE"), primary_key=True),
)


class Company(Base):
    __tablename__ = "companies"

    company_id = Column(Integer, primary_key=True)
    # DB에서 표준으로 쓰는 이름(중복 방지용)
    name = Column(String(100), unique=True, nullable=False, index=True)

    # UI에 보여줄 이름이 따로 필요하면(선택)
    display_name = Column(String(100), nullable=True)

    news = relationship("News", back_populates="company", lazy="selectin")


class Cluster(Base):
    __tablename__ = "clusters"

    cluster_id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)

    news = relationship(
        "News",
        secondary=cluster_news_link,
        back_populates="clusters",
        lazy="selectin",
    )

    reports = relationship(
        "Report",
        back_populates="cluster",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class News(Base):
    __tablename__ = "news"

    news_id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=True)
    contents = Column(Text, nullable=True)

    url = Column(String, unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.company_id", ondelete="RESTRICT"), nullable=False, index=True)
    company = relationship("Company", back_populates="news")

    img_urls = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    is_domestic = Column(Boolean, default=True, index=True)
    is_opinion = Column(Boolean, default=False, index=True)
    author = Column(String(100), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True, index=True)
    category = relationship("Category")

    clusters = relationship(
        "Cluster",
        secondary=cluster_news_link,
        back_populates="news",
        lazy="selectin",
    )

    @hybrid_property
    def company_name(self):
        return self.company.name if self.company else None


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(Integer, ForeignKey("clusters.cluster_id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="RESTRICT"), nullable=True, index=True)

    title = Column(String, nullable=True)
    contents = Column(Text, nullable=True)

    search_keyword = Column(String, nullable=True)
    global_search_status = Column(String, default="PENDING")
    search_retry_count = Column(Integer, default=0)

    keywords = Column(JSON, nullable=True)
    analysis_result = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    # 캐시 컬럼(선택)
    like_count = Column(Integer, default=0, nullable=False)
    dislike_count = Column(Integer, default=0, nullable=False)

    cluster = relationship("Cluster", back_populates="reports")
    category = relationship("Category", backref="reports")

    reactions = relationship("NewsReaction", back_populates="report", cascade="all, delete-orphan")
    views = relationship("NewsView", back_populates="report", cascade="all, delete-orphan")


# -------------------------
# User
# -------------------------
class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)
    login_id = Column(String(50), unique=True, nullable=False, index=True)

    username = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), nullable=True)

    age_range = Column(String(30), nullable=True)
    gender = Column(String(30), nullable=True)
    
    # List of scraped news IDs/URLs
    scraps = Column(JSON, default=[], nullable=True)

    # fcm_token removed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    # marketing_agree removed

    user_status = Column(Integer, default=1, nullable=False)

    reactions = relationship("NewsReaction", back_populates="user", cascade="all, delete-orphan")
    views = relationship("NewsView", back_populates="user", cascade="all, delete-orphan")
    searches = relationship("SearchLog", back_populates="user", cascade="all, delete-orphan")

    keyword_stats = relationship(
        "KwStat",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    subscribed_categories = relationship(
        "Category", secondary="ctgr_sub", back_populates="subscribers"
    )
    keyword_subscriptions = relationship(
        "KwSub",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class KwSub(Base):
    __tablename__ = "kw_sub"

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    keyword = Column(String(200), primary_key=True)

    user = relationship("User", back_populates="keyword_subscriptions")


# -------------------------
# Like/Dislike (Report 기준)
# -------------------------
class NewsReaction(Base):
    __tablename__ = "news_reactions"

    news_reaction_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    news_id = Column(
        Integer, ForeignKey("reports.report_id", ondelete="CASCADE"), nullable=False, index=True
    )

    value = Column(Integer, nullable=False)  # 1=like, -1=dislike

    user = relationship("User", back_populates="reactions")
    report = relationship("Report", back_populates="reactions")

    __table_args__ = (
        UniqueConstraint("user_id", "news_id", name="uq_user_news_reaction"),
        CheckConstraint("value in (1, -1)", name="ck_reaction_value"),
    )


# -------------------------
# View History (Report id 기반)
# -------------------------
class NewsView(Base):
    __tablename__ = "news_views"

    news_view_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    news_id = Column(
        Integer, ForeignKey("reports.report_id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id = Column(Integer, ForeignKey("categories.category_id", ondelete="SET NULL"), nullable=True, index=True)

    __table_args__ = (UniqueConstraint("user_id", "news_id", name="uq_user_news_view"),)

    viewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="views")
    report = relationship("Report", back_populates="views")


# -------------------------
# Search History
# -------------------------
class SearchLog(Base):
    __tablename__ = "search_logs"

    search_log_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)

    query = Column(String(255), nullable=False)
    searched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="searches")


# -------------------------
# Category / Keyword + Subscriptions
# -------------------------
class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False, index=True)

    subscribers = relationship("User", secondary="ctgr_sub", back_populates="subscribed_categories")


ctgr_sub = Table(
    "ctgr_sub",
    Base.metadata,
    Column("user_id", ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.category_id", ondelete="CASCADE"), primary_key=True),
)


# -------------------------
# Read stats
# -------------------------


class KwStat(Base):
    __tablename__ = "kw_stats"

    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    keyword = Column(String(200), primary_key=True)
    count = Column(Integer, default=0, nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="keyword_stats")
