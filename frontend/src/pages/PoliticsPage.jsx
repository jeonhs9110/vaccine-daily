import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import Logo from '../components/Logo';
import logoImg from '../components/Logo.png';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import SkeletonNews from '../components/SkeletonNews';
import { formatDate } from '../utils/dateUtils';
import MobileBottomNav from '../components/MobileBottomNav';
import './PoliticsPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const PoliticsPage = () => {
    const name = '정치';
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [displayArticles, setDisplayArticles] = useState([]);
    const [imageMap, setImageMap] = useState({});
    const [feedPage, setFeedPage] = useState(1);
    const [topFocusIndex, setTopFocusIndex] = useState(0); // State for slideshow focus
    const [loading, setLoading] = useState(true);
    const feedSectionRef = useRef(null);

    // Slideshow State (Mobile Whole Section)
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
                // 1. Fetch AI Generated News (Limit 1000 to ensure coverage)
                const response = await axios.get(`${API_BASE_URL}/reports?limit=1000`);
                const realArticles = response.data;

                // 2. Map Backend Data to Frontend Structure
                const formattedArticles = realArticles.map(art => ({
                    ...art,
                    id: art.report_id, // [Fix] Map native ID to 'id'
                    category: art.category_name, // Map category_name to category
                    image: `cluster_${art.cluster_id}`, // Placeholder ID for image map,
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

                    // 4. Fetch Images for the filtered set (N+1 pattern)
                    // Only need to fetch for unique cluster IDs in the filtered set
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

    // 1 Main + 4 Grid + 8 List + 20 Feed items (4 pages * 5) = 33 items total
    const articlesPerBlock = 33;
    const blocksPerPage = 1;
    const articlesPerPage = articlesPerBlock * blocksPerPage;

    const renderMainContent = (blockArticles, blockIndex) => {
        if (!blockArticles || blockArticles.length === 0) return null;

        const slideArticles = blockArticles.slice(0, 4); // Top 4 for Slideshow

        // Ensure Grid articles DO NOT duplicate any Slide articles
        const slideIds = new Set(slideArticles.map(a => a.id));
        const remainingArticles = blockArticles.slice(4).filter(art => !slideIds.has(art.id));

        const gridArticles = remainingArticles.slice(0, 4); // Next 4 for Grid
        const listArticles = remainingArticles.slice(4, 12); // Next 8 for List

        // Feed Logic: Exclude articles already shown in Main, Grid, and List sections (4 slide, 4 grid)
        const allFeedArticles = remainingArticles.slice(8);
        const feedPageSize = 5;
        const totalFeedPages = Math.ceil(allFeedArticles.length / 5);
        const currentFeedArticles = allFeedArticles.slice((feedPage - 1) * 5, feedPage * 5);

        // Slideshow Data Preparation
        const slideData = slideArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "뉴스 제목 예시",
            description: art?.short_text || "내용 예시...",
            image: art ? (imageMap[art.image] || art.image) : null
        }));

        const activeSlide = slideData[topFocusIndex] || slideData[0];
        const carouselArticles = blockArticles.slice(0, 3);

        const grid = gridArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "제목 예시",
            content: art?.short_text || "내용 예시...",
            image: art ? (imageMap[art.image] || art.image) : null,
            // Simple grid item without related links for now, as user requested "layout" primarily. 
            // If related links are needed, we need more data slices.
        }));



        const list = listArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "제목 예시",
            content: art?.short_text || "내용 예시...",
            image: art ? (imageMap[art.image] || art.image) : null
        }));

        const feed = currentFeedArticles.map((art, i) => ({
            id: art?.id,
            title: art?.title || "제목 예시",
            content: art?.short_text || "내용 예시...",
            image: art ? (imageMap[art.image] || art.image) : null,
            date: art?.created_at
        }));

        return (
            <React.Fragment key={blockIndex}>
                <section className="politics-main-section desktop-only-section">

                    {/* Left Column: Interactive List (4 Items) */}
                    <div className="politics-content-side">
                        {slideData.slice(0, 4).map((item, idx) => {
                            const isActive = idx === topFocusIndex;
                            return (
                                <div
                                    key={idx}
                                    className={`politics-slide-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setTopFocusIndex(idx)}
                                >
                                    <div className="hot-badge">최신</div>
                                    <h2>
                                        {item.title}
                                    </h2>
                                    {isActive && (
                                        <p>
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                            );
                        })}

                        {/* Divider */}
                        <div className="politics-side-divider"></div>
                    </div>

                    {/* Right Column: Active Image Display */}
                    <div className="politics-image-side" onClick={() => activeSlide && navigate(`/article/${activeSlide.id}`)}>
                        <div className="article-image-center">
                            <img src={activeSlide?.image} alt="Main"
                                onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }}
                                onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />

                            {/* Optional Overlay Title on Image if desired, but user just asked for interaction */}
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

                {/* Grid Section (4 items) */}
                {grid.length > 0 && (
                    <section className="bottom-grid-section">
                        {grid.slice(0, 4).map((news, i) => (
                            <div key={i} className={`grid-item ${i < 2 ? 'mobile-hidden' : ''}`} onClick={() => navigate(`/article/${news.id}`)}>
                                <div className="grid-image">
                                    <img src={news.image} alt={news.title} onLoad={(e) => { if (!e.target.src.includes(logoImg)) e.target.style.objectFit = 'cover'; }} onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.style.objectFit = 'contain'; }} />
                                </div>
                                <div className="grid-info">
                                    <h3>{news.title}</h3>
                                    <p>
                                        {news.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </section>
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
                                            <p>
                                                {news.content}
                                            </p>
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
        <div className="politics-page category-page">
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
                        <SkeletonNews type="feed" />
                    </div>
                ) : articleBlocks.length > 0 ? (
                    articleBlocks.map((block, i) => renderMainContent(block, i))
                ) : (
                    <div className="empty-category">
                        <p>해당 카테고리에 표시할 기사가 없습니다.</p>
                    </div>
                )}
            </main>
            <MobileBottomNav />
        </div>
    );
};

export default PoliticsPage;