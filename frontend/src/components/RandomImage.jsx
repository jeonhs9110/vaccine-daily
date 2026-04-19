import { useState, useCallback } from "react";

function RandomImage({ imgUrls }) {
    const [currentUrl, setCurrentUrl] = useState(() => {
        if (!imgUrls || imgUrls.length === 0) return null;
        return imgUrls[Math.floor(Math.random() * imgUrls.length)];
    });

    const [failedUrls, setFailedUrls] = useState(new Set());

    const handleError = useCallback(() => {
        setFailedUrls(prev => {
            const next = new Set(prev);
            if (currentUrl) next.add(currentUrl);
            return next;
        });

        const candidates = imgUrls.filter(
            url => url && !failedUrls.has(url) && url !== currentUrl
        );

        if (candidates.length === 0) {
            // 🔚 더 이상 시도할 이미지가 없음
            setCurrentUrl("/images/fallback.png");
            return;
        }

        const nextUrl =
            candidates[Math.floor(Math.random() * candidates.length)];

        setCurrentUrl(nextUrl);
    }, [imgUrls, currentUrl, failedUrls]);

    if (!currentUrl) return null;

    return (
        <img
            src={currentUrl}
            alt="기사 이미지"
            onError={handleError}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
    );
}

export default RandomImage;