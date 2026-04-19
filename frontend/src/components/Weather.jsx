import { useState, useEffect } from 'react';
import './Weather.css';

// =================================================
// 1. 설정 (Service Key는 본인 키로 변경 필요)
// =================================================
const SERVICE_KEY = process.env.REACT_APP_WEATHER_API_KEY || "";

// =================================================
// 2. 핵심 함수: 위경도(GPS) -> 기상청 격자(Grid) 변환
// =================================================
function mapToGrid(lat, lon) {
    const RE = 6371.00877;
    const GRID = 5.0;
    const SLAT1 = 30.0;
    const SLAT2 = 60.0;
    const OLON = 126.0;
    const OLAT = 38.0;
    const XO = 43;
    const YO = 136;

    const DEGRAD = Math.PI / 180.0;
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;

    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);

    let theta = lon * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    const x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    const y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

    return { x, y };
}

// =================================================
// 3. 날씨 아이콘 SVG 컴포넌트
// =================================================
const SunIcon = () => (
    <svg className="weather-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
        <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
        <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
        <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
    </svg>
);

const RainIcon = () => (
    <svg className="weather-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
        <line x1="16" y1="14" x2="16" y2="18" />
        <line x1="8" y1="14" x2="8" y2="18" />
        <line x1="12" y1="16" x2="12" y2="20" />
    </svg>
);

const SnowIcon = () => (
    <svg className="weather-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
        <line x1="8" y1="15" x2="8" y2="19" />
        <line x1="6" y1="17" x2="10" y2="17" />
        <line x1="16" y1="15" x2="16" y2="19" />
        <line x1="14" y1="17" x2="18" y2="17" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <line x1="10" y1="15" x2="14" y2="15" />
    </svg>
);

const CloudRainSnowIcon = () => (
    <svg className="weather-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
        <line x1="8" y1="14" x2="8" y2="17" />
        <line x1="16" y1="15" x2="16" y2="18" />
        <line x1="12" y1="16" x2="12" y2="19" />
        <line x1="10" y1="20" x2="11" y2="21" />
        <line x1="14" y1="20" x2="15" y2="21" />
    </svg>
);

const LocationPinIcon = () => (
    <svg className="weather-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const DropletIcon = () => (
    <svg className="weather-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
);


// =================================================
// 4. 날씨 상태별 아이콘 & 색상 매핑
// =================================================
const getWeatherDisplay = (rainType) => {
    const type = parseInt(rainType || '0');
    switch (type) {
        case 1: return { icon: <RainIcon />, color: '#3b82f6', label: '비' };
        case 2: return { icon: <CloudRainSnowIcon />, color: '#60a5fa', label: '비/눈' };
        case 3: return { icon: <SnowIcon />, color: '#93c5fd', label: '눈' };
        case 4: return { icon: <RainIcon />, color: '#3b82f6', label: '소나기' };
        case 5: return { icon: <RainIcon />, color: '#60a5fa', label: '빗방울' };
        case 6: return { icon: <CloudRainSnowIcon />, color: '#7dd3fc', label: '진눈개비' };
        case 7: return { icon: <SnowIcon />, color: '#a5b4fc', label: '눈날림' };
        default: return { icon: <SunIcon />, color: '#f59e0b', label: '맑음' };
    }
};

// =================================================
// 5. 캐시 유틸 (30분 유효)
// =================================================
const CACHE_KEY = 'weatherCache';
const CACHE_TTL = 5 * 60 * 1000; // 5분

const getCache = () => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { data, locationName, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL) return { data, locationName };
    } catch (_) {}
    return null;
};

const setCache = (data, locationName) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, locationName, timestamp: Date.now() }));
    } catch (_) {}
};

// =================================================
// 6. Weather 컴포넌트
// =================================================
const Weather = () => {
    const [weatherData, setWeatherData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationName, setLocationName] = useState("서울");

    const getWeather = async (lat, lon, name) => {
        setLoading(true);
        try {
            const { x: nx, y: ny } = mapToGrid(lat, lon);

            const now = new Date();
            now.setHours(now.getHours() - 1);

            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');

            const base_date = `${year}${month}${day}`;
            const base_time = `${hour}00`;

            const API_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
            const url = `${API_URL}?serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=1000&dataType=XML&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`;

            const response = await fetch(url);
            const textData = await response.text();

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(textData, "text/xml");

            const resultCodeNode = xmlDoc.getElementsByTagName("resultCode")[0];
            if (resultCodeNode && resultCodeNode.textContent !== '00') return;

            const items = xmlDoc.getElementsByTagName("item");
            const parsedData = {};

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const category = item.getElementsByTagName("category")[0]?.textContent;
                const obsrValue = item.getElementsByTagName("obsrValue")[0]?.textContent;

                if (category === 'T1H') parsedData.temp = obsrValue;
                if (category === 'REH') parsedData.humidity = obsrValue;
                if (category === 'PTY') parsedData.rainType = obsrValue;
            }

            if (parsedData.temp) {
                setWeatherData(parsedData);
                setLocationName(name);
                setCache(parsedData, name);
            }
        } catch (error) {
            console.error("날씨 정보를 불러오는 중 오류 발생:", error);
        } finally {
            setLoading(false);
        }
    };

    const getAddress = async (lat, lon) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
                { headers: { 'Accept-Language': 'ko' } }
            );
            const data = await response.json();
            if (data && data.address) {
                const a = data.address;
                // 한국 주소: state(시/도), city_district/county(구/군), suburb/town(동/읍)
                const city = a.city || a.state || a.province || "";
                const district = a.city_district || a.borough || a.county || a.district || "";
                const dong = a.suburb || a.quarter || a.town || a.neighbourhood || "";

                // "서울특별시" → "서울", "부산광역시" → "부산" 등 축약
                const shortCity = city.replace(/(특별시|광역시|특별자치시|특별자치도)$/, '');

                const parts = [shortCity, district, dong].filter(Boolean);
                if (parts.length > 0) return parts.join(' ');
            }
        } catch (error) {
            // 주소 변환 실패 시 기본값 사용
        }
        return "현재 위치";
    };

    useEffect(() => {
        // 캐시가 유효하면 API 호출 없이 즉시 표시
        const cached = getCache();
        if (cached) {
            setWeatherData(cached.data);
            setLocationName(cached.locationName);
            setLoading(false);
            return;
        }

        // 캐시 만료 시 위치 기반으로 새로 불러오기
        if (!navigator.geolocation) {
            getWeather(37.52487, 126.92723, "서울");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const addressName = await getAddress(lat, lon);
                getWeather(lat, lon, addressName);
            },
            () => {
                getWeather(37.52487, 126.92723, "서울");
            },
            { timeout: 5000 }
        );
    }, []);

    if (!SERVICE_KEY) return null;

    if (loading) {
        return (
            <div className="weather-widget">
                <div className="weather-skeleton">
                    <div className="weather-skeleton-circle" />
                    <div className="weather-skeleton-bar" />
                </div>
            </div>
        );
    }

    if (!weatherData) {
        return (
            <div className="weather-widget">
                <span className="weather-unavailable">날씨 정보 없음</span>
            </div>
        );
    }

    const { icon, color } = getWeatherDisplay(weatherData.rainType);

    const naverWeatherUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(locationName + ' 날씨')}`;

    return (
        <a
            className="weather-widget"
            href={naverWeatherUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="출처: 기상청 (공공데이터포털)"
        >
            <div className="weather-icon-wrap" style={{ color }}>
                {icon}
            </div>
            <span className="weather-temp">{weatherData.temp}°</span>

            <div className="weather-divider" />

            <LocationPinIcon />
            <span className="weather-location">{locationName}</span>

            <div className="weather-divider" />

            <DropletIcon />
            <span className="weather-humidity">{weatherData.humidity}%</span>

            <span className="weather-source">기상청</span>
        </a>
    );
};

export default Weather;
