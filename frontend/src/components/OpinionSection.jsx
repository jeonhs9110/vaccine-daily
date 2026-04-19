import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OpinionSection.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const renderClickableEvidence = (text, company, onSentenceClick) => {
    if (!text || !onSentenceClick) return text;
    return text.split('\n').map((line, lIdx) => (
        <p key={lIdx} style={{ margin: 0 }}>
            {line.split('. ').map((stmt, sIdx) => {
                let s = stmt.trim();
                if (!s) return null;
                const endsWithPunct = /[.!?…]$/.test(s);
                const fullSentence = s + (endsWithPunct ? '' : '.');
                return (
                    <span
                        key={sIdx}
                        className="clickable-sentence"
                        onClick={(e) => {
                            e.stopPropagation();
                            onSentenceClick(fullSentence, company);
                        }}
                    >
                        {fullSentence}{' '}
                    </span>
                );
            })}
        </p>
    ));
};

const OpinionSection = ({ reportId, cachedOpinions, onSentenceClick }) => {
    const [opinions, setOpinions] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!reportId) return;

        // 부모에서 이미 데이터를 가져왔으면 바로 사용 (빈 배열도 "없음" 의미)
        if (Array.isArray(cachedOpinions)) {
            setOpinions(cachedOpinions);
            return;
        }

        const fetchOpinions = async () => {
            setLoading(true);
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/reports/${reportId}/opinions`
                );
                setOpinions(response.data);
            } catch (error) {
                console.error("[Opinions] 오피니언 분석 불러오기 실패:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchOpinions();
    }, [reportId, cachedOpinions]);

    if (!loading && opinions.length === 0) return null;

    return (
        <div className="opinion-section">
            <h3 className="section-title" style={{ textAlign: 'left' }}>
                언론사별 오피니언 · 사설
            </h3>

            {loading ? (
                <p className="opinion-loading">오피니언 분석 중...</p>
            ) : (
                <>
                    <div className={`opinion-comparison-container ${isExpanded ? 'expanded' : 'collapsed'}`}>
                        <ul className="opinion-comparison-list">
                            {opinions.map((item, idx) => (
                                <li key={idx} className="opinion-comparison-item">
                                    <div className="opinion-company-header">
                                        <div className="opinion-badge-row">
                                            <span className="opinion-company-badge">
                                                {item.company}
                                            </span>
                                        </div>
                                        <div className="opinion-hashtags">
                                            {item.hashtags && item.hashtags.map((tag, tIdx) => (
                                                <span key={tIdx} className="opinion-hashtag-badge">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="opinion-summary-text">
                                        {item.summary}
                                    </p>
                                    {isExpanded && item.evidence && (
                                        <div className="opinion-evidence-text" style={{ marginTop: '4px', fontSize: '0.9rem', color: '#5f6368', lineHeight: '1.5', textAlign: 'left' }}>
                                            {renderClickableEvidence(item.evidence, item.company, onSentenceClick)}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    {opinions.length > 0 && (
                        <div className="opinion-show-more">
                            <button onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? '접기' : '더보기'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default OpinionSection;
