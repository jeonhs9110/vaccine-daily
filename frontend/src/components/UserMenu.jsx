import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import loginIcon from '../login_icon/login.png';
import './UserMenu.css';

const UserMenu = ({ className = "" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    // Check login status from localStorage
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const storedUserName = localStorage.getItem('username');
    const storedLoginId = localStorage.getItem('login_id');

    setIsLoggedIn(loggedIn);
    if (storedUserName) {
      setUserName(storedUserName);
    }
    if (storedLoginId) {
      setLoginId(storedLoginId);
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [location]); // Re-check on location change

  const handleIconClick = () => {
    if (isLoggedIn) {
      setShowMenu(!showMenu);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    // Remove all login-related data
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user_id');
    localStorage.removeItem('login_id');
    localStorage.removeItem('username');

    setIsLoggedIn(false);
    setUserName('');
    setLoginId('');
    setShowMenu(false);
    navigate('/');
    window.location.reload(); // Refresh to update all components
  };

  const handleMyPage = () => {
    setShowMenu(false);
    navigate(`/mypage/${loginId}`);
  };

  const handleEditAccount = () => {
    setShowMenu(false);
    navigate('/edit-account');
  };

  return (
    <div className={`user-menu-container ${className}`} ref={menuRef}>
      <div className="user-info-wrapper" onClick={handleIconClick}>
        <div className="user-icon-box">
          <img
            src={loginIcon}
            alt={isLoggedIn ? "User Menu" : "Login"}
            className="user-icon"
          />
        </div>
        {/* User Name removed from here */}
      </div>
      {isLoggedIn && showMenu && (
        <div className="dropdown-menu">
          <div className="menu-header">
            <span className="user-name-dropdown">{(userName || "회원") + "님"}</span>
          </div>
          {!location.pathname.startsWith('/mypage') && (
            <div className="menu-item" onClick={handleMyPage}>마이페이지</div>
          )}
          <div className="menu-item" onClick={handleLogout}>로그아웃</div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;