import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useToast } from './Toast';
import './LikeButton.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const LikeButton = ({ articleId, initialLiked = false, initialCount = 0, onLikeUpdate }) => {
    const showToast = useToast();
    const [isLiked, setIsLiked] = useState(initialLiked);
    const [likeCount, setLikeCount] = useState(initialCount);

    // 애니메이션 방향 상태 ('up' | 'down' | '')
    const [direction, setDirection] = useState('');

    // 이전 값을 추적하기 위한 ref
    const prevCountRef = useRef(initialCount);

    // props가 변경되면 state 업데이트
    useEffect(() => {
        setIsLiked(initialLiked);
        setLikeCount(initialCount);
    }, [initialLiked, initialCount]);

    useEffect(() => {
        // 숫자가 변할 때 방향 결정
        if (likeCount > prevCountRef.current) {
            setDirection('up');
        } else if (likeCount < prevCountRef.current) {
            setDirection('down');
        }
        prevCountRef.current = likeCount;
    }, [likeCount]);

    const handleClick = async () => {
        const login_id = localStorage.getItem('login_id');

        // 로그인 확인
        if (!login_id) {
            showToast('로그인이 필요합니다.', 'warning');
            return;
        }

        const prevLiked = isLiked;
        const prevCount = likeCount;
        const nextLiked = !prevLiked;

        // 1. 낙관적 업데이트
        setIsLiked(nextLiked);
        setLikeCount(nextLiked ? prevCount + 1 : prevCount - 1);

        try {
            // 2. 백엔드 API 호출
            const response = await axios.post(
                `${API_BASE_URL}/news/${articleId}/reaction`,
                null,
                {
                    params: {
                        value: 1, // 1 = 좋아요
                        login_id: login_id
                    }
                }
            );

            // 3. 서버 응답으로 실제 좋아요 수 동기화
            const actualLikeCount = response.data.likes;
            const actualIsLiked = response.data.status !== 'removed';

            setLikeCount(actualLikeCount);
            setIsLiked(actualIsLiked);

            // 4. 부모 컴포넌트에 업데이트 알림
            if (onLikeUpdate) {
                onLikeUpdate(actualLikeCount, actualIsLiked);
            }
        } catch (error) {
            console.error('좋아요 처리 실패:', error);
            // 실패 시 롤백
            setIsLiked(prevLiked);
            setLikeCount(prevCount);
            showToast('좋아요 처리에 실패했습니다.', 'error');
        }
    };

    const activeColor = "#007BFF"; // 파란색 (Blue)

    return (
        <button
            className={`like-btn ${isLiked ? 'liked' : ''}`}
            onClick={handleClick}
        >
            {/* 아이콘은 고정 (애니메이션 없음) */}
            <svg
                width="20" height="20" viewBox="0 0 24 24"
                fill={isLiked ? activeColor : "none"}
                stroke={isLiked ? activeColor : "currentColor"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>

            {/* 숫자 애니메이션 컨테이너 */}
            <div className="count-container">
                {/* key가 바뀌면 리액트는 아예 새로운 요소로 인식함 -> 애니메이션 재실행 */}
                <span key={likeCount} className={`count-text ${direction}`}>
                    {likeCount}
                </span>
            </div>
        </button>
    );
};

export default LikeButton;