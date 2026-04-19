import React, { useState, useEffect } from 'react';
import './RightSideBar.css';

import axios from 'axios'; // axios 임포트 확인

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export default function RightSideBar({ isOpen, onClose, searchKeyword, searchCompany, clusterId }) {
  const [isLoading, setIsLoading] = useState(false);
  const [sourceList, setSourceList] = useState(null);

  useEffect(() => {
    // 사이드바가 열려있고, clusterId가 있을 때만 데이터 로드
    if (isOpen && clusterId) {
      const fetchArticles = async () => {
        setIsLoading(true);
        setSourceList(null);

        try {
          // 1. 문장이 선택된 경우 -> /citation (유사도 정렬)
          if (searchKeyword) {
            const response = await axios.post(`${API_BASE_URL}/reports/citation`, {
              cluster_id: clusterId,
              target_sentence: searchKeyword
            });

            if (response.data.match_found) {
              // 매핑: backend returns matches: [ { id, score, match_text, company, title, url, date, content }, ... ]
              const mappedData = response.data.matches.map(item => ({
                id: item.id,
                company: item.company,
                title: item.title,
                content: item.content,
                date: item.date ? item.date.substring(0, 10) : "",
                url: item.url,
                score: item.score,      // 유사도 점수
                match_text: item.match_text // 가장 유사한 문장
              }));
              let filteredData = mappedData;
              if (searchCompany) {
                // Filter by company if provided (e.g. from Evidence click)
                filteredData = mappedData.filter(item => item.company === searchCompany);

                // If filtering results in empty list, maybe show all but warn? 
                // For now, strict filtering as requested.
                // If 0 results, maybe the company name mismatch? try lax matching?
                // Let's assume exact match for now as they come from same source.
              }

              setSourceList(filteredData);
            } else {
              setSourceList([]);
            }
          }
          // 2. 문장이 선택 안 된 경우 -> 기존 로직 (단순 기사 목록)
          else {
            const response = await axios.get(`${API_BASE_URL}/reports/clusters/${clusterId}/news`);

            const mappedData = response.data.map(item => ({
              id: item.news_id, // crud update 반영
              company: item.company_name,
              title: item.title,
              content: item.contents,
              date: item.created_at ? String(item.created_at).substring(0, 10) : "",
              url: item.url
            }));
            setSourceList(mappedData);
          }
        } catch (error) {
          console.error("Failed to fetch sidebar articles:", error);
          setSourceList([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchArticles();
    }
  }, [isOpen, clusterId, searchKeyword, searchCompany]); // added searchCompany dependency

  // [Sticky Logic] 헤더 높이만큼 아래에서 시작했다가, 스크롤 시 위로 붙음
  const HEADER_HEIGHT = 160; // Adjusted to 160px per user request
  const [stickyTop, setStickyTop] = useState(HEADER_HEIGHT);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) return; // 모바일에서는 스크롤 계산 불필요

    const handleScroll = () => {
      const newTop = Math.max(0, HEADER_HEIGHT - window.scrollY);
      setStickyTop(newTop);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside
        className={`right-sidebar ${isOpen ? 'open' : ''}`}
        style={!isMobile ? {
          top: stickyTop,
          height: `calc(100vh - ${stickyTop}px)`
        } : {}}
      >
        <div className="sidebar-header">
          <div className="header-text">
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {searchKeyword ? "관련 기사 (유사도순)" : "참조된 원본 기사"}
            </h3>
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#666' }}>
              {searchKeyword
                ? "선택한 문장과 가장 내용이 유사한 기사를 찾았습니다."
                : "이 AI 뉴스를 생성하는 데 사용된 원본 기사들입니다."}
            </p>
          </div>
          <button onClick={onClose} className="close-btn" title="닫기">✕</button>
        </div>

        <div className="sidebar-content">
          {isLoading && (
            <div className="loading-container">
              <div className="loader"></div>
              <p>관련 기사를 분석하고 있습니다...</p>
            </div>
          )}

          {!isLoading && sourceList && (
            <div className="fade-in">
              {searchKeyword && (
                <div className="selected-sentence-box">
                  <span className="label">선택된 문장</span>
                  <p>"{searchKeyword}"</p>
                </div>
              )}

              <div className="article-list">
                {sourceList.map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="article-card"
                  >
                    <div className="card-header">
                      <span className="company-badge">{article.company}</span>
                      <span className="article-date">{article.date}</span>
                      {article.score && (!sourceList || sourceList.length > 1) && (
                        <span
                          className="similarity-badge"
                          style={{
                            marginLeft: 'auto',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            color: article.score >= 70 ? '#16a34a' : (article.score >= 40 ? '#ea580c' : '#dc2626')
                          }}
                        >
                          {article.score}% 일치
                        </span>
                      )}
                    </div>
                    <h4 className="article-title">{article.title}</h4>

                    {/* 유사도 모드일 땐 'match_text'를 강조해서 보여주고, 아니면 content 요약 */}
                    {article.match_text ? (
                      <div className="match-highlight" style={{ fontSize: '0.9rem', color: '#555', background: '#f9f9f9', padding: '10px', borderRadius: '4px', marginTop: '8px', lineHeight: '1.5' }}>
                        "... {article.match_text} ..."
                      </div>
                    ) : (
                      <p className="article-summary">{article.content}</p>
                    )}

                    <div className="card-footer">
                      원문 보러가기 &rarr;
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !sourceList && (
            <div className="empty-state">
              <p>왼쪽 본문에서 문장을 클릭해주세요.</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}