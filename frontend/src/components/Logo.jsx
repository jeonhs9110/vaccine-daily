import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Logo.css';
import logoImg from './Logo.png'; // 로고 이미지 파일

/**
 * Logo 컴포넌트: 이미지만 표시하며 클릭 시 홈('/')으로 이동
 */
function Logo({ className = "" }) {
    const navigate = useNavigate();

    const handleLogoClick = () => {
        navigate('/');
        window.scrollTo(0, 0); // 이동 시 페이지 상단으로 스크롤
    };

    return (
        <div
            className={`Logo ${className}`}
            onClick={handleLogoClick}
            role="button"
            tabIndex="0"
            onKeyDown={(e) => e.key === 'Enter' && handleLogoClick()}
        >
            <img src={logoImg} alt="백신일보" className="logo-image" />
        </div>
    );
}

export default Logo;