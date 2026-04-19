import React from 'react';
import './SlideItem.css';
import CarouselNewsAnalyzer from './CarouselNewsAnalyzer';

function SlideItem({ image, title, description, analysisData="" }) {
  return (
    <div className="SlideItem">
      
      {/* 1. 배경 이미지 (가장 뒤에 위치) */}
      <img src={image} alt={title} className="slide-bg-image" />

      {/* 2. 콘텐츠 오버레이 (전체를 덮고 내부에 요소 배치) */}
      <div className="content-overlay">
        
        {/* 좌측 하단 텍스트 영역 */}
        <div className="left-text-content">
          <h2 className="slide-title">{title}</h2>
          <p className="slide-description">{description}</p>
        </div>

        {/* 우측 그라데이션 및 분석 컴포넌트 영역 */}
        <div className="right-analysis-section">
          {/* 분석 컴포넌트에 데이터 전달 */}
          <CarouselNewsAnalyzer 
            width="100%"
            height="400px"
            // 슬라이드 내부에 들어가므로 폰트를 조금 줄입니다.
            fontSize="14px" 
            // 필요하다면 데이터를 props로 넘겨줍니다.
            // data={analysisData} 
          />
        </div>

      </div>
    </div>
  );
}

export default SlideItem;