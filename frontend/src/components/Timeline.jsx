import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Timeline.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Timeline = ({ currentArticleId }) => {
    const navigate = useNavigate();
    const [timelineData, setTimelineData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentArticleId) return;

        const fetchTimeline = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_BASE_URL}/reports/${currentArticleId}/timeline`);
                setTimelineData(response.data);
            } catch (error) {
                console.error("Timeline fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTimeline();
    }, [currentArticleId]);

    if (loading) {
        return <div className="timeline-loading">⏳ 이슈 히스토리 로딩 중...</div>;
    }

    if (!timelineData || timelineData.length === 0) {
        return null; // 데이터가 없으면 아예 안 보여줌 (혹은 없음 메시지)
    }

    return (
        <div className="timeline-container">
            <h3 className="timeline-title">이슈 타임라인</h3>
            <ul className="timeline-list">
                {timelineData.map((item) => (
                    <li
                        key={item.id}
                        className={`timeline-item ${item.is_current ? 'current' : ''}`}
                        onClick={() => {
                            if (!item.is_current) {
                                navigate(`/article/${item.id}`);
                            }
                        }}
                    >
                        <div className="timeline-date-col">
                            <span className="timeline-date">{item.date}</span>
                            <span className="timeline-time">{item.time}</span>
                        </div>
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <div className="timeline-content-title">{item.title}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Timeline;
