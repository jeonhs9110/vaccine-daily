import React, { useState, useEffect, Children } from 'react';
import './Carousel.css';

/**
 * 범용 캐러셀 컴포넌트
 * @param {string} width - 전체 너비 (기본값 "auto")
 * @param {string} height - 전체 높이 (필수)
 * @param {ReactNode} children - 슬라이드 될 자식 요소들
 * @param {string} className - 커스텀 클래스
 */
function Carousel({ 
  width = "auto", 
  height, 
  children, 
  className = "" 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // children이 하나일 수도, 여러 개일 수도 있으므로 배열로 변환하여 안전하게 처리
  const slides = Children.toArray(children);
  const slideCount = slides.length;

  // 다음 슬라이드
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === slideCount - 1 ? 0 : prev + 1));
  };

  // 이전 슬라이드
  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? slideCount - 1 : prev - 1));
  };

  // 인디케이터 클릭 이동
  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  // 자동 슬라이드 (10초)
  useEffect(() => {
    if (slideCount <= 1) return; // 슬라이드가 1개 이하면 자동 넘김 없음

    const timer = setInterval(() => {
      nextSlide();
    }, 10000);

    return () => clearInterval(timer);
  }, [currentIndex, slideCount]);

  // 동적 스타일
  const containerStyle = {
    width: width,
    height: height,
  };

  return (
    <div className={`Carousel ${className}`} style={containerStyle}>
      
      {/* 슬라이드 트랙 */}
      <div 
        className="carousel-track"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((child, index) => (
          <div className="carousel-slide-item" key={index}>
            {child}
          </div>
        ))}
      </div>

      {/* 네비게이션 (슬라이드가 2개 이상일 때만 표시) */}
      {slideCount > 1 && (
        <>
          <button className="carousel-btn prev-btn" onClick={prevSlide}>&#10094;</button>
          <button className="carousel-btn next-btn" onClick={nextSlide}>&#10095;</button>
          
          <div className="carousel-indicators">
            {slides.map((_, index) => (
              <span 
                key={index} 
                className={`dot ${currentIndex === index ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
              ></span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Carousel;