import React from 'react';

const CategoryRadarChart = ({
  labels = [],         // ['정치', '경제'...] 또는 ['조선일보', '중앙일보'...]
  targetScores = {},   // { '정치': 5 } 또는 { '조선일보': 8 }
  dynamicLimit = 10,
  isActive = false,
  title = "나의 관심사" // 차트 제목도 가변적으로 처리
}) => {

  const getCoordinates = (scores, limit, active) => {
    const center = 100, radius = 60;
    const total = labels.length; // 카테고리 개수에 따라 각도 자동 계산

    return labels.map((label, i) => {
      // 360도(2*PI)를 카테고리 개수만큼 나눔
      const angle = (2 * Math.PI / total) * i - Math.PI / 2;
      const scoreRatio = active ? (scores[label] || 0) / limit : 0;
      return `${center + radius * scoreRatio * Math.cos(angle)},${center + radius * scoreRatio * Math.sin(angle)}`;
    }).join(' ');
  };

  return (
    <section className="info-section">
      <h3 className="section-title">{title}</h3>
      <div className="chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '500px', aspectRatio: '500/350', margin: '0 auto' }}>
          <svg viewBox="-20 10 250 180" className="w-full h-full" style={{ overflow: 'visible' }}>
            {/* 가이드 라인 생성을 위한 로직 - 가변 라벨 대응 */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
              <polygon
                key={r}
                points={getCoordinates(Object.fromEntries(labels.map(l => [l, dynamicLimit * r])), dynamicLimit, true)}
                fill="none" stroke="#f0f0f0" strokeWidth="1"
              />
            ))}
            <polygon
              points={getCoordinates(targetScores, dynamicLimit, isActive)}
              fill="#0496f721" stroke="#000000ff" strokeWidth="0.5" strokeLinejoin="round"
              style={{ transition: 'points 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
            {/* 동적 라벨 렌더링 */}
            {labels.map((label, i) => {
              const angle = (2 * Math.PI / labels.length) * i - Math.PI / 2;
              const x = 100 + 85 * Math.cos(angle);
              const y = 100 + 85 * Math.sin(angle);
              return <text key={label} x={x} y={y} textAnchor="middle" fontSize="10" fill="#4b5563" fontWeight="bold" dominantBaseline="middle">{label}</text>
            })}
          </svg>
        </div>
      </div>
    </section>
  );
};

export default CategoryRadarChart;