import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sources from '../components/Sources';
import RightSideBar from '../components/RightSideBar';
import NewsText from '../components/NewsText';
import Header from '../components/Header';
import Searchbar from '../components/Searchbar';
import Logo from '../components/Logo';
import logoImg from '../components/Logo.png';
import UserMenu from '../components/UserMenu';
import './ArticlePage.css';
import MobileBottomNav from '../components/MobileBottomNav';
import axios from 'axios';
import { formatDate } from '../utils/dateUtils';
import WordCloudComponent from '../components/WordCloud';
import Timeline from '../components/Timeline';
import LikeButton from '../components/LikeButton';
import AiNewsRecommendation from '../components/AiNewsRecommendation';
import { useToast } from '../components/Toast';
import AgeGenderChart from '../components/AgeGenderChart';
import MediaFocusChart from '../components/MediaFocusChart'; // Import Chart
import OpinionSection from '../components/OpinionSection';
import { HiOutlineSpeakerWave, HiOutlinePrinter, HiOutlineDocumentDuplicate, HiOutlineBookmark, HiMiniBookmark, HiChevronDown, HiChevronUp } from 'react-icons/hi2';
import SkeletonNews from '../components/SkeletonNews'; // Import Skeleton



const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
function ArticlePage() {
  const showToast = useToast();
  const { id } = useParams();

  const [loading, setLoading] = useState(true); // Add loading state
  const [article, setArticle] = useState({
    title: "기사를 찾을 수 없습니다.",
    contents: "기사 내용을 찾을 수 없습니다."
  });

  const [keywords, setKeywords] = useState([]);
  const [imgURL, setImgURL] = useState("");

  // Sidebar & Search State
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSentence, setSelectedSentence] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Comparison State
  const [mediaNames, setMediaNames] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  // Evidence Map removed

  // Like State
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  // Scrap State
  const [isScraped, setIsScraped] = useState(false);

  // Demographics State
  const [demographics, setDemographics] = useState(null);

  // Media Focus State
  const [focusData, setFocusData] = useState(null);

  // Opinion State (pre-fetched)
  const [opinionsData, setOpinionsData] = useState(null);

  // Action Button States (Unified Popup State)
  // 'tts', 'font', or null (Share removed)
  const [activePopup, setActivePopup] = useState(null);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('articleFontSize');
    return saved ? parseInt(saved, 10) : 3;
  });

  // TTS Specific States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0); // 0.8, 1.0, 1.2
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const avail = window.speechSynthesis.getVoices();
      const koVoices = avail.filter(v => {
        const isKorean = v.lang === 'ko' || v.lang === 'ko-KR' || v.lang === 'ko_KR';
        if (!isKorean) return false;
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
        if (isMobile) return true;
        // PC: SunHi(여성) + InJoon(남성)만 허용
        return v.name.includes('SunHi') || v.name.includes('InJoon');
      });
      setVoices(koVoices);
      if (koVoices.length > 0) setSelectedVoice(koVoices[0]);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Helper: Friendly Voice Name
  const getFriendlyVoiceName = (voice) => {
    const name = voice.name;
    if (name.includes('SunHi')) return '여성 음성 (Microsoft)';
    if (name.includes('InJoon')) return '남성 음성 (Microsoft)';

    // Clean up
    let cleanName = name
      .replace('Google', '')
      .replace('Microsoft', '')
      .replace('한국어', '')
      .replace('Korean', '')
      .replace('한국의', '')
      .replace(/[()-]/g, '')
      .trim();

    return cleanName || '기본 음성';
  };

  // Popup Toggle Helper
  const togglePopup = (type) => {
    setActivePopup(prev => (prev === type ? null : type));
  };

  const closePopup = () => setActivePopup(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      showToast("기사 링크가 클립보드에 복사되었습니다.", "success");
    } catch (err) {
      console.error('Failed to copy link: ', err);
      showToast("복사에 실패했습니다.", "error");
    }
  };

  const handleScrap = async () => {
    const login_id = localStorage.getItem('login_id');
    if (!login_id) {
      showToast("로그인이 필요한 기능입니다.", "warning");
      return;
    }

    try {
      // Use report_id (integer) for scraps
      const reportId = parseInt(id, 10);

      const response = await axios.post(`${API_BASE_URL}/users/${login_id}/scraps`, {
        report_id: reportId
      });

      // Use explicit message from backend to determine state
      // Backend returns "Scrap added" or "Scrap removed"
      if (response.data.message.includes("added")) {
        setIsScraped(true);
        showToast("스크랩 되었습니다.", "success");
      } else {
        setIsScraped(false);
        showToast("스크랩이 취소되었습니다.", "info");
      }
    } catch (err) {
      console.error("Scrap failed:", err);
      showToast("스크랩 처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleSpeakToggle = () => {
    togglePopup('tts');
  };

  const handleFontToggle = () => {
    togglePopup('font');
  };

  // TTS Logic
  const startSpeaking = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!article.contents) return;

    const utterance = new SpeechSynthesisUtterance(article.contents);
    utterance.lang = 'ko-KR';
    utterance.rate = ttsSpeed;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const changeFontSize = (level) => {
    setFontSize(level);
    localStorage.setItem('articleFontSize', level.toString());
  };

  // Evidence Fetching Removed

  const handleSentenceClick = (sentence, company = null) => {
    setSelectedSentence(sentence);
    setSelectedCompany(company);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const highlightMediaText = (text) => {
    if (!text || mediaNames.length === 0) return text;
    const sortedNames = [...mediaNames].sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(${sortedNames.join('|')})`, 'g');
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (mediaNames.includes(part)) {
        return (
          <span key={index} style={{ color: '#d32f2f', fontWeight: 'bold' }}>{part}</span>
        );
      }
      return part;
    });
  };

  const renderClickableEvidence = (text, company) => {
    if (!text) return null;
    return text.split('\n').map((line, lIdx) => (
      <p key={lIdx} style={{ margin: 0 }}>
        {line.split('. ').map((stmt, sIdx) => {
          let s = stmt.trim();
          if (!s) return null;
          const endsWithPunct = /[.!?…]$/.test(s);
          const fullSentence = s + (endsWithPunct ? '' : '.');
          return (
            <span
              key={sIdx}
              className="clickable-sentence"
              onClick={(e) => {
                e.stopPropagation();
                handleSentenceClick(fullSentence, company);
              }}
            >
              {fullSentence}{' '}
            </span>
          );
        })}
      </p>
    ));
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchInfo = async () => {
      setLoading(true);
      try {
        const ai_news_response = await axios.get(`${API_BASE_URL}/reports/${id}`);
        const article = ai_news_response.data;
        setArticle(article);
        setLikeCount(article.like_count || 0);

        // [Recommendation] Save viewed tags & category to localStorage
        try {
          // 1. Tags
          let tags = [];
          if (Array.isArray(article.keywords)) {
            tags = article.keywords;
          } else if (typeof article.keywords === 'string') {
            try {
              tags = JSON.parse(article.keywords);
            } catch (e) {
              tags = [];
            }
          }

          if (tags.length > 0) {
            const currentTags = JSON.parse(localStorage.getItem('viewed_tags') || '[]');
            // Merge & Deduplicate (Keep recent)
            const newTags = [...new Set([...tags, ...currentTags])].slice(0, 50); // Keep last 50
            localStorage.setItem('viewed_tags', JSON.stringify(newTags));
          }

          // 2. Category
          if (article.category_name) {
            const currentCats = JSON.parse(localStorage.getItem('viewed_categories') || '[]');
            const newCats = [...new Set([article.category_name, ...currentCats])].slice(0, 10);
            localStorage.setItem('viewed_categories', JSON.stringify(newCats));
          }
        } catch (err) {
          console.warn("Failed to save recommendation history", err);
        }

        const login_id = localStorage.getItem('login_id');
        if (login_id) {
          // Check Like status
          try {
            const reactionResponse = await axios.get(`${API_BASE_URL}/users/${login_id}/reactions/${id}`);
            const userLiked = reactionResponse.data.value === 1;
            setIsLiked(userLiked);
          } catch (err) {
            setIsLiked(false);
          }

          // Check Scrap status
          // Need user info. calling read_user
          try {
            const userRes = await axios.get(`${API_BASE_URL}/users/${login_id}`);
            const reportId = parseInt(id, 10);
            const scraps = userRes.data.scraps || [];

            // Check if scraps contains the ID (int) or the current URL (legacy)
            // Ensure type safety comparison for ID
            const isScrapped = scraps.some(item =>
              item === reportId || item === window.location.href
            );

            setIsScraped(isScrapped);
          } catch (err) {
            console.error("Failed to check scrap status:", err);
          }
        }

        let parsedKeywords = [];
        if (typeof article.keywords === 'string') {
          try {
            parsedKeywords = JSON.parse(article.keywords);
          } catch (e) {
            console.error("Keyword parse error", e);
            parsedKeywords = [];
          }
        } else if (Array.isArray(article.keywords)) {
          parsedKeywords = article.keywords;
        }

        const filteredKeywords = parsedKeywords.filter(item => item.value > 20);
        setKeywords(filteredKeywords);

        const img_url_response = await axios.get(`${API_BASE_URL}/reports/clusters/${article.cluster_id}/news`);
        const newsList = img_url_response.data;
        const companies = [...new Set(newsList.map(n => n.company_name).filter(Boolean))];
        setMediaNames(companies);

        const allImgUrls = newsList.flatMap(news => news.img_urls ?? []).filter(Boolean);
        if (allImgUrls.length > 0) {
          const img_number = Math.floor(Math.random() * allImgUrls.length);
          setImgURL(allImgUrls[img_number]);
        }

        // Log view first (if user is logged in)
        if (login_id) {
          try {
            await axios.post(`${API_BASE_URL}/users/${login_id}/read/${id}`);
          } catch (error) {
            console.error('View logging error:', error);
          }
        }

        // Fetch demographics, media focus, and opinions in parallel
        const [demoResult, focusResult, opinionResult] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/reports/${id}/demographics`),
          axios.get(`${API_BASE_URL}/reports/${id}/media-focus`),
          // 캐시 없을 때만 API 호출 (캐시 있으면 이미 article.analysis_result에 포함)
          article.analysis_result?.opinion_bullets
            ? Promise.resolve({ data: article.analysis_result.opinion_bullets })
            : axios.get(`${API_BASE_URL}/reports/${id}/opinions`),
        ]);

        setDemographics(
          demoResult.status === 'fulfilled'
            ? demoResult.value.data
            : { age_distribution: [], gender_distribution: [] }
        );
        setFocusData(
          focusResult.status === 'fulfilled'
            ? (focusResult.value.data || {})
            : {}
        );
        setOpinionsData(
          opinionResult.status === 'fulfilled'
            ? opinionResult.value.data
            : []
        );

      } catch (error) {
        console.error('Data Fetch Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [id]);


  return (
    <div className={`ArticlePage ${isSidebarOpen ? 'sidebar-open' : ''} fs-${fontSize}`}>
      <div className="page-content">

        {/* Header */}
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
          headerTop="on" headerMain="on" headerBottom="on"
        />

        {/* Main */}
        <main className="main-content">
          {loading ? (
            <div style={{ padding: '40px 0' }}>
              <SkeletonNews type="article" />
            </div>
          ) : (
            <>
              <div className="article-content-wrapper">
                <div className='article-section'>
                  {imgURL && (
                    <div className='article-img'>
                      <img src={imgURL} alt={article?.title || ''} onLoad={(e) => { e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentElement.style.display = 'none'; }} />
                    </div>
                  )}

                  <div style={{ padding: '0 20px' }}>
                    <h1 className="article-head-title">{article.title}</h1>

                    {/* Metadata Row: Date (Left) + Buttons (Right) */}
                    <div className="article-meta-row">
                      <div className="meta-left">
                        {article.created_at && (
                          <>
                            <span style={{ padding: '4px 10px', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>AI 생성</span>
                            <span>
                              {formatDate(article.created_at)}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="meta-right">
                        {/* TTS Button */}
                        <div style={{ position: 'relative' }}>
                          <button className="action-btn" onClick={handleSpeakToggle} title="음성 듣기 설정">
                            <HiOutlineSpeakerWave style={{ color: isSpeaking ? '#4285F4' : 'inherit' }} />
                          </button>
                          {activePopup === 'tts' && (
                            <div className="popup-container tts-popup">
                              <div className="popup-header">
                                <h4 className="popup-title">본문 듣기 설정</h4>
                                <button className="popup-close-btn" onClick={closePopup}>×</button>
                              </div>
                              <div className="tts-section">
                                <span className="tts-label">목소리 (브라우저 제공)</span>
                                <div className="tts-options">
                                  {voices.length === 0 && <span style={{ fontSize: '0.8rem', color: '#999' }}>한국어 음성 없음</span>}
                                  {voices.map(v => (
                                    <label key={v.name} className="tts-radio-label">
                                      <input
                                        type="radio"
                                        name="voice"
                                        checked={selectedVoice?.name === v.name}
                                        onChange={() => { setSelectedVoice(v); }}
                                      />
                                      {getFriendlyVoiceName(v)}
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <div className="tts-section">
                                <span className="tts-label">말하기 속도</span>
                                <div className="tts-options">
                                  <label className="tts-radio-label"><input type="radio" name="speed" checked={ttsSpeed === 0.8} onChange={() => setTtsSpeed(0.8)} /> 느림</label>
                                  <label className="tts-radio-label"><input type="radio" name="speed" checked={ttsSpeed === 1.0} onChange={() => setTtsSpeed(1.0)} /> 보통</label>
                                  <label className="tts-radio-label"><input type="radio" name="speed" checked={ttsSpeed === 1.2} onChange={() => setTtsSpeed(1.2)} /> 빠름</label>
                                </div>
                              </div>
                              <button className="tts-play-btn" onClick={isSpeaking ? stopSpeaking : startSpeaking}>
                                {isSpeaking ? '본문 듣기 중지' : '본문 듣기 시작'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Font Size Button */}
                        <div style={{ position: 'relative' }}>
                          <button className="action-btn" onClick={handleFontToggle} title="글자 크기">
                            <span className="action-btn-text font-size-btn-content">
                              <span className="small-ga">가</span>
                              <span className="large-ga">가</span>
                            </span>
                          </button>
                          {activePopup === 'font' && (
                            <div className="popup-container font-size-popup-unified">
                              <div className="popup-header">
                                <h4 className="popup-title">글자 크기 설정</h4>
                                <button className="popup-close-btn" onClick={closePopup}>×</button>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <button
                                    key={level}
                                    className={`font-option ${fontSize === level ? 'active' : ''}`}
                                    onClick={() => changeFontSize(level)}
                                  >
                                    {level}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Copy Button */}
                        <button className="action-btn" onClick={handleCopy} title="기사 링크 복사">
                          <HiOutlineDocumentDuplicate />
                        </button>

                        {/* Print Button */}
                        <button className="action-btn" onClick={handlePrint} title="인쇄하기">
                          <HiOutlinePrinter />
                        </button>

                        {/* Scrap Button */}
                        <button className="action-btn" onClick={handleScrap} title={isScraped ? "스크랩 취소" : "스크랩"}>
                          {isScraped ? <HiMiniBookmark style={{ color: '#007bff' }} /> : <HiOutlineBookmark />}
                        </button>
                      </div>
                    </div>

                    <hr className="article-head-divider" /> {/* Keeping HR invisble via CSS or actually keep it? CSS hides it. */}

                    <div className="article-comparer" style={{ marginTop: '10px', marginBottom: '40px', borderTop: 'none' }}>
                      <h3 className="section-title" style={{ textAlign: 'left' }}>언론사별 보도 특징</h3>
                      <div className={`comparison-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
                        <ul className="comparison-list">
                          {article?.analysis_result?.media_comparison_bullets?.map((item, idx) => {
                            // Backward compatibility: Handle string items
                            const isString = typeof item === 'string';

                            if (isString) {
                              return (
                                <li key={idx} className="comparison-item">
                                  <span className="analysis-text">
                                    {highlightMediaText(item)}
                                  </span>
                                </li>
                              );
                            }

                            // Old Object Format fallback
                            if (!item.hashtags && item.analysis) {
                              return (
                                <li key={idx} className="comparison-item">
                                  <span className="comparison-company-badge text-badge">{item.company}</span>
                                  <span className="analysis-text">{item.analysis}</span>
                                </li>
                              );
                            }

                            // New Format: Hashtags + One-liner + Evidence (Global Expand)
                            return (
                              <li key={idx} className="comparison-item new-format">
                                <div className="company-header">
                                  <div className="badge-row">
                                    <span className="comparison-company-badge">
                                      {item.company}
                                    </span>
                                  </div>
                                  <div className="hashtags">
                                    {item.hashtags && item.hashtags.map((tag, tIdx) => (
                                      <span key={tIdx} className="hashtag-badge">{tag}</span>
                                    ))}
                                  </div>
                                </div>
                                <p className="summary-text">
                                  {item.summary}
                                </p>
                                {isExpanded && item.evidence && (
                                  <div className="evidence-text fade-in" style={{ marginTop: '4px', fontSize: '0.9rem', color: '#5f6368', lineHeight: '1.5', textAlign: 'left' }}>
                                    {renderClickableEvidence(item.evidence, item.company)}
                                  </div>
                                )}
                              </li>
                            );
                          })}

                        </ul>
                      </div>
                      {article?.analysis_result?.media_comparison_bullets?.length > 0 && (
                        <div className="show-more-button-wrapper">
                          <button className="show-more-button link-style" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? (
                              <>접기 <HiChevronUp /></>
                            ) : (
                              <>더보기 <HiChevronDown /></>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 관련 오피니언/사설 섹션 */}
                    <OpinionSection
                      reportId={id}
                      cachedOpinions={opinionsData}
                      onSentenceClick={handleSentenceClick}
                    />
                  </div>

                  <NewsText
                    contents={article.contents}
                    onSentenceClick={handleSentenceClick}
                    fontSize={fontSize}
                  />

                  {/* Centered Like Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', marginBottom: '20px' }}>
                    <LikeButton
                      articleId={id}
                      initialLiked={isLiked}
                      initialCount={likeCount}
                      onLikeUpdate={(newCount, newIsLiked) => {
                        setLikeCount(newCount);
                        setIsLiked(newIsLiked);
                      }}
                    />
                  </div>

                  {/* 통계 섹션: 키워드 + 연령대/성별 + 집중도 분석 */}
                  <div className="statistics-section" style={{ marginTop: '60px', paddingLeft: '30px', paddingRight: '30px' }}>
                    <div className="statistics-content-wrapper" style={{
                      display: 'flex',
                      gap: '40px',
                      flexWrap: 'wrap'
                    }}>
                      {/* 워드클라우드 */}
                      <div style={{ flex: '0 0 300px', minWidth: '280px' }}>
                        <h3 className="section-title" style={{ marginBottom: '20px', textAlign: 'left' }}>기사 핵심 키워드</h3>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          height: '250px',
                          margin: '0 auto'
                        }}>
                          <WordCloudComponent keywords={keywords} width={280} height={250} />
                        </div>
                      </div>

                      {/* 연령대별/성별 차트 */}
                      <div style={{ flex: '1', minWidth: '300px' }}>
                        <AgeGenderChart
                          ageData={demographics?.age_distribution}
                          genderData={demographics?.gender_distribution}
                        />
                      </div>

                      {/* 언론사 집중도 분석 차트 */}
                      <div style={{ flex: '1', minWidth: '300px' }}>
                        <MediaFocusChart data={focusData} />
                      </div>
                    </div>
                  </div>


                  <div className="timeline-section" style={{ marginTop: '40px', padding: '20px' }}>
                    <Timeline currentArticleId={id} />
                  </div>

                  <Sources clusterId={article.cluster_id} />
                </div>
              </div>

              <AiNewsRecommendation articleId={id} number_of_article={3} />
            </>
          )
          }
        </main >

        <RightSideBar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          searchKeyword={selectedSentence}
          searchCompany={selectedCompany}
          clusterId={article.cluster_id}
        />
      </div >
      <MobileBottomNav />
    </div >
  );
}

export default ArticlePage;
