import React from 'react';
import './CarouselNewsAnalyzer.css';

/**
 * 비교분석 섹션 컴포넌트
 * @param {string} width - 컴포넌트 너비 (예: "300px", "100%")
 * @param {string} height - 컴포넌트 높이 (예: "400px", "100%")
 * @param {string} fontSize - 기본 폰트 크기 (예: "14px", "1rem")
 * @param {string} className - 추가적인 커스텀 클래스명
 */
function CarouselNewsAnalyzer({ 
  width = '100%', 
  height = '100%', 
  fontSize = '1rem', 
  className = '' 
}) {
  
  // 데이터 (추후 props로 분리 가능)
  const data = {
    support: {
      title: "필수의료 회복 강조",
      content: "5개 언론사가 정부의 2천명 증원안에 지지를 표명..."
    },
    concern: {
      title: "부작용 및 절차 우려",
      content: "3개 언론사가 2천 명이라는 수치의 근거와 방식에 우려 표명..."
    }
  };

  // 동적 스타일 생성
  const dynamicStyle = {
    width: width,
    height: height,
    fontSize: fontSize, // 이 값을 기준으로 내부 em 단위가 반응합니다.
  };

  return (
    <div 
      className={`CarouselNewsAnalyzer ${className}`} 
      style={dynamicStyle}
    >
      
      {/* 긍정/지지 (붉은색) */}
      <div className="analyzer-block accent-red">
        <div className="vertical-bar"></div>
        <div className="text-wrapper">
          <h3>{data.support.title}</h3>
          <p>{data.support.content}</p>
        </div>
      </div>

      {/* 부정/우려 (푸른색) */}
      <div className="analyzer-block accent-blue">
        <div className="vertical-bar"></div>
        <div className="text-wrapper">
          <h3>{data.concern.title}</h3>
          <p>{data.concern.content}</p>
        </div>
      </div>

    </div>
  );
}

export default CarouselNewsAnalyzer;