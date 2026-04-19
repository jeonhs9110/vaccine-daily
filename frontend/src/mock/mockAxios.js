// Replaces the default axios adapter with a URL-pattern-matching mock.
// Imported once at app bootstrap (index.js) so every `axios.get/post/...`
// call resolves from local dummy data and the static demo works offline.

import axios from 'axios';
import { MOCK } from './mockData';

const ok = (data) => Promise.resolve({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {}
});

const notFound = (config) => Promise.reject({
    response: { status: 404, data: { detail: 'mock: not found' } },
    config
});

function pathOf(config) {
    try {
        const full = (config.baseURL || '') + (config.url || '');
        if (full.startsWith('http')) return new URL(full).pathname + (new URL(full).search || '');
        return full;
    } catch {
        return config.url || '';
    }
}

function parseQuery(str) {
    const out = {};
    if (!str) return out;
    const q = str.includes('?') ? str.split('?')[1] : str;
    q.split('&').filter(Boolean).forEach(p => {
        const [k, v] = p.split('=');
        out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
}

const mockAdapter = (config) => {
    const rawPath = pathOf(config);
    const [path, queryStr] = rawPath.split('?');
    const q = parseQuery(queryStr || '');
    const method = (config.method || 'get').toLowerCase();

    // /reports/:id/related
    let m = path.match(/\/reports\/(\d+)\/related$/);
    if (m && method === 'get') {
        const id = Number(m[1]);
        const others = MOCK.reports.filter(r => r.report_id !== id).slice(0, 6);
        return ok(others);
    }

    // /reports/:id/demographics
    m = path.match(/\/reports\/(\d+)\/demographics$/);
    if (m && method === 'get') return ok(MOCK.buildDemographics());

    // /reports/:id/media-focus
    m = path.match(/\/reports\/(\d+)\/media-focus$/);
    if (m && method === 'get') return ok(MOCK.buildMediaFocus(Number(m[1])));

    // /reports/:id/opinions
    m = path.match(/\/reports\/(\d+)\/opinions$/);
    if (m && method === 'get') {
        const id = Number(m[1]);
        const rpt = MOCK.reports.find(r => r.report_id === id);
        return ok(rpt?.analysis_result?.opinion_bullets || []);
    }

    // /reports/:id/timeline
    m = path.match(/\/reports\/(\d+)\/timeline$/);
    if (m && method === 'get') return ok(MOCK.buildTimeline(Number(m[1])));

    // /reports/clusters/:id/news
    m = path.match(/\/reports\/clusters\/(\d+)\/news$/);
    if (m && method === 'get') return ok(MOCK.buildClusterNews(Number(m[1])));

    // /reports/search
    if (path.endsWith('/reports/search') && method === 'get') {
        const kw = (q.q || '').toLowerCase();
        const hits = kw
            ? MOCK.reports.filter(r => r.title.toLowerCase().includes(kw) || (r.contents || '').toLowerCase().includes(kw))
            : MOCK.reports.slice(0, 10);
        return ok(hits);
    }

    // /api/comprehensive-search
    if (path.endsWith('/api/comprehensive-search') && method === 'get') {
        return ok({ reports: MOCK.reports.slice(0, 5), news: [] });
    }

    // /reports/citation (POST)
    if (path.endsWith('/reports/citation') && method === 'post') {
        return ok({ verified: true, best_match: { company: '데모언론', url: 'https://example.com', similarity: 0.82 } });
    }

    // /reports/:id
    m = path.match(/\/reports\/(\d+)$/);
    if (m && method === 'get') {
        const id = Number(m[1]);
        const r = MOCK.reports.find(x => x.report_id === id) || MOCK.reports[0];
        return ok(r);
    }

    // /reports (list)
    if (path.endsWith('/reports') && method === 'get') {
        const limit = Number(q.limit || 50);
        return ok(MOCK.reports.slice(0, limit));
    }

    // /users/:id/dashboard
    m = path.match(/\/users\/([^/]+)\/dashboard$/);
    if (m && method === 'get') return ok(MOCK.buildUserDashboard());

    // /users/:id/reactions/:reportId
    m = path.match(/\/users\/([^/]+)\/reactions\/(\d+)$/);
    if (m && method === 'get') return ok({ value: 0 });

    // /users/:id/liked-news
    m = path.match(/\/users\/([^/]+)\/liked-news$/);
    if (m && method === 'get') return ok(MOCK.reports.slice(0, 3));

    // /users/:id/scrapped-news
    m = path.match(/\/users\/([^/]+)\/scrapped-news$/);
    if (m && method === 'get') return ok(MOCK.reports.slice(3, 6));

    // /users/:id/scraps (POST/DELETE)
    m = path.match(/\/users\/([^/]+)\/scraps$/);
    if (m && (method === 'post' || method === 'delete')) return ok({ success: true });

    // /users/:id/read/:reportId (POST)
    m = path.match(/\/users\/([^/]+)\/read\/(\d+)$/);
    if (m && method === 'post') return ok({ success: true });

    // /news/:id/reaction (POST)
    m = path.match(/\/news\/(\d+)\/reaction$/);
    if (m && method === 'post') return ok({ success: true });

    // /users/:id (GET / PUT / DELETE)
    m = path.match(/\/users\/([^/]+)$/);
    if (m) {
        if (method === 'get') return ok({ login_id: m[1], username: '데모 사용자', scraps: [], subscribed_keywords: ['AI', '반도체'] });
        if (method === 'put' || method === 'delete') return ok({ success: true });
    }

    // Login / CreateAccount / FindId — accept anything
    if (path.endsWith('/login') && method === 'post') return ok({ success: true, login_id: 'demo_user', username: '데모 사용자' });
    if (path.endsWith('/users') && method === 'post') return ok({ success: true });
    if (path.includes('/find')) return ok({ login_id: 'demo_user' });

    // Weather (external calls handled below) — default empty.
    if (path.includes('weather')) return ok({ main: { temp: 18 }, weather: [{ main: 'Clouds', description: '구름많음' }] });

    // Unknown endpoint → return an empty-but-safe payload based on method.
    console.warn('[mockAxios] unmatched', method.toUpperCase(), rawPath);
    if (method === 'get') return ok([]);
    return ok({ success: true });
};

// Patch every axios instance (default + axios.create()) by overriding the
// global default adapter.
axios.defaults.adapter = mockAdapter;

export default mockAdapter;
