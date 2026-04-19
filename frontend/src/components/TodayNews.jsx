import React, { useState, useEffect } from 'react';
import SubArticle from './SubArticle'; // 조원들과 약속한 Article(SubArticle) 컴포넌트
import './TodayNews.css';

/**
 * [TodayNews 컴포넌트 개요]
 * - 역할: 메인 하단 '오늘의 소식' 섹션의 레이아웃과 데이터 페칭을 담당함.
 * - 특징: 백엔드 서버 상태에 따라 [실제 데이터] 또는 [Mock 데이터]를 유연하게 렌더링함.
 */
const TodayNews = () => {
  // newsList: 화면에 뿌려줄 뉴스 객체들을 담는 배열
  const [newsList, setNewsList] = useState([]);
  // loading: API 통신 중 사용자가 대기 중임을 알리기 위한 상태 (필요 시 스피너 연결 가능)
  const [loading, setLoading] = useState(true);

  /**
   * [개발용 테스트 데이터 (Fallback Data)]
   * - 용도: 백엔드(FastAPI) 서버가 구동되지 않거나 에러 발생 시 UI 확인용으로 출력.
   * - 형식: 조원들과 협의한 Article 컴포넌트의 props 구조를 따름.
   */
  const mockData = [
    {
      "id": 1,
      "title": "[MOCK] 의대 증원 갈등, 의료계 현장 리포트",
      "imageUrl": "https://image.ichannela.com/images/channela/2026/01/02/000002924491/00000292449120260102113532802.webp"
    },
    {
      "id": 2,
      "title": "[MOCK] 정부, 필수의료 패키지 지원책 발표",
      "imageUrl": "https://via.placeholder.com/300x180/444/fff?text=News2"
    },
    {
      "id": 3,
      "title": "[MOCK] 지역 의사제 도입에 대한 찬반 논란",
      "imageUrl": "https://via.placeholder.com/300x180/444/fff?text=News3"
    }
  ];

  useEffect(() => {
    /**
     * [비동기 데이터 로드 함수]
     * - 성공 시: FastAPI로부터 받은 실제 데이터를 newsList에 저장.
     * - 실패 시: catch 블록에서 mockData를 대신 저장하여 화면 깨짐 방지.
     */
    const fetchNews = async () => {
      try {
        setLoading(true);
        // [수정 포인트] 조원들이 배포한 실제 FastAPI 엔드포인트 URL로 교체 필요
        const response = await fetch('http://127.0.0.1:8000/api/news');

        if (response.ok) {
          const data = await response.json();
          setNewsList(data);
        } else {
          setNewsList(mockData);
        }
      } catch (error) {
        /**
         * [에러 처리]
         * - 서버가 꺼져있거나(Network Error), CORS 정책 문제가 있을 때 실행됨.
         * - 사용자에게 빈 화면을 보여주는 대신 테스트 데이터를 노출함.
         */
        setNewsList(mockData);
      } finally {
        setLoading(false); // 성공/실패 여부와 상관없이 로딩 종료
      }
    };

    fetchNews();
  }, []); // 컴포넌트 마운트 시 최초 1회만 실행

  return (
    <section className="today-news-section">
      <h3 className="section-header">오늘의 소식</h3>

      {/* [가로 스크롤 레이아웃 가이드]
        - news-grid-wrapper: Flex를 통해 자식들을 가로로 나열.
        - overflowX: 'auto': 아이템이 많아지면 사용자가 마우스나 터치로 가로 스크롤 가능.
      */}
      <div className="news-grid-wrapper">
        {newsList.map((news) => (
          /**
           * - 유연성: 부모에서 width/height를 조절함으로써 카드 크기를 즉시 변경 가능.
           */
          <SubArticle
            key={news.id}       // 리액트 효율성을 위한 고유 키값
            id={news.id}        // 상세 페이지 이동을 위한 ID
            title={news.title}  // 기사 제목
            img_url={news.imageUrl} // 서버 데이터(imageUrl)를 조원들의 변수명(img_url)으로 매핑
            width="300px"       // 섹션 컨셉에 맞춘 카드 너비
            height="180px"      // 이미지 비율 16:9 유지를 위한 높이
            fontSize="1rem"     // 제목 가독성을 위한 폰트 크기
          />
        ))}
      </div>
    </section>
  );
};

export default TodayNews;