import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import logoImg from '../components/Logo.png';
import checkImg from '../components/check.png';
import lineImg from '../components/line.png';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import SkeletonNews from '../components/SkeletonNews';


import './Main.css';
import MobileBottomNav from '../components/MobileBottomNav';
import '../components/MobileBottomNav.css';
import RecommendedNews from '../components/RecommendedNews'; // [New]

import axios from 'axios'; // axios imported

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const Main = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [displayArticles, setDisplayArticles] = useState([]);
  const [imageMap, setImageMap] = useState({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true); // Loading state
  const [subscribedKeywords, setSubscribedKeywords] = useState([]);
  const itemsPerPage = 5;

  // Check login status
  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const storedUserName = localStorage.getItem('username');

    setIsLoggedIn(loggedIn);
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Fetch AI Generated News (Limit 50 for main page coverage)
        const response = await axios.get(`${API_BASE_URL}/reports?limit=50`); // 메인페이지에 필요한 만큼만
        const realArticles = response.data;

        // 2. Map Backend Data to Frontend Structure
        const formattedArticles = realArticles.map(art => ({
          ...art,
          id: art.report_id, // [Fix] Map native ID to 'id' for widespread usage
          category: art.category_name, // Map category_name ('정치', '경제'...) to category
          image: `cluster_${art.cluster_id}`, // Placeholder ID for image map
          short_text: art.contents ? (art.contents.substring(0, 150) + "···") : "내용 없음"
        }));

        // 3. Filter by category (if name param exists)
        const decodedName = decodeURIComponent(name || '');
        let filtered = !decodedName

          ? formattedArticles
          : formattedArticles.filter(a => {
            if (!a.category) return false;
            return a.category === decodedName;
          });

        // [추가] 점수 기반 개인화 정렬 (캐러셀 Top 3 이후 기사에만 적용)
        // 캐러셀은 항상 최신순 유지
        const loginId = localStorage.getItem('login_id');
        if (loginId && filtered.length > 3) {
          try {
            const userRes = await axios.get(`${API_BASE_URL}/users/${loginId}/dashboard`);
            const subKeywords = userRes.data.subscribed_keywords || [];
            setSubscribedKeywords(subKeywords);
            const readKeywords = userRes.data.read_keywords || {};   // { "트럼프": 8, "관세": 12, ... }
            const readCategories = userRes.data.read_categories || {}; // { "정치": 15, "경제": 8, ... }

            const hasData = subKeywords.length > 0 || Object.keys(readKeywords).length > 0 || Object.keys(readCategories).length > 0;

            if (hasData) {
              // read_keywords 빈도를 0~1로 정규화
              const maxReadFreq = Math.max(...Object.values(readKeywords), 1);
              // read_categories 빈도를 0~1로 정규화
              const maxCatFreq = Math.max(...Object.values(readCategories), 1);

              const getArticleKeywords = (article) => {
                if (!article.keywords) return [];
                let kws = article.keywords;
                if (typeof kws === 'string') {
                  try { kws = JSON.parse(kws); } catch (e) { return []; }
                }
                if (!Array.isArray(kws)) return [];
                return kws.map(k => (typeof k === 'string' ? k : k?.text || '')).filter(Boolean);
              };

              const calcScore = (article) => {
                const artKeywords = getArticleKeywords(article);
                let score = 0;

                // (1) 구독 키워드 매칭 (×3)
                for (const sk of subKeywords) {
                  if (artKeywords.some(ak => ak.includes(sk) || sk.includes(ak))) {
                    score += 3;
                  }
                }

                // (2) 읽은 키워드 매칭 (빈도 가중치, 최대 1점/키워드)
                for (const ak of artKeywords) {
                  for (const [rk, freq] of Object.entries(readKeywords)) {
                    if (ak.includes(rk) || rk.includes(ak)) {
                      score += (freq / maxReadFreq);
                      break; // 같은 기사 키워드에 대해 중복 가산 방지
                    }
                  }
                }

                // (3) 선호 카테고리 가중치 (최대 2점)
                const cat = article.category_name || article.category;
                if (cat && readCategories[cat]) {
                  score += 2 * (readCategories[cat] / maxCatFreq);
                }

                return score;
              };

              // 캐러셀 3개는 그대로 두고, 나머지만 점수 기반 정렬
              const top3 = filtered.slice(0, 3);
              const rest = filtered.slice(3);
              rest.sort((a, b) => calcScore(b) - calcScore(a));
              filtered = [...top3, ...rest];
            }
          } catch (e) {
            console.warn("사용자 데이터 로딩 실패", e);
          }
        }

        setDisplayArticles(filtered);

        // 4. 이미지 URL 페치 (cluster_id 중복 제거)
        const seenClusterIds = new Set();
        const articlesToFetch = filtered.filter(art => {
          if (seenClusterIds.has(art.cluster_id)) return false;
          seenClusterIds.add(art.cluster_id);
          return true;
        }).slice(0, 30);

        // 캐러셀 Top 3 이미지를 우선 로드 후 화면 표시
        const carouselClusterIds = new Set(filtered.slice(0, 3).map(a => a.cluster_id));
        const carouselBatch = articlesToFetch.filter(a => carouselClusterIds.has(a.cluster_id));
        const restBatch = articlesToFetch.filter(a => !carouselClusterIds.has(a.cluster_id));

        // 헬퍼: 클러스터 뉴스 → imageMap/detailsMap 변환
        const processResults = (results) => {
          const imgMap = {};
          const detMap = {};
          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            const { clusterId, newsList } = r.value;
            detMap[`cluster_${clusterId}`] = newsList;
            const allImgUrls = newsList.flatMap(n => n.img_urls ?? []).filter(Boolean);
            if (allImgUrls.length > 0) {
              imgMap[`cluster_${clusterId}`] = allImgUrls[1] || allImgUrls[0];
            }
          }
          return { imgMap, detMap };
        };

        // 헬퍼: 이미지 URL을 브라우저에 프리로드
        const preloadImages = (urls) => Promise.all(
          urls.map(url => new Promise(resolve => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve; // 실패해도 진행
            img.src = url;
          }))
        );

        // (a) 캐러셀 이미지 URL 페치
        const carouselResults = await Promise.allSettled(carouselBatch.map(async (art) => {
          const imgRes = await axios.get(`${API_BASE_URL}/reports/clusters/${art.cluster_id}/news?fields=light`);
          return { clusterId: art.cluster_id, newsList: imgRes.data };
        }));
        const { imgMap: carouselImgMap, detMap: carouselDetMap } = processResults(carouselResults);

        // (b) 캐러셀 이미지 브라우저 프리로드 → 완료 후 로딩 해제
        await preloadImages(Object.values(carouselImgMap));
        setImageMap(prev => ({ ...prev, ...carouselImgMap }));
        setArticleDetailsMap(prev => ({ ...prev, ...carouselDetMap }));
        setLoading(false); // 캐러셀 이미지 렌더 준비 완료 후 화면 표시

        // (c) 나머지 이미지는 백그라운드에서 배치 로드
        const BATCH_SIZE = 5;
        for (let i = 0; i < restBatch.length; i += BATCH_SIZE) {
          const batch = restBatch.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(async (art) => {
            const imgRes = await axios.get(`${API_BASE_URL}/reports/clusters/${art.cluster_id}/news?fields=light`);
            return { clusterId: art.cluster_id, newsList: imgRes.data };
          }));
          const { imgMap, detMap } = processResults(results);
          setImageMap(prev => ({ ...prev, ...imgMap }));
          setArticleDetailsMap(prev => ({ ...prev, ...detMap }));
        }

      } catch (error) {
        console.error('Failed to load real data:', error);
        setImageMap({});
      } finally {
        setLoading(false); // 에러 시에도 로딩 해제
      }
    };

    loadData();
  }, [name]);



  // Slideshow State
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentComparisonIndex, setCurrentComparisonIndex] = useState(0); // [New] Rotate comparison
  const [articleDetailsMap, setArticleDetailsMap] = useState({});
  const [touchStart, setTouchStart] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;

    // Swipe threshold (e.g., 50px)
    if (distance > 50) {
      // Swipe Left -> Next
      setCurrentSlideIndex(prev => (prev + 1) % 3);
    } else if (distance < -50) {
      // Swipe Right -> Prev
      setCurrentSlideIndex(prev => (prev - 1 + 3) % 3);
    }
  };

  // Auto-rotate slideshow
  // Auto-rotate slideshow (Disabled as per request)
  // Auto-rotate comparison items every 10s
  useEffect(() => {
    // Reset comparison index when slide changes
    setCurrentComparisonIndex(0);
  }, [currentSlideIndex]);

  useEffect(() => {
    const slideArticles = displayArticles.slice(0, 3);
    const activeArticle = slideArticles[currentSlideIndex];
    if (!activeArticle) return;

    const interval = setInterval(() => {
      setCurrentComparisonIndex(prev => {
        const bullets = activeArticle?.analysis_result?.media_comparison_bullets || [];
        if (bullets.length <= 1) return 0;
        return (prev + 1) % bullets.length;
      });
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [currentSlideIndex, displayArticles]);

  // --- Deduplication Logic ---
  // Pre-calculate lists to ensure no duplicates across sections
  const usedIds = new Set();

  // 1. Carousel (Top 3)
  const carouselArticles = displayArticles.slice(0, 3);
  carouselArticles.forEach(a => usedIds.add(a.id));

  // Helper to get unique articles for a category
  const getUniqueArticles = (cat, limit) => {
    return displayArticles.filter(a => {
      const match = a.category === cat || (Array.isArray(a.category) && a.category.includes(cat));
      if (match && !usedIds.has(a.id)) {
        usedIds.add(a.id);
        return true;
      }
      return false;
    }).slice(0, limit);
  };

  const politicsArticles = getUniqueArticles('정치', 6);
  const economyArticles = getUniqueArticles('경제', 3);
  const societyArticles = getUniqueArticles('사회', 1);
  const scienceArticles = getUniqueArticles('IT/과학', 1);
  const worldArticles = getUniqueArticles('세계', 1);

  // Function to render the main content block (Slideshow)
  const renderMainContent = () => {
    if (!carouselArticles || carouselArticles.length === 0) return null;

    // Helper: Highlight media names in text
    const highlightMediaText = (text, mediaNames) => {
      if (!text || !mediaNames || mediaNames.length === 0) return text;
      // Sort by length desc to match longest first
      const sortedNames = [...mediaNames].sort((a, b) => b.length - a.length);
      const regex = new RegExp(`(${sortedNames.join('|')})`, 'g');
      const parts = text.split(regex);
      return parts.map((part, index) => {
        if (mediaNames.includes(part)) {
          return (
            <span key={index} className="highlighted-media"><img src={lineImg} alt="line" className="highlight-line-icon" />{part}</span>
          );
        }
        return part;
      });
    };

    const slideArticles = carouselArticles;
    const activeArticle = slideArticles[currentSlideIndex];

    // Get media names for the active article for highlighting
    const activeRelatedNews = articleDetailsMap[`cluster_${activeArticle?.cluster_id}`] || [];
    const activeMediaNames = [...new Set(activeRelatedNews.map(n => n.company_name).filter(Boolean))];

    // Prepare bullets for the active article (Desktop)
    const activeBullets = activeArticle?.analysis_result?.media_comparison_bullets || [];

    return (
      <React.Fragment>
        <h2 className="cat-box-header ai-news-header desktop-only-section">AI 분석 뉴스</h2>

        {/* --- DESKTOP VIEW --- */}
        <section className="main-article-section desktop-only-section">
          <div className="main-image-column">
            <button className="carousel-arrow prev-arrow" onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev - 1 + 3) % 3); }}>&#x2039;</button>
            <div className="article-image-center">
              <div
                className="carousel-track"
                style={{ '--slide-transform': `translateX(-${currentSlideIndex * 100}%)` }}
              >
                {slideArticles.map((art, idx) => {
                  const imgUrl = imageMap[art.image] || art.image;
                  const isActive = idx === currentSlideIndex;
                  return (
                    <div
                      key={art.id || idx}
                      className={`carousel-slide ${isActive ? 'active' : ''}`}
                      onClick={() => navigate(`/article/${art.report_id}`)}
                    >
                      <img
                        src={imgUrl}
                        alt={art.title}
                        onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                        onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
                      />
                      <div className="main-image-text"><h3>{art.title}</h3></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="main-right-col">
            <div className="article-info-side">
              {slideArticles.map((art, idx) => {
                const isActive = idx === currentSlideIndex;
                if (!isActive) return null;
                return (
                  <div
                    key={art.id || idx}
                    className={`analysis-block ${isActive ? 'active fade-animate' : ''}`}
                    onClick={() => navigate(`/article/${art.report_id}`)}
                  >
                    <h2 className="analysis-title">{art.title}</h2>
                    <p className="analysis-desc">{art.short_text || "AI 생성 기사 내용"}</p>
                  </div>
                );
              })}
            </div>
            <div className="highlights-side">
              <h3 className="highlights-title">언론사별 비교분석</h3>
              <div key={`hl-${currentSlideIndex}`} className="highlight-list fade-animate">
                <div className="main-comparison-container">
                  <ul className="main-comparison-list">
                    {activeBullets.slice(currentComparisonIndex, currentComparisonIndex + 1).map((item, idx) => {
                      const isString = typeof item === 'string';

                      let content = "";
                      let hashtags = [];

                      if (isString) content = item;
                      else if (item.summary) {
                        content = item.summary;
                        hashtags = item.hashtags || [];
                      }
                      else if (item.analysis) content = item.analysis;

                      return (
                        <li key={`${idx}-${currentComparisonIndex}`} className="main-comparison-item fade-slide-up">
                          <div className="main-analysis-text">
                            {!isString && item.company && (
                              <div className="main-company-header" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 'bold', color: '#1a73e8' }}>{item.company}</span>
                                {hashtags.slice(0, 2).map((tag, tIdx) => (
                                  <span key={tIdx} style={{ fontSize: '0.75rem', backgroundColor: '#e8f0fe', color: '#1967d2', padding: '2px 6px', borderRadius: '10px' }}>{tag}</span>
                                ))}
                              </div>
                            )}
                            {highlightMediaText((content || "").replace(/^- /, '').replace(/\[/g, '').replace(/\]/g, ''), activeMediaNames)}
                            {item.evidence && (
                              <p className="main-comparison-evidence">
                                {item.evidence}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {activeBullets.length === 0 && (
                      <li className="main-comparison-item">분석된 결과가 없습니다.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <button className="carousel-arrow next-arrow" onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev + 1) % 3); }}>&#x203A;</button>
        </section>

        {/* --- MOBILE VIEW (Whole Section Slide) --- */}
        <section className="main-article-section-mobile mobile-only-section">
          {/* Duplicate Header Removed */}
          <div
            className="mobile-full-slider"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="mobile-slide-track"
              style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}
            >
              {slideArticles.map((art, idx) => {
                const imgUrl = imageMap[art.image] || art.image;
                // const hls = getHighlights(art); // Unused now
                return (
                  <div key={idx} className="mobile-whole-slide">
                    {/* Image + Title + Nav Buttons Part */}
                    <div className="mobile-slide-top" onClick={() => navigate(`/article/${art.report_id}`)}>
                      <img
                        src={imgUrl}
                        alt={art.title}
                        onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
                      />
                      <div className="main-image-text"><h3>{art.title}</h3></div>
                      <button
                        className="mobile-slide-nav prev"
                        onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev - 1 + 3) % 3); }}
                      >&#x2039;</button>
                      <button
                        className="mobile-slide-nav next"
                        onClick={(e) => { e.stopPropagation(); setCurrentSlideIndex(prev => (prev + 1) % 3); }}
                      >&#x203A;</button>
                    </div>
                    {/* Highlights Part */}
                    <div className="mobile-slide-bottom">
                      <h3 className="highlights-title">언론사별 비교분석</h3>
                      <div className="main-comparison-container">
                        <ul className="main-comparison-list">
                          {(art?.analysis_result?.media_comparison_bullets || []).slice(currentComparisonIndex, currentComparisonIndex + 1).map((item, idx) => {
                            const relatedNews = articleDetailsMap[`cluster_${art.cluster_id}`] || [];
                            const articleMediaNames = [...new Set(relatedNews.map(n => n.company_name).filter(Boolean))];

                            const isString = typeof item === 'string';
                            let content = "";
                            let hashtags = [];

                            if (isString) content = item;
                            else if (item.summary) {
                              content = item.summary;
                              hashtags = item.hashtags || [];
                            }
                            else if (item.analysis) content = item.analysis;

                            return (
                              <li key={`${idx}-${currentComparisonIndex}`} className="main-comparison-item fade-slide-up">
                                <div className="main-analysis-text">
                                  {!isString && item.company && (
                                    <div className="main-company-header" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 'bold', color: '#1a73e8' }}>{item.company}</span>
                                      {hashtags.slice(0, 2).map((tag, tIdx) => (
                                        <span key={tIdx} style={{ fontSize: '0.75rem', backgroundColor: '#e8f0fe', color: '#1967d2', padding: '2px 6px', borderRadius: '10px' }}>{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                  {highlightMediaText((content || "").replace(/^- /, '').replace(/\[/g, '').replace(/\]/g, ''), articleMediaNames)}
                                  {item.evidence && (
                                    <p className="main-comparison-evidence">
                                      {item.evidence}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                          {(!art?.analysis_result?.media_comparison_bullets || art.analysis_result.media_comparison_bullets.length === 0) && (
                            <li className="main-comparison-item">분석된 결과가 없습니다.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="carousel-dots-mobile">
            {[0, 1, 2].map(dotIdx => (
              <span key={dotIdx} className={`carousel-dot ${dotIdx === currentSlideIndex ? 'active' : ''}`} onClick={() => setCurrentSlideIndex(dotIdx)} />
            ))}
          </div>



        </section>
      </React.Fragment >
    );
  };

  const renderPoliticsEconomy = () => {
    const renderPoliticsSection = () => (
      <div className="politics-section">
        <h2 className="cat-box-header" onClick={() => navigate('/politics')}>정치</h2>
        <div className="politics-grid">
          {politicsArticles.map((art, i) => (
            <div key={i} className="politics-card" onClick={() => navigate(`/article/${art.id}`)}>
              <div className="politics-img">
                <img
                  src={imageMap[art.image] || art.image}
                  alt={art.title}
                  onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                  onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
                />
              </div>
              <div className="politics-info">
                <h3 className="politics-title">{art.title}</h3>
                <p className="politics-desc">{art.short_text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const renderEconomySection = () => (
      <div className="economy-section">
        <h2 className="cat-box-header" onClick={() => navigate('/economics')}>경제</h2>
        <div className="economy-column-list">
          {economyArticles.map((art, i) => (
            <div key={i} className="economy-card" onClick={() => navigate(`/article/${art.id}`)}>
              <div className="economy-img">
                <img
                  src={imageMap[art.image] || art.image}
                  alt={art.title}
                  onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                  onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
                />
              </div>
              <h3 className="economy-title">{art.title}</h3>
            </div>
          ))}
        </div>
      </div>
    );

    const renderSocietyLargeSection = () => {
      const art = societyArticles[0];
      if (!art) return null;
      return (
        <div className="society-large-section">
          <h2 className="cat-box-header" onClick={() => navigate('/society')}>사회</h2>
          <div className="society-large-card" onClick={() => navigate(`/article/${art.id}`)}>
            <div className="society-large-img">
              <img
                src={imageMap[art.image] || art.image}
                alt={art.title}
                onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
              />
            </div>
            <div className="society-large-info">
              <h3 className="society-large-title">{art.title}</h3>
              <p className="society-large-desc">{art.short_text}</p>
            </div>
          </div>
        </div>
      );
    };

    const renderWorldSection = () => {
      const art = worldArticles[0];
      if (!art) return null;
      return (
        <div className="world-large-section">
          <h2 className="cat-box-header" onClick={() => navigate('/world')}>세계</h2>
          <div className="world-large-card" onClick={() => navigate(`/article/${art.id}`)}>
            <div className="world-large-img">
              <img
                src={imageMap[art.image] || art.image}
                alt={art.title}
                onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
              />
            </div>
            <div className="world-large-info">
              <h3 className="world-large-title">{art.title}</h3>
              <p className="world-large-desc">{art.short_text}</p>
            </div>
          </div>
        </div>
      );
    };

    return (
      <section className="complex-grid-section">
        <div className="complex-left-col">
          {renderPoliticsSection()}
          <div className="complex-inner-divider"></div>
          {renderSocietyLargeSection()}
          <div className="complex-inner-divider"></div>
          {renderScienceSection()}
          <div className="complex-inner-divider"></div>
          {renderWorldSection()}
        </div>
        <div className="complex-right-col">
          {renderEconomySection()}
        </div>
      </section>
    );
  };



  const renderScienceSection = () => {
    const science = scienceArticles;
    if (science.length === 0) return null;

    return (
      <section className="category-detailed-section science-section">
        <div className="cat-global-row">
          <h2 className="cat-box-header" onClick={() => navigate('/science')}>IT/과학</h2>
          <div className="global-grid science-grid">
            {science.map((art, i) => (
              <div key={i} className="global-card science-card" onClick={() => navigate(`/article/${art.id}`)}>
                <div className="global-img">
                  <img src={imageMap[art.image] || art.image} alt={art.title} onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }} />
                </div>
                <div className="science-info">
                  <h5>{art.title}</h5>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };



  const totalPages = 5;

  return (
    <div className="main-page">
      <Header
        leftChild={null}
        midChild={<Logo />}
        rightChild={
          <div className="header-right-wrapper">
            <div className="search-input-wrapper">
              <Searchbar className="always-open rounded-search" />
            </div>
            <UserMenu className="rounded-user-menu" />
          </div>
        }
        headerTop="on"
        headerMain="on"
        headerBottom="on"
      />

      {/* Main Content (Carousel) - Outside Category Content for Full Bleed */}
      {!loading && displayArticles.length > 0 && (
        <div className="main-carousel-outer">
          {renderMainContent()}
          {/* [New] Recommended News (YouTube Style) */}
          <RecommendedNews allArticles={displayArticles} userName={userName} imageMap={imageMap} subscribedKeywords={subscribedKeywords} />
        </div>
      )}

      <main className="category-content">
        {loading ? (
          <div className="main-skeleton-container skeleton-wrapper">
            <SkeletonNews type="main" />
            <div className="skeleton-grid-row">
              <div className="skeleton-grid-item"><SkeletonNews type="grid" /></div>
              <div className="skeleton-grid-item"><SkeletonNews type="grid" /></div>
            </div>
          </div>
        ) : (
          <>
            <div className="main-content-split">
              <div className="main-full-col">
                {displayArticles.length > 0 ? (
                  <React.Fragment>
                    {/* Carousel moved out */}
                    <div className="complex-layout-wrapper">
                      {renderPoliticsEconomy()}
                    </div>
                  </React.Fragment>
                ) : (
                  <div className="empty-category">
                    <p>해당 카테고리에 표시할 기사가 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="full-width-divider mobile-only-divider"></div>
          </>
        )}
      </main >
      <MobileBottomNav />
    </div >
  );
};