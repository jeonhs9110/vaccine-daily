import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AI_News_Recommendation.css';

// [컴포넌트 설명]
// 이 컴포넌트는 현재 보고 있는 AI 기사와 연관된(키워드가 유사한) 다른 기사 3개를 추천해줍니다.
// This component recommends 3 other articles related (similar keywords) to the current AI article being viewed.

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const AI_News_Recommendation = ({ articleId, number_of_article = 3 }) => {
    const [recommendations, setRecommendations] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        // 1. articleId가 유효하지 않으면 실행하지 않음
        if (!articleId) return;

        // 2. 추천 뉴스 가져오기 함수
        const fetchRecommendations = async () => {
            try {
                // [백엔드 통신]
                // GET /reports/{id}/related
                const response = await axios.get(`${API_BASE_URL}/reports/${articleId}/related`, {
                    params: { limit: number_of_article }
                });

                // 데이터 설정
                setRecommendations(response.data);
            } catch (error) {
                // 에러 발생 시 로그 출력 (사용자에게는 빈 화면 보여줌)
                console.error("추천 뉴스를 불러오는 데 실패했습니다:", error);
            }
        };

        fetchRecommendations();
    }, [articleId, number_of_article]);

    // 추천 기사가 없으면 아무것도 렌더링하지 않음
    if (!recommendations || recommendations.length === 0) {
        return null;
    }

    // 기사 카드 클릭 시 해당 기사 페이지로 이동
    const handleCardClick = (id) => {
        // 페이지 이동 후 스크롤 최상단으로 (ArticlePage의 useEffect에서도 처리하지만 안전장치)
        navigate(`/article/${id}`);
        window.scrollTo(0, 0);
    };

    return (
        <div className="ai-news-recommendation">
            {/* 섹션 제목 */}
            <h3> 관련 AI 뉴스 추천</h3>

            <div className="ai-recommendation-list">
                {recommendations.map((news) => (
                    <div
                        key={news.id}
                        className="ai-news-card"
                        onClick={() => handleCardClick(news.id)}
                    >
                        {/* 이미지 영역: 이미지가 없으면 placeholder 처리 가능하지만, 백엔드에서 없으면 null을 줌 */}
                        {news.image_url ? (
                            <img src={news.image_url} alt={news.title} />
                        ) : (
                            // 이미지가 없을 경우 회색 박스 등으로 대체하거나 렌더링 안 함
                            <div style={{ width: '100%', height: '140px', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                                No Image
                            </div>
                        )}

                        <div className="ai-news-card-content">
                            {/* 기사 제목 */}
                            <h4>{news.title}</h4>

                            {/* 기사 요약 (40자) */}
                            <p>{news.contents_short}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AI_News_Recommendation;
