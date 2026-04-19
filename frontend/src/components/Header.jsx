import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Header.css';
import { categories } from './categoryIcon/categoryData';
import Logo from './Logo';
import sampleArticles from '../sample_/sampleArticle.json';

import Weather from './Weather';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Header = ({
  className = "",
  leftChild,
  midChild,
  rightChild,
  darkmode,
  headerTop = "on",
  headerMain = "on",
  headerBottom = "on",
  noSearchMobile = false
}) => {
  const nav = useNavigate();
  const location = useLocation();
  const { name: paramName } = useParams();

  // Custom logic to determine active category based on path
  const getActiveCategory = (pathname) => {
    if (pathname === '/') return '홈'; // Optional: if you want Home to be active
    if (pathname.includes('/politics')) return '정치';
    if (pathname.includes('/economy')) return '경제';
    if (pathname.includes('/society')) return '사회';
    if (pathname.includes('/science')) return 'IT/과학';
    if (pathname.includes('/world')) return '세계';
    return paramName || ''; // Fallback to param if exists
  };

  const activeCategory = getActiveCategory(location.pathname);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    // 1. AI 뉴스 가져오기
    const fetchNews = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/reports?limit=5`);
        if (res.data && res.data.length > 0) {
          setArticles(res.data);
        } else {
          // Fallback if no news
          setArticles(sampleArticles);
        }
      } catch (err) {
        console.error("AI 뉴스 로딩 실패, 샘플 데이터 사용", err);
        setArticles(sampleArticles);
      }
    };
    fetchNews();
  }, []);

  // Use extended articles for infinite loop (clone first item at the end)
  const extendedArticles = articles.length > 0 ? [...articles, articles[0]] : [];

  useEffect(() => {
    const timer = setInterval(() => {
      if (articles.length > 0) {
        setCurrentArticleIndex((prevIndex) => prevIndex + 1);
      }
    }, 3000); // 3초 간격
    return () => clearInterval(timer);
  }, [articles]);

  useEffect(() => {
    // If we reached the cloned item (last index)
    if (currentArticleIndex === articles.length && articles.length > 0) {
      // Wait for the slide transition to finish (e.g. 500ms), then snap back to 0 without transition
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentArticleIndex(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [currentArticleIndex, articles]);

  useEffect(() => {
    // If we snapped back to 0 and transition is off, turn it back on shortly after
    if (currentArticleIndex === 0 && !isTransitioning) {
      const timeout = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [currentArticleIndex, isTransitioning]);

  return (
    <div className={`Header-Container ${className} ${location.pathname !== '/' ? 'is-category-page' : ''}`}>

      {headerTop === "on" && (
        <div className="Header-Top">
          <div className="header-top-content">
            <div className="news-ticker-wrapper">
              <div
                className={`news-ticker-list ${!isTransitioning ? 'no-transition' : ''}`}
                style={{
                  transform: `translateY(-${currentArticleIndex * 36}px)`,
                }}
              >
                {extendedArticles.length > 0 ? (
                  extendedArticles.map((article, index) => (
                    <div
                      key={index}
                      className="news-ticker-item"
                      onClick={() => {
                        if (article.report_id) nav(`/article/${article.report_id}`);
                      }}
                    >
                      {article.title || "로딩 중..."}
                    </div>
                  ))
                ) : (
                  <div className="news-ticker-item">최신 AI 뉴스 로딩 중...</div>
                )}
              </div>
            </div>
            <Weather />
          </div>
        </div>
      )}

      {headerMain === "on" && (
        <header className={`Header-Main ${noSearchMobile ? 'no-search-mobile' : ''} ${location.pathname !== '/' ? 'category-page-header' : ''}`}>
          <div className="header-main-content">
            <div className="left-child">
              {leftChild}
            </div>

            <div className="mid-child">
              {midChild}
            </div>

            <div className="right-child">
              {rightChild}
            </div>
          </div>
        </header>
      )}

      {headerBottom === "on" && (
        <div className="Header-Bottom">
          <div className="category-list">
            {categories.map((item) => (
              <div
                key={item.id}
                className={`category-item ${activeCategory === item.label
                  ? 'active' : ''
                  }`}
                onClick={() => {
                  if (item.label === '정치') nav('/politics');
                  else if (item.label === '경제') nav('/economy');
                  else if (item.label === '사회') nav('/society');
                  else if (item.label === '생활/문화') nav('/living-culture');
                  else if (item.label === 'IT/과학') nav('/science');
                  else if (item.label === '세계') nav('/world');
                  else if (item.label === '홈') nav('/');
                }}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Side Menu Overlay */}
      <div className={`mobile-side-menu-overlay ${isMenuOpen ? 'open' : ''}`} onClick={() => setIsMenuOpen(false)}></div>
      <div className={`mobile-side-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-header">
          <Logo className="mobile-logo" />
          <div className="hamburger-icon" onClick={() => setIsMenuOpen(prev => !prev)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </div>
        </div>
        <div className="mobile-menu-list">
          {categories.map((item) => (
            <div
              key={item.id}
              className={`mobile-menu-item ${activeCategory === item.label ? 'active' : ''}`}
              onClick={() => {
                setIsMenuOpen(false);
                if (item.label === '정치') nav('/politics');
                else if (item.label === '경제') nav('/economy');
                else if (item.label === '사회') nav('/society');
                else if (item.label === '생활/문화') nav('/living-culture');
                else if (item.label === 'IT/과학') nav('/science');
                else if (item.label === '세계') nav('/world');
                else if (item.label === '홈') nav('/');
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Header;