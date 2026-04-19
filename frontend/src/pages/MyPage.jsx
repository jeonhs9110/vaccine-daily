import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { HiOutlineUser, HiOutlineChartPie, HiArrowRightOnRectangle, HiHeart, HiBookmark, HiOutlineFaceFrown } from "react-icons/hi2";

// 공통 컴포넌트
import Logo from '../components/Logo';
import UserMenu from '../components/UserMenu';
import Header from '../components/Header';
import Searchbar from '../components/Searchbar';

import CategoryRadarChart from '../components/CategoryRadarChart';
import KeywordBarChart from '../components/KeywordBarChart';
import SubscribedKeywords from '../components/SubscribedKeywords';
import EditAccountForm from '../components/EditAccountForm';
import { useToast } from '../components/Toast';
import MobileBottomNav from '../components/MobileBottomNav';
import './MyPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const ArticleCard = ({ article, type, onRemove }) => {
  // type: 'liked' or 'scrapped'
  const dateStr = new Date(article.created_at).toLocaleDateString();

  // Parse keywords if needed
  let parsedKeywords = [];
  if (Array.isArray(article.keywords)) {
    parsedKeywords = article.keywords;
  } else if (typeof article.keywords === 'string') {
    try { parsedKeywords = JSON.parse(article.keywords); } catch { }
  }
  const topKeywords = parsedKeywords.slice(0, 3).map(k => k.text || k).join(', ');

  return (
    <div className="article-card">
      <Link to={`/article/${article.report_id}`} className="article-card-link">
        <div className="article-card-header">
          <span className="article-card-cat">{article.category_name || '일반'}</span>
          <span className="article-card-date">{dateStr}</span>
        </div>
        <h3 className="article-card-title">{article.title}</h3>
        {topKeywords && <div className="article-card-keywords">#{topKeywords}</div>}
      </Link>
      <button
        className={`card-remove-btn ${type}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(article.report_id);
        }}
        title={type === 'liked' ? "좋아요 취소" : "스크랩 취소"}
      >
        {type === 'liked' ? <HiHeart /> : <HiBookmark />}
      </button>
    </div>
  );
};

const MyPage = () => {
  const { login_id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'insights'; // 'insights' | 'edit' | 'liked' | 'scraps'

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // New States for lists
  const [likedArticles, setLikedArticles] = useState([]);
  const [scrappedArticles, setScrappedArticles] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const MY_CATEGORIES = ['정치', '경제', '사회', 'IT/과학', '세계'];

  // 데이터 로딩
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!login_id) {
          setLoading(false);
          return;
        }
        const response = await axios.get(`${API_BASE_URL}/users/${login_id}/dashboard`);
        setUserData(response.data);
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
        setUserData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [login_id]);

  // Tab Data Fetching
  useEffect(() => {
    const fetchTabData = async () => {
      if (!login_id) return;

      setListLoading(true);
      try {
        if (activeTab === 'liked') {
          const res = await axios.get(`${API_BASE_URL}/users/${login_id}/liked-news`);
          setLikedArticles(res.data);
        } else if (activeTab === 'scraps') {
          const res = await axios.get(`${API_BASE_URL}/users/${login_id}/scrapped-news`);
          setScrappedArticles(res.data);
        }
      } catch (err) {
        console.error("탭 데이터 로딩 실패:", err);
      } finally {
        setListLoading(false);
      }
    };

    if (['liked', 'scraps'].includes(activeTab)) {
      fetchTabData();
    }
  }, [activeTab, login_id]);


  // 애니메이션 트리거
  useEffect(() => {
    if (!loading && activeTab === 'insights') {
      const timer = setTimeout(() => setIsActive(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, activeTab]);

  // 차트 최대치 계산
  const dynamicLimit = useMemo(() => {
    const values = Object.values(userData?.read_categories || {});
    return values.length > 0 ? Math.max(...values) + 10 : 100;
  }, [userData]);

  // 서버 업데이트 로직 (Keyword)
  const updateKeywordsOnServer = async (newList) => {
    try {
      await axios.put(`${API_BASE_URL}/users/${login_id}`, { subscribed_keywords: newList });
    } catch (error) {
      console.error("서버 업데이트 실패:", error);
      const errorMessage = error.response?.data?.detail || "서버 업데이트에 실패했습니다.";
      showToast(errorMessage, "error");
      try {
        const response = await axios.get(`${API_BASE_URL}/users/${login_id}/dashboard`);
        setUserData(response.data);
      } catch (refetchError) {
        console.error("데이터 재로딩 실패:", refetchError);
      }
    }
  };

  const handleDeleteKeyword = (target) => {
    const newList = userData.subscribed_keywords.filter(k => k !== target);
    setUserData({ ...userData, subscribed_keywords: newList });
    updateKeywordsOnServer(newList);
  };

  const handleAddKeyword = (newKeyword) => {
    if (newKeyword && !userData.subscribed_keywords.includes(newKeyword)) {
      const newList = [...userData.subscribed_keywords, newKeyword];
      setUserData({ ...userData, subscribed_keywords: newList });
      updateKeywordsOnServer(newList);
    }
  };

  const handleResetKeywords = async () => {
    if (!window.confirm('모든 관심 키워드 기록을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const encodedLoginId = encodeURIComponent(login_id);
      const apiUrl = `${API_BASE_URL}/users/${encodedLoginId}/keywords/stats`;
      await axios.delete(apiUrl);
      setUserData({ ...userData, read_keywords: {} });
      showToast('관심 키워드가 초기화되었습니다.', "success");
    } catch (error) {
      showToast(`초기화에 실패했습니다. ${error.response?.data?.detail || error.message}`, "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user_id');
    localStorage.removeItem('login_id');
    localStorage.removeItem('username');
    navigate('/');
    window.location.reload();
  };

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  // Remove Handlers
  const handleRemoveLike = async (newsId) => {
    try {
      await axios.post(`${API_BASE_URL}/news/${newsId}/reaction?value=1&login_id=${login_id}`);
      setLikedArticles(prev => prev.filter(a => a.report_id !== newsId));
      showToast("좋아요가 취소되었습니다.", "success");
    } catch (err) {
      console.error("좋아요 취소 실패:", err);
      showToast("처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleRemoveScrap = async (newsId) => {
    try {
      await axios.post(`${API_BASE_URL}/users/${login_id}/scraps`, { report_id: newsId });
      setScrappedArticles(prev => prev.filter(a => a.report_id !== newsId));
      showToast("스크랩이 취소되었습니다.", "success");
    } catch (err) {
      console.error("스크랩 취소 실패:", err);
      showToast("처리 중 오류가 발생했습니다.", "error");
    }
  };

  // if (loading) return <div className="loading-state">데이터 로딩 중...</div>; // Removed global loading

  return (
    <div className="mypage-container-new">
      <Header
        leftChild={null}
        midChild={<Logo />}
        rightChild={
          <div className="header-right-group">
            <div className="header-search-wrapper">
              <Searchbar className="always-open rounded-search" />
            </div>
            <UserMenu className="rounded-user-menu" />
          </div>
        }
        headerTop="on"
        headerMain="on"
        headerBottom="on"
      />

      <main className="mypage-content-wrapper">
        {/* Sidebar */}
        <aside className="mypage-sidebar">
          {/* Mobile Dropdown */}
          <select
            className="mobile-dropdown"
            value={activeTab}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'logout') handleLogout();
              else handleTabChange(val);
            }}
          >
            <option value="insights">나의 인사이트</option>
            <option value="liked">좋아요 누른 기사</option>
            <option value="scraps">스크랩한 기사</option>
            <option value="edit">정보수정</option>
            <option value="logout">로그아웃</option>
          </select>

          <div className="sidebar-group">
            <h2 className="sidebar-title">설정</h2>
            <nav className="sidebar-nav">
              <button
                className={`sidebar-item ${activeTab === 'insights' ? 'active' : ''}`}
                onClick={() => handleTabChange('insights')}
              >
                <HiOutlineChartPie className="sidebar-icon" />
                나의 인사이트
              </button>
              <button
                className={`sidebar-item ${activeTab === 'liked' ? 'active' : ''}`}
                onClick={() => handleTabChange('liked')}
              >
                <HiHeart className="sidebar-icon" />
                좋아요 누른 기사
              </button>
              <button
                className={`sidebar-item ${activeTab === 'scraps' ? 'active' : ''}`}
                onClick={() => handleTabChange('scraps')}
              >
                <HiBookmark className="sidebar-icon" />
                스크랩한 기사
              </button>
              <button
                className={`sidebar-item ${activeTab === 'edit' ? 'active' : ''}`}
                onClick={() => handleTabChange('edit')}
              >
                <HiOutlineUser className="sidebar-icon" />
                정보수정
              </button>
            </nav>
          </div>
          <div className="sidebar-group bottom">
            <nav className="sidebar-nav">
              <button className="sidebar-item logout" onClick={handleLogout}>
                <HiArrowRightOnRectangle className="sidebar-icon" />
                로그아웃
              </button>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="mypage-main-area">
          {loading ? (
            <div className="loading-state-embedded">
              <div className="spinner"></div>
              <p>데이터를 불러오는 중입니다...</p>
            </div>
          ) : (
            <>
              {activeTab === 'insights' && (
                <div className="insights-view fade-in">
                  <div className="profile-header-simple">
                    <h1 className="text-xl font-bold">{userData?.username} 님의 인사이트</h1>
                    <p className="text-gray-400 text-sm mt-1">{userData?.email}</p>
                  </div>

                  <div className="charts-grid">
                    <CategoryRadarChart
                      title="나의 관심 카테고리"
                      labels={MY_CATEGORIES}
                      targetScores={userData?.read_categories}
                      dynamicLimit={dynamicLimit}
                      isActive={isActive}
                    />
                    <KeywordBarChart
                      readKeywords={userData?.read_keywords}
                      isActive={isActive}
                      onReset={handleResetKeywords}
                    />
                  </div>

                  <SubscribedKeywords
                    keywords={userData?.subscribed_keywords}
                    isEditMode={isEditMode}
                    onToggleEdit={() => setIsEditMode(!isEditMode)}
                    onDelete={handleDeleteKeyword}
                    onAdd={handleAddKeyword}
                  />
                </div>
              )}

              {activeTab === 'liked' && (
                <div className="list-view fade-in">
                  <div className="profile-header-simple">
                    <h1 className="text-xl font-bold">좋아요 누른 기사</h1>
                    <p className="text-gray-400 text-sm mt-1">회원님이 좋아요를 누른 기사 목록입니다.</p>
                  </div>
                  {listLoading ? (
                    <div className="loading-text">로딩 중...</div>
                  ) : likedArticles.length === 0 ? (
                    <div className="empty-state">
                      <HiOutlineFaceFrown size={48} color="#ddd" />
                      <p>좋아요를 누른 기사가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="article-grid">
                      {likedArticles.map(article => (
                        <ArticleCard
                          key={article.report_id}
                          article={article}
                          type="liked"
                          onRemove={handleRemoveLike}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'scraps' && (
                <div className="list-view fade-in">
                  <div className="profile-header-simple">
                    <h1 className="text-xl font-bold">스크랩한 기사</h1>
                    <p className="text-gray-400 text-sm mt-1">나중에 읽기 위해 저장한 기사입니다.</p>
                  </div>
                  {listLoading ? (
                    <div className="loading-text">로딩 중...</div>
                  ) : scrappedArticles.length === 0 ? (
                    <div className="empty-state">
                      <HiOutlineFaceFrown size={48} color="#ddd" />
                      <p>스크랩한 기사가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="article-grid">
                      {scrappedArticles.map(article => (
                        <ArticleCard
                          key={article.report_id}
                          article={article}
                          type="scrapped"
                          onRemove={handleRemoveScrap}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'edit' && (
                <div className="edit-view fade-in">
                  <EditAccountForm
                    loginId={login_id}
                    onUpdateSuccess={() => {
                      axios.get(`${API_BASE_URL}/users/${login_id}/dashboard`)
                        .then(res => setUserData(res.data));
                    }}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <MobileBottomNav />
    </div>
  );
};

export default MyPage;
