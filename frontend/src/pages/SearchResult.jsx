import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import "./SearchResult.css";
import Header from "../components/Header";
import Logo from "../components/Logo";
import UserMenu from "../components/UserMenu";
import Searchbar from "../components/Searchbar";
import Button from "../components/Button";

import MobileBottomNav from '../components/MobileBottomNav';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export default function SearchResult() {
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [searchData, setSearchData] = useState(null);
    const [visibleNewsCount, setVisibleNewsCount] = useState(3);
    const [visibleIssueCount, setVisibleIssueCount] = useState(5);
    const [hasDbResult, setHasDbResult] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ... (existing code)

    const handleSearch = useCallback(async (keyword) => {
        if (!keyword) return;
        setSearchTerm(keyword);
        setIsLoading(true);
        setSearchData(null);
        setHasDbResult(false);
        setVisibleNewsCount(3);
        setVisibleIssueCount(5);

        try {
            const res = await axios.get(`${API_BASE_URL}/api/comprehensive-search`, {
                params: { keyword: keyword }
            });

            // 추가 요청: 핫토픽에 검색 키워드가 포함된 기사 표시 (/reports/search 호출)
            try {
                const reportsRes = await axios.get(`${API_BASE_URL}/reports/search`, {
                    params: { keyword: keyword, limit: 100 }
                });
                const filteredReports = reportsRes.data;

                if (filteredReports.length > 0) {
                    // Hot Topics 데이터 덮어쓰기 (기존 comprehensive-search 결과 대신 사용)
                    // 데이터 구조 매핑: id, title, url, img_urls, report_id

                    // 이미지를 병렬로 로딩 (Promise.all)
                    const mappedHotTopics = await Promise.all(
                        filteredReports.map(async (report) => {
                            let imgUrl = [];
                            try {
                                if (report.cluster_id) {
                                    const imgRes = await axios.get(`${API_BASE_URL}/reports/clusters/${report.cluster_id}/news`);
                                    const newsList = imgRes.data;
                                    if (newsList && newsList.length > 0) {
                                        for (const newsItem of newsList) {
                                            if (newsItem.img_urls) {
                                                let parsedUrls = newsItem.img_urls;
                                                if (typeof parsedUrls === 'string') {
                                                    try { parsedUrls = JSON.parse(parsedUrls); } catch (e) { parsedUrls = []; }
                                                }
                                                if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
                                                    const validUrl = parsedUrls.find(url => url);
                                                    if (validUrl) { imgUrl = [validUrl]; break; }
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (err) { /* ignore */ }
                            return {
                                id: report.report_id,
                                report_id: report.report_id,
                                title: report.title,
                                url: report.url || `/article/${report.report_id}`,
                                img_urls: imgUrl
                            };
                        })
                    );

                    res.data.hot_topics = mappedHotTopics;
                }
            } catch (reportError) {
                console.error("핫토픽 검색(Reports) 중 오류 발생:", reportError);
                // 실패해도 기존 comprehensive-search 결과는 유지
            }

            const data = res.data;
            setSearchData(data);

            // DB 결과 존재 여부 확인 (AI 요약, 핫토픽, 관련기사 중 하나라도 있으면 성공)
            const dbExists = (data.ai_summaries && data.ai_summaries.issues && data.ai_summaries.issues.length > 0) ||
                (data.hot_topics && data.hot_topics.length > 0) ||
                (data.articles && data.articles.length > 0);

            setHasDbResult(dbExists);

        } catch (error) {
            console.error("검색 중 오류 발생:", error);
            setHasDbResult(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const q = searchParams.get('q');
        if (q) {
            handleSearch(q);
        }
    }, [location.search, handleSearch]);

    // 더보기 버튼 핸들러
    const handleLoadMore = useCallback(() => {
        setVisibleNewsCount(prev => prev + 3);
    }, []);

    // 접기 버튼 핸들러
    const handleCollapse = useCallback(() => {
        setVisibleNewsCount(prev => Math.max(3, prev - 3));
    }, []);

    return (
        <div className="SearchResult_Main">
            <Header
                leftChild={null}
                midChild={<Logo />}
                rightChild={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', width: 'auto' }}>
                        <div style={{ position: 'relative' }}>
                            <Searchbar className="always-open rounded-search" />
                        </div>
                        <UserMenu className="rounded-user-menu" />
                    </div>
                }
                headerTop="on"
                headerMain="on"
                headerBottom="on"
            />

            <div className="Content_Section">
                <div className="SearchResult_Content">
                    <div className="Title_Wrapper">
                        <h3 className="AI_Title">
                            {isLoading ? (
                                <>
                                    <span style={{ fontWeight: '800', fontSize: '1.5rem' }}>'{searchTerm}'</span>
                                    <span style={{ fontWeight: 'normal', fontSize: '1.3rem', marginLeft: '5px' }}> 을(를) 조회중입니다...</span>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontWeight: '800', fontSize: '1.5rem' }}>'{searchTerm}'</span>
                                    <span style={{ fontWeight: 'normal', fontSize: '1.3rem', marginLeft: '5px' }}> 검색 결과</span>
                                </>
                            )}
                        </h3>
                    </div>

                    <div className="AI_Content_Wrapper">
                        {isLoading ? (
                            <div className="Loading_Container" style={{ width: '100%', minHeight: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <div className="Loading_Spinner"></div>
                            </div>
                        ) : (
                            hasDbResult && searchData ? (
                                <div style={{ display: 'flex', width: '100%', gap: '40px' }}>
                                    {/* --- [왼쪽 섹션] AI요약 + 관련기사 --- */}
                                    <div className="AI_Left_Section fade-in">

                                        {/* 1. 종합 리포트 리스트 */}
                                        {searchData.ai_summaries && searchData.ai_summaries.issues && searchData.ai_summaries.issues.length > 0 && (
                                            <div className="Analysis_Text_Section" style={{ paddingBottom: '10px' }}>
                                                <h2 className="Section_Title_Main" style={{
                                                    fontSize: '26px',
                                                    fontWeight: '800',
                                                    marginBottom: '25px',
                                                    lineHeight: '1',
                                                    color: '#000'
                                                }}>종합 리포트</h2>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                                    {searchData.ai_summaries.issues.slice(0, visibleIssueCount).map(issue => (
                                                        <div
                                                            key={issue.report_id}
                                                            onClick={() => { window.location.href = `/article/${issue.report_id}`; }}
                                                            style={{
                                                                padding: '16px 0',
                                                                borderBottom: '1px solid #eee',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.15s',
                                                            }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f8f8'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            <div style={{ fontSize: '17px', fontWeight: '700', color: '#111', marginBottom: '6px', lineHeight: '1.4' }}>
                                                                {issue.title}
                                                            </div>
                                                            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                {issue.contents}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {visibleIssueCount < searchData.ai_summaries.issues.length && (
                                                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                                        <div
                                                            style={{
                                                                display: 'inline-block',
                                                                background: '#fff',
                                                                padding: '10px 25px',
                                                                borderRadius: '30px',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                                border: '1px solid #eee',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onClick={() => setVisibleIssueCount(prev => prev + 5)}
                                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'none'; }}
                                                        >
                                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#5f6368' }}>
                                                                더보기 ({Math.min(searchData.ai_summaries.issues.length - visibleIssueCount, 5)}건)
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 2. 관련기사 리스트 (Related_News_Section) - 데이터 있을 때만 표시 */}
                                        {searchData.articles && searchData.articles.length > 0 && (
                                            <div className="Related_News_Section" style={{ marginTop: '40px', width: '100%', textAlign: 'left' }}>
                                                <h2 style={{
                                                    fontSize: '24px',
                                                    fontWeight: '800',
                                                    marginBottom: '25px',
                                                    lineHeight: '1',
                                                    color: '#000'
                                                }}>관련 기사</h2>
                                                <ul className="News_List">
                                                    {searchData.articles.slice(0, visibleNewsCount).map(item => (
                                                        <li key={item.id} onClick={() => window.open(item.url)} style={{ fontSize: '15px' }}>
                                                            <span style={{ color: '#f33a3aff', fontWeight: 'bold' }}>[{item.company_name}]</span> {item.title}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div style={{ textAlign: 'center', marginTop: '30px', display: 'flex', gap: '15px', justifyContent: 'center' }}>
                                                    {visibleNewsCount < searchData.articles.length && (
                                                        <div style={{
                                                            display: 'inline-block',
                                                            background: '#fff',
                                                            padding: '10px 25px',
                                                            borderRadius: '30px',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                            border: '1px solid #eee',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                            onClick={handleLoadMore}
                                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'none'; }}
                                                        >
                                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#5f6368', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                더보기 ▼
                                                            </span>
                                                        </div>
                                                    )}
                                                    {visibleNewsCount > 3 && (
                                                        <div style={{
                                                            display: 'inline-block',
                                                            background: '#fff',
                                                            padding: '10px 25px',
                                                            borderRadius: '30px',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                            border: '1px solid #eee',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                            onClick={handleCollapse}
                                                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'none'; }}
                                                        >
                                                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#5f6368', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                접기 ▲
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* --- [오른쪽 섹션] 핫토픽 - 데이터 있을 때만 표시 --- */}
                                    {searchData.hot_topics && searchData.hot_topics.length > 0 && (
                                        <div className="AI_Right_Section fade-in" style={{ animationDelay: '0.1s' }}>
                                            <div className="Hot_Topic_Section" style={{ marginTop: '-10px' }}>
                                                <h2 style={{
                                                    fontSize: '24px',
                                                    fontWeight: '800',
                                                    marginBottom: '20px',
                                                    lineHeight: '1',
                                                    color: '#000'
                                                }}>핫토픽!</h2>
                                                <div className="Topic_Cards">
                                                    {searchData.hot_topics.slice(0, 4).map(item => (
                                                        <div
                                                            key={item.id}
                                                            className="Topic_Card"
                                                            onClick={() => {
                                                                if (item.report_id) {
                                                                    window.location.href = `/article/${item.report_id}`;
                                                                } else {
                                                                    window.open(item.url);
                                                                }
                                                            }}
                                                        >
                                                            <div className="Image_Wrapper">
                                                                <img
                                                                    src={item.img_urls[0]}
                                                                    alt={item.title}
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="Card_Text">{item.title}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="No_Result_Container">
                                    <h2>'{searchTerm}'에 대한 검색 결과가 없습니다.</h2>
                                    <p>데이터베이스 내에 일치하는 정보가 존재하지 않습니다.</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div >
            <MobileBottomNav />
        </div >
    );
}
