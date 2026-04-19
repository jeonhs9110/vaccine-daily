import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import './MainTemp.css';

const MainTemp = () => {
    // Main page doesn't use useParams for category usually, but keeping structure similar
    // We can simulate 'name' being undefined or empty to show all articles
    const { name } = useParams();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [displayArticles, setDisplayArticles] = useState([]);
    const [imageMap, setImageMap] = useState({});
    const itemsPerPage = 5;

    useEffect(() => {
        setCurrentPage(1);

        const loadData = async () => {
            try {
                // Dynamically import sample data to allow the app to run even if the folder is missing
                const [articlesModule, imagesModule] = await Promise.all([
                    import('../sample_/sampleArticle.json').catch(() => ({ default: [] })),
                    import('../sample_/imageAssets').catch(() => ({ default: {} }))
                ]);

                const articles = articlesModule.default || [];
                const images = imagesModule.default || {};

                setImageMap(images);

                // Filter articles by category name
                // If category is '전체메뉴', show all articles
                // For Main page, name is likely undefined, so it behaves like '전체메뉴'
                const decodedName = decodeURIComponent(name || '');
                const filtered = (decodedName === '전체메뉴' || !decodedName)
                    ? articles
                    : articles.filter(a => {
                        if (!a.category) return false;
                        if (Array.isArray(a.category)) {
                            return a.category.includes(decodedName);
                        }
                        return a.category === decodedName;
                    });

                // Randomly shuffle filtered articles when category changes
                if (filtered.length > 0) {
                    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
                    setDisplayArticles(shuffled);
                } else {
                    setDisplayArticles([]);
                }
            } catch (error) {
                console.warn('Sample data could not be loaded:', error);
                setDisplayArticles([]);
                setImageMap({});
            }
        };

        loadData();
    }, [name]);

    // Function to render the main content block (Featured, Highlights, Grid)
    // This is repeated 5 times as requested by the user
    const renderMainContent = (index) => {
        if (!displayArticles || displayArticles.length === 0) return null;

        // Use 5 articles per loop to match the new layout (1 main + 4 grid)
        const baseIndex = (index * 5) % displayArticles.length;

        const mainArticle = displayArticles[baseIndex];
        const gridArticles = [
            displayArticles[(baseIndex + 1) % displayArticles.length],
            displayArticles[(baseIndex + 2) % displayArticles.length],
            displayArticles[(baseIndex + 3) % displayArticles.length],
            displayArticles[(baseIndex + 4) % displayArticles.length],
        ];

        const mainData = {
            title: mainArticle?.title || "AI 생성 기사 제목",
            description: mainArticle?.short_text || "AI 생성 기사 내용 (추후 데이터 연동 예정)",
            image: mainArticle ? (imageMap[mainArticle.image] || mainArticle.image) : null
        };

        // Helper to format article data
        const getArticleData = (article) => ({
            title: article?.title || "AI 생성 기사 제목",
            description: article?.short_text || "AI 생성 기사 내용"
        });

        const leftArticles = [getArticleData(gridArticles[0]), getArticleData(gridArticles[1])];
        const rightArticles = [getArticleData(gridArticles[2]), getArticleData(gridArticles[3])];

        const highlights = [
            { keyword: '중점으로 둔 키워드', content: '"해당 키워드에 대한 요약한 내용"' },
            { keyword: '중점으로 둔 키워드', content: '"해당 키워드에 대한 요약한 내용"' }
        ];

        return (
            <React.Fragment key={index}>
                {/* Main 3-Column Section */}
                <section className="main-article-section">
                    <div className="article-info-side" onClick={() => navigate('/article')} style={{ cursor: 'pointer' }}>
                        <div className="analysis-box-large">
                            <div className="analysis-placeholder">
                                <div className="analysis-x"></div>
                                <span className="analysis-text">분석</span>
                            </div>
                        </div>
                    </div>

                    <div className="main-image-column">
                        <div className="article-image-center" onClick={() => navigate('/article')} style={{ cursor: 'pointer' }}>
                            <img src={mainData.image} alt="Main" />
                            <div className="main-image-text">
                                <h3>{mainData.title}</h3>
                                <p>{mainData.description}</p>
                            </div>
                        </div>
                        <div className="highlights-container">
                            {highlights.map((item, hIndex) => (
                                <React.Fragment key={hIndex}>
                                    <div className="highlight-item">
                                        <span className="highlight-keyword">{item.keyword}</span>
                                        <span className="highlight-content">{item.content}</span>
                                    </div>
                                    {hIndex < highlights.length - 1 && <div className="highlight-divider"></div>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="article-info-side" onClick={() => navigate('/article')} style={{ cursor: 'pointer' }}>
                        <div className="analysis-block">
                            <h2>{rightArticles[0].title}</h2>
                            <p>{rightArticles[0].description}</p>
                        </div>
                        <div className="info-divider"></div>
                        <div className="analysis-block">
                            <h2>{rightArticles[1].title}</h2>
                            <p>{rightArticles[1].description}</p>
                        </div>
                    </div>
                </section>




                <div className="divider"></div>
            </React.Fragment>
        );
    };



    const totalPages = 5; // Fixed to 5 pages as requested for the loop

    return (
        <div className="main-page">
            <Header
                leftChild={<Logo />}
                midChild={<Searchbar />}
                rightChild={<UserMenu />}
                headerTop="on"
                headerMain="on"
                headerBottom="on"
            />

            <main className="category-content">

                {/* Repeat the main content 5 times, offset by current page */}
                {displayArticles.length > 0 ? (
                    renderMainContent(0 + (currentPage - 1) * 5)
                ) : (
                    <div className="empty-category">
                        <p>해당 카테고리에 표시할 기사가 없습니다.</p>
                    </div>
                )}



            </main>
        </div>
    );
};

export default MainTemp;
