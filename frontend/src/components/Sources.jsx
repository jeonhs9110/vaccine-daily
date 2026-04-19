import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Sources.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const Sources = ({ clusterId }) => {
  const [articles, setArticles] = useState([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchArticles = async () => {
      if (!clusterId) return;

      setIsLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/reports/clusters/${clusterId}/news`);
        setArticles(response.data);
      } catch (error) {
        console.error("[Sources] 원본 기사 불러오기 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, [clusterId]);

  // [수정] handleLoadMore 함수 삭제됨

  // 전체보기 기능은 유지
  const handleShowAll = () => setVisibleCount(articles.length);

  const currentArticles = articles.slice(0, visibleCount);
  const remainingCount = articles.length - visibleCount;

  return (
    <div className="Sources">
      <h1 className="sources-header">
        참조된 원본 기사
        <span className="article-count"> ({articles.length}개)</span>
      </h1>

      {isLoading && <p style={{ padding: '10px', color: '#888' }}>불러오는 중...</p>}

      {!isLoading && articles.length === 0 && (
        <p style={{ padding: '10px', color: '#888', fontSize: '14px' }}>
          연결된 원본 기사가 없습니다.
        </p>
      )}

      <ul className="sources-list">
        {currentArticles.map((article, index) => (
          <li key={index} className="source-item">
            <span className="company-name">{article.company_name}</span>
            <span className="separator">-</span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="article-link"
            >
              {article.title}
            </a>
          </li>
        ))}
      </ul>

      {/* [수정] 10개 더보기 버튼 삭제하고 전체보기 버튼만 남김 */}
      {remainingCount > 0 && (
        <div className="load-more-container">
          <button className="load-more-button" onClick={handleShowAll}>▼ 전체보기</button>
        </div>
      )}
    </div>
  );
};

export default Sources;