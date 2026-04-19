// Static dummy data used by the demo (no backend).
// Keep everything deterministic so screenshots are reproducible.

const CATEGORIES = ['정치', '경제', '사회', '과학', '국제'];
const COMPANIES = ['조선일보', 'KBS', 'MBC', 'SBS', '연합뉴스', '한겨레', '중앙일보', '경향신문', '한국일보', 'JTBC'];

const TITLES_BY_CAT = {
    '정치': [
        '국회, 민생법안 처리 속도전…여야 쟁점법안 놓고 대치',
        '대통령, 개각 단행…경제·외교 라인 전면 교체',
        '지방선거 앞두고 정당 지지율 격차 확대',
        '여야 원내대표 회동, 쟁점 법안 합의 실패'
    ],
    '경제': [
        '한국은행, 기준금리 동결…물가 안정세 확인 후 인하 검토',
        '반도체 수출 3개월 연속 증가…AI 수요 견인',
        '부동산 시장 관망세 지속…전세가 상승 조짐',
        '원·달러 환율 1350원대 횡보…외환 당국 개입 주목'
    ],
    '사회': [
        '폭우 피해 복구 본격화…정부, 특별재난지역 선포 검토',
        '청년 주거지원 확대…공공임대 3만호 추가 공급',
        '학교폭력 신고 건수 사상 최대…교육부 대책 발표',
        '의료대란 장기화…전공의 복귀율 10%대 그쳐'
    ],
    '과학': [
        '누리호 4차 발사 성공…차세대 관측위성 궤도 진입',
        '국내 연구진, 상온 초전도체 후보 물질 합성 발표',
        'AI 신약개발 플랫폼 첫 임상 진입…글로벌 제약사 협력',
        '한국형 달 탐사선 2032년 착륙 목표…예비 설계 착수'
    ],
    '국제': [
        '미·중 정상회담 개최…AI 규제·관세 갈등 논의',
        '유럽의회, 생성형 AI 규제 법안 최종 가결',
        '중동 정세 긴장…국제유가 배럴당 90달러 돌파',
        '유엔 기후총회, 탄소배출권 개편안 합의 도출'
    ]
};

const KOREAN_LOREM = (seed) => {
    const sentences = [
        '이번 사안에 대해 정부 관계자는 "신중하게 검토하고 있다"고 밝혔다.',
        '전문가들은 단기적 효과와 장기적 파급력을 함께 평가해야 한다고 조언한다.',
        '관련 통계에 따르면 최근 3년간 지속적인 증가세가 관찰되고 있다.',
        '업계에서는 후속 조치에 따라 시장 반응이 크게 갈릴 것으로 보고 있다.',
        '시민들의 체감 효과는 지역별, 연령별로 편차가 크다는 지적이 나온다.',
        '정책 담당자는 "다음 분기 내 추가 대책을 발표할 계획"이라고 설명했다.',
        '해외 주요 언론은 한국의 이번 움직임을 이례적으로 비중 있게 보도했다.',
        '학계에서는 구조적 원인에 대한 보다 심층적인 분석이 필요하다고 본다.',
        '시장 참여자들은 중장기 전망에 대해 엇갈린 반응을 보이고 있다.',
        '관련 법 개정 논의는 다음 정기국회에서 본격화될 전망이다.'
    ];
    const pick = [];
    for (let i = 0; i < 8; i++) pick.push(sentences[(seed + i) % sentences.length]);
    return pick.join(' ');
};

const KEYWORDS_POOL = ['정부', '정책', '경제', '금리', '수출', 'AI', '반도체', '청년', '기후', '국회', '외교', '환율', '주거', '교육', '의료', '과학', '기술', '연구', '혁신', '규제'];

function buildReports() {
    const reports = [];
    let idCounter = 1;
    CATEGORIES.forEach((cat, catIdx) => {
        TITLES_BY_CAT[cat].forEach((title, i) => {
            const id = idCounter++;
            const seed = id * 7;
            const keywords = [];
            for (let k = 0; k < 8; k++) {
                keywords.push({ text: KEYWORDS_POOL[(seed + k) % KEYWORDS_POOL.length], value: 30 + ((seed * (k + 1)) % 60) });
            }
            const daysAgo = i;
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            reports.push({
                report_id: id,
                id: id,
                cluster_id: 100 + id,
                title,
                contents: KOREAN_LOREM(seed) + ' ' + KOREAN_LOREM(seed + 3),
                category_name: cat,
                category: cat,
                keywords,
                like_count: 20 + (seed % 180),
                created_at: date.toISOString(),
                published_at: date.toISOString(),
                analysis_result: {
                    opinion_bullets: buildOpinions(id)
                }
            });
        });
    });
    return reports;
}

function buildOpinions(reportId) {
    const picks = [0, 1, 2, 3].map(i => COMPANIES[(reportId + i) % COMPANIES.length]);
    return picks.map((c, i) => ({
        company: c,
        hashtags: [['#분석', '#긍정'], ['#비판', '#우려'], ['#중립', '#관망'], ['#지지', '#기대']][i % 4],
        summary: `${c}는 이번 사안에 대해 ${['긍정적 평가와 함께 추진력을 주문했다', '구조적 한계를 지적하며 신중한 접근을 요구했다', '양측 주장을 고루 전하며 사실관계 확인에 집중했다', '실질적 성과로 이어질지 주목된다고 분석했다'][i % 4]}.`,
        evidence: `"정부가 신속히 움직여야 할 시점이다."\n"이번 결정이 시장에 미칠 영향은 제한적이다."`
    }));
}

function buildClusterNews(clusterId) {
    const newsList = [];
    const n = 3 + (clusterId % 3);
    for (let i = 0; i < n; i++) {
        const company = COMPANIES[(clusterId + i) % COMPANIES.length];
        newsList.push({
            id: clusterId * 10 + i,
            company_name: company,
            title: `[${company}] 관련 기사 ${i + 1}번`,
            contents: KOREAN_LOREM(clusterId + i),
            img_urls: [
                `https://picsum.photos/seed/${clusterId * 17 + i}/800/450`,
                `https://picsum.photos/seed/${clusterId * 17 + i + 1}/800/450`
            ],
            url: `https://example.com/news/${clusterId}/${i}`,
            published_at: new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString()
        });
    }
    return newsList;
}

function buildDemographics() {
    return {
        age_distribution: [
            { age_group: '10대', count: 120 },
            { age_group: '20대', count: 420 },
            { age_group: '30대', count: 580 },
            { age_group: '40대', count: 510 },
            { age_group: '50대', count: 330 },
            { age_group: '60대+', count: 180 }
        ],
        gender_distribution: [
            { gender: '남성', count: 1120 },
            { gender: '여성', count: 1020 }
        ]
    };
}

function buildMediaFocus(reportId) {
    return {
        media_focus: COMPANIES.slice(0, 5).map((c, i) => ({
            company: c,
            issue_count: 12 - i * 2,
            total_count: 80 + i * 10,
            focus_pct: Math.round((12 - i * 2) / (80 + i * 10) * 1000) / 10
        }))
    };
}

function buildTimeline(currentId) {
    const items = [];
    const today = new Date();
    for (let i = 0; i < 4; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        items.push({
            id: currentId + i,
            date: `${d.getMonth() + 1}.${d.getDate()}`,
            time: `${8 + i * 3}:00`,
            title: `관련 이슈 업데이트 ${i + 1}`,
            is_current: i === 0
        });
    }
    return items;
}

function buildUserDashboard() {
    return {
        login_id: 'demo_user',
        username: '데모 사용자',
        subscribed_keywords: ['AI', '반도체', '금리'],
        read_keywords: { 'AI': 12, '반도체': 8, '금리': 6, '청년': 4 },
        read_categories: { '경제': 15, '과학': 10, '정치': 6 }
    };
}

export const MOCK = {
    reports: buildReports(),
    buildClusterNews,
    buildDemographics,
    buildMediaFocus,
    buildTimeline,
    buildUserDashboard,
    companies: COMPANIES
};
