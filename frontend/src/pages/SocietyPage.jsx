import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Logo from '../components/Logo';
import logoImg from '../components/Logo.png';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import SkeletonNews from '../components/SkeletonNews';
import { formatDate } from '../utils/dateUtils';
import MobileBottomNav from '../components/MobileBottomNav';
import './SocietyPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const SocietyPage = () => {
    const name = '사회';
    const navigate = useNavigate();
    const location = useLocation();
    const [currentPage, setCurrentPage] = useState(1);
    const [displayArticles, setDisplayArticles] = useState([]);
    const [imageMap, setImageMap] = useState({});
    const [feedPage, setFeedPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const feedSectionRef = useRef(null);

    // Slideshow State
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(0);

    const handleTouchStart = (e) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = (e) => {
        const touchEnd = e.changedTouches[0].clientX;
        const distance = touchStart - touchEnd;

        // Swipe threshold (e.g., 50px)
        if (distance > 50) {
            // Swipe Left -> Next (Top 3 articles)
            setCurrentSlideIndex(prev => (prev + 1) % 3);
        } else if (distance < -50) {
            // Swipe Right -> Prev
            setCurrentSlideIndex(prev => (prev - 1 + 3) % 3);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        setFeedPage(1);

        const loadData = async () => {
            try {
                // 1. Fetch AI Generated News
                const response = await axios.get(`${API_BASE_URL}/reports?limit=1000`);
                const realArticles = response.data;

                // 2. Map Backend Data to Frontend Structure
                const formattedArticles = realArticles.map(art => ({
                    ...art,
                    id: art.report_id, // [Fix] Map native ID to 'id'
                    category: art.category_name,
                    image: `cluster_${art.cluster_id}`,
                    created_at: art.created_at,
                    short_text: art.contents ? (art.contents.substring(0, 100) + "...") : "내용 없음"
                }));

                // 3. Filter by category
                const filtered = formattedArticles.filter(a => {
                    if (!a.category) return false;
                    return a.category === name;
                });

                if (filtered.length > 0) {
                    // 3. Sort by creation date (Latest First)
                    const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    setDisplayArticles(sorted);

                    // 4. Fetch Images
                    const uniqueClusters = [...new Set(filtered.map(a => a.cluster_id))];
                    const newImageMap = {};

                    await Promise.allSettled(uniqueClusters.map(async (clusterId) => {
                        try {
                            const imgRes = await axios.get(`${API_BASE_URL}/reports/clusters/${clusterId}/news`);
                            const newsList = imgRes.data;
                            const allImgUrls = newsList.flatMap(news => news.img_urls ?? []).filter(Boolean);

                            if (allImgUrls.length > 0) {
                                const selectedImg = allImgUrls[0]; // Deterministic selection
                                newImageMap[`cluster_${clusterId}`] = selectedImg;
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch image for cluster ${clusterId}`, err);
                        }
                    }));

                    setImageMap(prev => ({ ...prev, ...newImageMap }));
                } else {
                    setDisplayArticles([]);
                }
            } catch (error) {
                console.error('Failed to load real data:', error);
                setDisplayArticles([]);
                setImageMap({});
            } finally {
                setLoading(false);
            }
        };

        setLoading(true);
        loadData();
    }, []);

    // 14 fixed + 19 feed items? No.
    // 1 Main + 4 Grid + 8 List + 20 Feed = 33 items total
    const articlesPerBlock = 33;
    const blocksPerPage = 1;
    const articlesPerPage = articlesPerBlock * blocksPerPage;

    const renderMainContent = (blockArticles, blockIndex) => {
        if (!blockArticles || blockArticles.length === 0) return null;

        const mainArticle = blockArticles[0];

        // Ensure subsequent sections DO NOT contain the Main article
        const remainingArticles = blockArticles.slice(1).filter(art => art.id !== mainArticle.id);
        const gridArticles = remainingArticles.slice(0, 5);
        const listArticles = remainingArticles.slice(5, 10);

        // Feed Logic
        // Feed Logic: Exclude articles already shown in top sections (1 main, 5 grid, 5 list)
        const allFeedArticles = remainingArticles.slice(10);
        const feedPageSize = 5;
        const totalFeedPages = Math.ceil(allFeedArticles.length / 5);
        const currentFeedArticles = allFeedArticles.slice((feedPage - 1) * 5, feedPage * 5);

        const mainData = {
            id: mainArticle?.id,
            title: mainArticle?.title || "News Title Text Sample",
            description: mainArticle?.short_text || "text sample...",
            image: mainArticle ? (imageMap[mainArticle.image] || mainArticle.image) : null,
            report_id: mainArticle?.report_id
        };

        const carouselArticles = blockArticles.slice(0, 3);

        const grid = gridArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "Title Sample Text",
            content: art?.short_text || "text sample...",
            image: art ? (imageMap[art.image] || art.image) : null
        }));

        const list = listArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "Title Sample Text",
            content: art?.short_text || "text sample...",
            image: art ? (imageMap[art.image] || art.image) : null,
            date: art?.created_at
        }));

        const feed = currentFeedArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "Title Sample Text",
            content: art?.short_text || "text sample...",
            image: art ? (imageMap[art.image] || art.image) : null,
            date: art?.created_at
        }));

        return (
            <React.Fragment key={blockIndex}>
                {/* --- DESKTOP VIEW --- */}
                <section className="main-article-section desktop-only-section">

                    {/* Left: Article Title */}
                    <div className="title-side" onClick={() => navigate(`/article/${mainData.report_id}`)}>
                        <div className="hot-badge">최신</div>
                        <h2>{mainData.title}</h2>
                        <p>{mainData.description}</p>
                    </div>

                    {/* Right: Article Photo */}
                    <div className="image-side" onClick={() => navigate(`/article/${mainData.report_id}`)}>
                        <div className="article-image-center">
                            <img src={mainData.image} alt="Main" onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                        </div>
                    </div>
                </section>

                {/* --- MOBILE VIEW (Whole Section Slide) --- */}
                <section className="main-article-section-mobile mobile-only-section">
                    <div
                        className="mobile-full-slider"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div
                            className="mobile-slide-track"
                            style={{ transform: `translateX(-${currentSlideIndex * 100}%)` }}
                        >
                            {carouselArticles.map((art, idx) => {
                                const imgUrl = imageMap[art.image] || art.image;
                                return (
                                    <div key={idx} className="mobile-whole-slide">
                                        {/* Image + Title Part */}
                                        <div className="mobile-slide-top" onClick={() => navigate(`/article/${art.report_id}`)}>
                                            <img
                                                src={imgUrl}
                                                alt={art.title}
                                                onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }}
                                            />
                                            <div className="main-image-text">
                                                <div className="hot-badge-overlay">최신</div>
                                                <h3>{art.title}</h3>
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
                <div className="section-divider"></div>

                {/* Asymmetric List Section */}
                <section className="asymmetric-list-section">
                    {list.length > 0 && (
                        <div className="list-left-big" onClick={() => navigate(`/article/${list[0].id}`)}>
                            <div className="big-image-container">
                                <img src={list[0].image} alt={list[0].title} onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                            </div>
                            <div className="list-left-info">
                                <h3>{list[0].title}</h3>
                            </div>
                        </div>
                    )}
                    <div className="list-right-grid">
                        {list.slice(1, 5).map((news, i) => (
                            <div key={i} className="small-list-item" onClick={() => navigate(`/article/${news.id}`)}>
                                <div className="small-image">
                                    <img src={news.image} alt={news.title} onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                                </div>
                                <h3>{news.title}</h3>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Grid Section (Small items below) */}
                {grid.length > 0 && (
                    <>
                        <div className="section-divider"></div>
                        <section className="grid-section">
                            <div className="right-grid-container">
                                {grid.slice(0, 5).map((news, i) => (
                                    <div key={i} className={`grid-item-small ${i < 2 ? 'mobile-hidden' : ''}`} onClick={() => navigate(`/article/${news.id}`)}>
                                        <div className="grid-image">
                                            <img src={news.image} alt={news.title} onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                                        </div>
                                        <div className="grid-info">
                                            <h3>{news.title}</h3>
                                            <p>{news.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* Feed Section (Pagination) */}
                {feed.length > 0 && (
                    <>
                        <div className="section-divider"></div>
                        <section className="bottom-feed-section" ref={feedSectionRef}>
                            {feed.slice(0, 5).map((news, i) => (
                                <div key={i} className="feed-item" onClick={() => navigate(`/article/${news.id}`)}>

                                    {/* Left Container: Like + Text */}
                                    <div className="feed-left-container">
                                        {/* Article Date */}
                                        <div className="feed-date">
                                            {formatDate(news.date)}
                                        </div>

                                        {/* Text Info */}
                                        <div className="feed-info">
                                            <h3>{news.title}</h3>
                                            <p>{news.content}</p>
                                        </div>
                                    </div>

                                    {/* Image Right (Reduced Height: aspect-ratio 1.8/1) */}
                                    <div className="feed-image">
                                        <img src={news.image} alt={news.title} onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                                    </div>
                                </div>
                            ))}
                        </section>

                        {/* Pagination Numbers (Box Style) */}
                        {totalFeedPages > 1 && (
                            <div className="pagination-container">
                                {Array.from({ length: totalFeedPages }, (_, i) => i + 1).map((pageNum) => (
                                    <button
                                        key={pageNum}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFeedPage(pageNum);
                                            if (feedSectionRef.current) {
                                                const yOffset = -70;
                                                const y = feedSectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                                window.scrollTo({ top: y, behavior: 'auto' });
                                            }
                                        }}
                                        className={`pagination-btn ${feedPage === pageNum ? 'active' : ''}`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </React.Fragment>
        );
    };

    const totalPages = Math.max(1, Math.ceil(displayArticles.length / articlesPerPage));

    // Group articles for current page
    const startIndex = (currentPage - 1) * articlesPerPage;
    const pageArticles = displayArticles.slice(startIndex, startIndex + articlesPerPage);
    const articleBlocks = [];
    for (let i = 0; i < pageArticles.length; i += articlesPerBlock) {
        articleBlocks.push(pageArticles.slice(i, i + articlesPerBlock));
    }

    return (
        <div className="society-page category-page">
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

            <main className="category-content">
                <div className="category-header">
                    <h1>{name}</h1>
                </div>

                {loading ? (
                    <div className="skeleton-container">
                        <SkeletonNews type="main" />
                        <div className="skeleton-grid">
                            <SkeletonNews type="grid" />
                            <SkeletonNews type="grid" />
                            <SkeletonNews type="grid" />
                            <SkeletonNews type="grid" />
                        </div>
                        <SkeletonNews type="feed" />
                    </div>
                ) : articleBlocks.length > 0 ? (
                    articleBlocks.map((block, i) => renderMainContent(block, i))
                ) : (
                    <div className="empty-category">
                        <p>해당 카테고리에 표시할 기사가 없습니다.</p>
                    </div>
                )}

                {/* Pagination Removed */}
            </main>
            <MobileBottomNav />
        </div>
    );
};

export default SocietyPage;
