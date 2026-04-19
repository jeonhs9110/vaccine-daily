import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from './Logo.png';
import './RecommendedNews.css';

const RecommendedNews = ({ allArticles, userName, imageMap = {}, subscribedKeywords = [] }) => {
    const navigate = useNavigate();
    const [recommendedArticles, setRecommendedArticles] = useState([]);

    useEffect(() => {
        // 1. Load User History
        const viewedTags = JSON.parse(localStorage.getItem('viewed_tags') || '[]');
        const viewedCats = JSON.parse(localStorage.getItem('viewed_categories') || '[]');
        const loginId = localStorage.getItem('login_id');

        // Condition 1: If no history & no login -> Hide (Return null)
        if (!loginId && viewedTags.length === 0 && viewedCats.length === 0) {
            setRecommendedArticles([]);
            return;
        }

        // 2. Filter Logic
        if (!allArticles || allArticles.length === 0) return;

        // Helper to parse keywords safely
        const parseKeywords = (art) => {
            if (Array.isArray(art.keywords)) return art.keywords;
            if (typeof art.keywords === 'string') {
                try { return JSON.parse(art.keywords); } catch { return []; }
            }
            return [];
        };

        // Score Articles
        // Subscribed Keyword: +5
        // Tag Match: +3 points
        // Category Match: +1 point
        const getKeywordText = (k) => (typeof k === 'string' ? k : k?.text || '');

        const scored = allArticles.map(art => {
            let score = 0;
            const keywords = parseKeywords(art);

            // Subscribed Keyword matching (+5)
            const subMatchCount = keywords.filter(k => subscribedKeywords.includes(getKeywordText(k))).length;
            score += subMatchCount * 5;

            // Tag matching (+3)
            const matchCount = keywords.filter(k => viewedTags.includes(getKeywordText(k))).length;
            score += matchCount * 3;

            // Category matching (+1)
            if (viewedCats.includes(art.category_name)) {
                score += 1;
            }

            return { ...art, score };
        });

        // 3. Sort & Slice
        const filtered = scored.filter(a => a.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Top 10

        setRecommendedArticles(filtered);

    }, [allArticles, subscribedKeywords]);

    const scrollRef = React.useRef(null);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (recommendedArticles.length === 0) return null;

    return (
        <section className="recommended-news-section fade-in">
            <h3 className="recommended-header">
                {userName ? `${userName}님을 위한 추천 뉴스` : '회원님을 위한 추천 뉴스'}
            </h3>
            <div className="recommended-container-wrapper">
                <button className="rec-nav-btn rec-prev" onClick={() => scroll('left')}>&#x2039;</button>
                <div className="recommended-scroll-container" ref={scrollRef}>
                    {recommendedArticles.map((art, idx) => (
                        <div
                            key={art.report_id || idx}
                            className="recommended-card"
                            onClick={() => navigate(`/article/${art.report_id}`)}
                        >
                            <div className="recommended-img-wrapper">
                                <img
                                    src={imageMap[art.image] || imageMap[`cluster_${art.cluster_id}`] || logoImg}
                                    alt={art.title}
                                    onLoad={(e) => { if (e.target.src.includes(logoImg)) { e.target.classList.add('logo-fallback'); } else { e.target.style.objectFit = 'cover'; e.target.classList.remove('logo-fallback'); } }}
                                    onError={(e) => { e.target.onerror = null; e.target.src = logoImg; e.target.classList.add('logo-fallback'); }}
                                />
                            </div>
                            <div className="recommended-info">
                                <h4 className="recommended-title">{art.title}</h4>
                                <p className="recommended-desc">{art.short_text || ''}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button className="rec-nav-btn rec-next" onClick={() => scroll('right')}>&#x203A;</button>
            </div>
        </section>
    );
};

export default RecommendedNews;
