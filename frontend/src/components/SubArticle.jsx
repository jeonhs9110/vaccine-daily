import React from 'react';

/**
 * [컴포넌트 설명]
 * - 명칭: SubArticle (공용 뉴스 카드 부품)
 * - 기능: 이미지 썸네일과 제목으로 구성된 작은 뉴스 카드를 생성함.
 * - 특징: 부모 컴포넌트로부터 크기(width, height)와 폰트 정보를 받아 스타일을 동적으로 결정함.
 * * [Props 가이드 - 팀원 공유용]
 * @param {string} title - 뉴스 제목 텍스트
 * @param {string} img_url - 뉴스 썸네일 이미지의 절대 경로 또는 URL
 * @param {string} width - 카드 전체의 가로 너비 (예: "300px", "100%")
 * @param {string} height - 이미지 영역의 세로 높이 (예: "180px")
 * @param {string} fontSize - 제목 텍스트의 크기 (예: "1rem", "16px")
 * @param {function} onClick - 클릭 시 실행할 함수
 */
const SubArticle = ({ title, img_url, width, height, onClick = () => {}, fontSize }) => {
  return (
    /**
     * 1. 최상위 컨테이너
     * - flex: `0 0 ${width}`: 부모가 Flex Box일 때, 카드가 압축되거나 늘어나지 않고 설정한 너비를 유지함.
     * - width: 전달받은 width 값을 그대로 적용.
     */
    <div className="sub-news-card" style={{ flex: `0 0 ${width}`, width: width }}>
      
      {/* 2. 이미지(썸네일) 영역 
          - 부모에서 지정한 height에 맞춰 영역을 확보함.
      */}
      <div className="thumb-container" style={{ height: height, overflow: 'hidden', borderRadius: '8px' }}>
        <img 
          src={img_url} 
          alt={title} 
          /**
           * objectFit: 'cover' -> 이미지가 컨테이너 크기에 맞게 비율을 유지하며 꽉 차게 설정.
           * (이미지가 찌그러지는 것을 방지함)
           */
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      
      {/* 3. 제목 영역 
          - fontSize: 부모가 지정한 폰트 크기를 적용하여 텍스트 출력.
      */}
      <div className="title-container">
        <p style={{ 
          fontSize: fontSize, 
          textAlign: "left",
          marginTop: '10px', 
          color: 'black',
          wordBreak: 'keep-all' // 단어 단위 줄바꿈으로 가독성 향상
        }}>
          {title}
        </p>
      </div>
    </div>
  );
};

export default SubArticle;