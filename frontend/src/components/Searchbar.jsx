import './Searchbar.css';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Searchbar 컴포넌트: 사용자의 입력값을 받아 검색 로직을 수행하는 바 형태의 UI
 * * @param {string} maxWidth - 검색창의 최대 너비 (예: "500px", "100%")
 * @param {string} fontSize - 입력창 및 아이콘의 기준 폰트 크기 (예: "16px")
 * @param {string} className - 외부에서 추가할 CSS 클래스 이름
 * @param {function} onSearch - 검색 실행 시 호출될 콜백 함수
 */
function Searchbar({ maxWidth, fontSize, className, onSearch }) {
    const navigate = useNavigate();
    // 사용자가 입력창에 타이핑하는 텍스트 상태 관리
    const [inputText, setInputText] = useState("");

    /**
     * 실제 검색 로직을 처리하는 함수
     */
    const handleSearch = () => {
        if (inputText.trim() !== "") {
            if (onSearch) {
                onSearch(inputText);
            } else {
                navigate(`/search?q=${encodeURIComponent(inputText)}&t=${Date.now()}`);
            }
        }
    };

    /**
     * 키보드 이벤트 핸들러: 'Enter' 키 감지
     */
    const onKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // Props로 받은 maxWidth와 fontSize를 CSS 변수로 적용
    const style = {};
    if (maxWidth) style['--search-max-width'] = maxWidth;
    if (fontSize) {
        style['--search-font-size'] = fontSize;
        style['--search-icon-size'] = `calc(${fontSize} + 6px)`;
    }

    return (
        // 외부에서 전달받은 className을 기본 클래스와 결합
        <div className={`Searchbar ${className}`} style={style}>
            {/* maxWidth 스타일 적용 */}
            <div className="search-box">
                <input
                    type="text"
                    placeholder=""
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={onKeyPress}
                />

                <button onClick={handleSearch} aria-label="search">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default Searchbar;
