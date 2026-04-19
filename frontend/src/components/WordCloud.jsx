import React from 'react';
import { useNavigate } from 'react-router-dom';
import WordCloud from 'react-d3-cloud';
import './WordCloud.css';

const WordCloudComponent = ({ keywords, width = 800, height = 300, font = "Times", ...props }) => {
    const navigate = useNavigate();

    const handleWordClick = (event, word) => {
        // word.text에 키워드가 있습니다.
        navigate(`/search?q=${word.text}`);
    };

    const newData = keywords.map(item => ({
        text: item.text,
        value: item.value // 원래 가중치 사용
    }));

    const fontSizeMapper = (word) => Math.sqrt(word.value) * 3;
    const rotate = (word) => word.value % 2 === 0 ? 0 : 90;

    return (
        <div className="word-cloud-container">
            <WordCloud
                data={newData}
                width={width}
                height={height}
                font={font}
                fontStyle="normal"
                fontWeight="bold"
                fontSize={fontSizeMapper}
                spiral="archimedean"
                rotate={rotate}
                padding={2}
                onWordClick={handleWordClick}
                {...props}
            />
        </div>
    );
};

export default WordCloudComponent;
