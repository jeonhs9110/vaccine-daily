import React, { useState } from 'react';
import './AgeGenderChart.css';

const AgeGenderChart = ({ ageData: propAgeData, genderData: propGenderData }) => {
    const [isActive, setIsActive] = useState(false);

    // 컴포넌트 마운트 시 애니메이션 시작 (Hook은 early return 전에 호출)
    React.useEffect(() => {
        setTimeout(() => setIsActive(true), 100);
    }, []);

    // 데이터가 없으면 0명 기본값 사용
    const DEFAULT_AGE_DATA = [
        { age: '10대', count: 0 }, { age: '20대', count: 0 }, { age: '30대', count: 0 },
        { age: '40대', count: 0 }, { age: '50대', count: 0 }, { age: '60대+', count: 0 },
    ];
    const DEFAULT_GENDER_DATA = [
        { gender: '남성', count: 0 }, { gender: '여성', count: 0 },
    ];

    const ageData = (propAgeData && propAgeData.length > 0) ? propAgeData : DEFAULT_AGE_DATA;
    const genderData = (propGenderData && propGenderData.length > 0) ? propGenderData : DEFAULT_GENDER_DATA;

    const maxAgeCount = ageData.length > 0 ? Math.max(...ageData.map(d => d.count), 1) : 100;

    return (
        <div className="AgeGenderChart">
            {/* 연령대별 차트 */}
            <section className="chart-section">
                <h3 className="chart-title">연령대별 조회수</h3>
                <div className="chart-wrapper">
                    <div className="bars-container age-bars">
                        {ageData.map((item, index) => (
                            <div key={item.age} className="bar-item">
                                <div className="bar-tooltip">
                                    {item.count}명
                                </div>
                                <div className="bar-track">
                                    <div
                                        className="bar-fill age-bar-fill"
                                        style={{
                                            height: isActive ? `${(item.count / maxAgeCount) * 100}%` : '0%',
                                            transitionDelay: `${index * 0.1}s`
                                        }}
                                    />
                                </div>
                                <span className="bar-label">{item.age}</span>
                                <span className="bar-count">{item.count}명</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 성별 차트 - 파이 차트 */}
            <section className="chart-section">
                <h3 className="chart-title">성별 조회수</h3>
                <div className="chart-wrapper">
                    <div className="pie-chart-container">
                        <div className="pie-chart-wrapper">
                            <div
                                className="pie-chart"
                                style={{
                                    background: (genderData.length > 0 && isActive)
                                        ? genderData.length === 1
                                            ? (genderData[0].gender === '남성' ? '#0891b2' : '#ec4899')
                                            : `conic-gradient(
                                                #0891b2 0deg ${(genderData[0].count / (genderData[0].count + genderData[1].count)) * 360}deg,
                                                #ec4899 ${(genderData[0].count / (genderData[0].count + genderData[1].count)) * 360}deg 360deg
                                              )`
                                        : '#f0f0f0',
                                    transition: 'background 1s ease-out'
                                }}
                            >
                                <div className="pie-chart-center">
                                    <div className="pie-chart-text">
                                        {genderData.map((item, index) => {
                                            const total = genderData.reduce((sum, g) => sum + g.count, 0);
                                            const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
                                            return (
                                                <div key={item.gender} className="pie-text-item">
                                                    <span className={`pie-text-label ${item.gender === '남성' ? 'male-text' : 'female-text'}`}>
                                                        {item.gender}
                                                    </span>
                                                    <span className="pie-text-value">
                                                        {item.count}명 ({percentage}%)
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AgeGenderChart;
