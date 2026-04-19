import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname } = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        // PUSH or REPLACE navigation (New page movement)
        // We scroll to top to provide a fresh start.
        if (navType === 'PUSH' || navType === 'REPLACE') {
            window.scrollTo(0, 0);
        }
        // For 'POP' (Back button, Browser back/forward), 
        // we let the browser handle existing scroll restoration naturally.
    }, [pathname, navType]);

    return null;
};

export default ScrollToTop;
