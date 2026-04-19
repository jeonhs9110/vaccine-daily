// 가상의 API 호출 함수입니다.
export const toggleLikeApi = async (contentId, status) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ success: true });
        }, 500);
    });
};
