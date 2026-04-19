export const formatDate = (dateString) => {
    if (!dateString) return "날짜 미상";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "날짜 미상";

    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInMinutes < 60) {
        return `${Math.max(0, diffInMinutes)}분 전`;
    } else if (diffInHours < 24) {
        return `${diffInHours}시간 전`;
    } else {
        // Return format like 2026.02.09
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
    }
};
