import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MobileBottomNav.css';

const MobileBottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Search Overlay State
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');

    // Helper to determine active state
    // Modified to support partial matches for dynamic routes (e.g., /mypage/...)
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    // Check Login Status
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loginId = localStorage.getItem('login_id');

    const handleMyPageClick = () => {
        if (isLoggedIn && loginId) {
            navigate(`/mypage/${loginId}`);
        } else {
            navigate('/login');
        }
    };

    const toggleSearch = () => {
        setIsSearchOpen(!isSearchOpen);
        // Clear query when closing? Optional. 
        // if (isSearchOpen) setSearchQuery(''); 
    };

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
            setIsSearchOpen(false);
            setSearchQuery('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        }
    };

    return (
        <>
            {/* Search Overlay */}
            <div className={`mobile-search-overlay ${isSearchOpen ? 'open' : ''}`}>
                <div className="search-container">
                    <input
                        type="text"
                        className="mobile-search-input"
                        placeholder="검색어를 입력하세요"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="mobile-search-submit" onClick={handleSearchSubmit}>
                        검색
                    </button>
                </div>
            </div>

            <div className="mobile-bottom-nav">
                {/* 1. 뒤로가기 */}
                <div className="nav-item" onClick={() => navigate(-1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    <span>뒤로</span>
                </div>

                {/* 2. 검색 (Toggle Overlay) */}
                <div
                    className={`nav-item ${isActive('/search') || isSearchOpen ? 'active' : ''}`}
                    onClick={toggleSearch}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>검색</span>
                </div>

                {/* 3. 홈 (가운데) */}
                <div
                    className={`nav-item ${isActive('/') ? 'active' : ''}`}
                    onClick={() => navigate('/')}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>홈</span>
                </div>

                {/* 4. 마이페이지 / 로그인 (Toggle) */}
                <div
                    className={`nav-item ${isActive('/mypage') || isActive('/login') ? 'active' : ''}`}
                    onClick={handleMyPageClick}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>{isLoggedIn ? "마이페이지" : "로그인"}</span>
                </div>

                {/* 5. 앞으로 가기 */}
                <div className="nav-item" onClick={() => navigate(1)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <span>앞으로</span>
                </div>
            </div>
        </>
    );
};

export default MobileBottomNav;
