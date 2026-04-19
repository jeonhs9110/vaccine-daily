import React from 'react';
import './SkeletonNews.css';

const SkeletonNews = ({ type = 'list' }) => {
    // type: 'main' (big block), 'grid' (square), 'list' (row), 'feed' (row with image)

    if (type === 'main') {
        return (
            <div className="skeleton-main-wrapper">
                {/* Left Side List */}
                <div className="skeleton-side-list">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton-item-row">
                            <div className="skeleton-text-half shimmer"></div>
                            <div className="skeleton-text-full shimmer skeleton-mt-8"></div>
                        </div>
                    ))}
                </div>
                {/* Right Side Image */}
                <div className="skeleton-main-image shimmer"></div>
            </div>
        );
    }

    if (type === 'grid') {
        return (
            <div className="skeleton-grid-item">
                <div className="skeleton-rect shimmer"></div>
                <div className="skeleton-text-full shimmer skeleton-mt-10"></div>
                <div className="skeleton-text-half shimmer skeleton-mt-6"></div>
            </div>
        );
    }

    if (type === 'feed') {
        return (
            <div className="skeleton-feed-item">
                <div className="skeleton-feed-content">
                    <div className="skeleton-text-title shimmer"></div>
                    <div className="skeleton-text-full shimmer skeleton-mt-10"></div>
                    <div className="skeleton-text-full shimmer skeleton-mt-6"></div>
                </div>
                <div className="skeleton-feed-image shimmer"></div>
            </div>
        );
    }

    if (type === 'article') {
        return (
            <div className="skeleton-article-container">
                <div className="skeleton-article-title shimmer"></div>
                <div className="skeleton-article-meta shimmer"></div>
                <div className="skeleton-article-image shimmer"></div>
                <div className="skeleton-article-text shimmer"></div>
                <div className="skeleton-article-text shimmer"></div>
                <div className="skeleton-article-text shimmer skeleton-w-90"></div>
                <div className="skeleton-article-text shimmer skeleton-w-95"></div>
                <div className="skeleton-article-text shimmer skeleton-w-80"></div>
                <br />
                <div className="skeleton-article-text shimmer"></div>
                <div className="skeleton-article-text shimmer"></div>
                <div className="skeleton-article-text shimmer skeleton-w-70"></div>
            </div>
        );
    }

    return null;
};

export default SkeletonNews;
