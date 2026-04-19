import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button";
import Header from "./Header";
import Logo from "./Logo";
import UserMenu from "./UserMenu";
import Searchbar from "./Searchbar";
import "./Login.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const Login = () => {

    const nav = useNavigate();

    const [loginData, setLoginData] = useState({
        login_id: '',
        password: ''
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLoginData(prevData => ({
            ...prevData,
            [name]: value,
        }));
        // Clear error when user types
        if (error) {
            setError('');
        }
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // POST request to backend login API
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    login_id: loginData.login_id,
                    password: loginData.password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Success - Save user info to localStorage
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('user_id', data.user_id);
                localStorage.setItem('login_id', data.login_id);
                localStorage.setItem('username', data.username);

                // Restore recommendation data from backend
                try {
                    const dashRes = await fetch(`${API_BASE_URL}/users/${data.login_id}/dashboard`);
                    if (dashRes.ok) {
                        const dash = await dashRes.json();
                        // read_keywords: { "키워드": count } → viewed_tags 복원
                        if (dash.read_keywords && Object.keys(dash.read_keywords).length > 0) {
                            const sortedTags = Object.entries(dash.read_keywords)
                                .sort((a, b) => b[1] - a[1])
                                .map(([kw]) => kw)
                                .slice(0, 50);
                            localStorage.setItem('viewed_tags', JSON.stringify(sortedTags));
                        }
                        // read_categories: { "카테고리": count } → viewed_categories 복원
                        if (dash.read_categories && Object.keys(dash.read_categories).length > 0) {
                            const sortedCats = Object.entries(dash.read_categories)
                                .sort((a, b) => b[1] - a[1])
                                .map(([cat]) => cat)
                                .slice(0, 10);
                            localStorage.setItem('viewed_categories', JSON.stringify(sortedCats));
                        }
                    }
                } catch (e) {
                    console.warn('추천 데이터 복원 실패:', e);
                }

                // Navigate to home page
                nav('/');
            } else {
                // Backend returned an error
                setError(data.detail || '로그인에 실패했습니다.');
            }
        } catch (error) {
            // Network or other error
            console.error('Login error:', error);
            setError('서버와 연결할 수 없습니다. 나중에 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    }


    return (
        <div className="Login">
            <Header
                leftChild={null}
                midChild={<Logo />}
                rightChild={
                    <div className="header-right-group">
                        <div className="header-search-wrapper">
                            <Searchbar className="always-open rounded-search" />
                        </div>
                        <UserMenu className="rounded-user-menu" />
                    </div>
                }
                headerTop="on"
                headerMain="on"
                headerBottom="on"
            />

            <div className="Login_container_wrapper">
                <div className="Login_main_box">
                    <h2 className="login-title">로그인</h2>
                    <form className="Login_total" onSubmit={handleLogin}>
                        <div className="login-input-group">
                            <div className="input_row top">
                                <input
                                    className="id_box"
                                    placeholder="아이디"
                                    name="login_id"
                                    value={loginData.login_id}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="input_row bottom">
                                <input
                                    className="pw_box"
                                    placeholder="비밀번호"
                                    name="password"
                                    type="password"
                                    value={loginData.password}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        {error && (
                            <p className="error_login">
                                {error}
                            </p>
                        )}

                        <div className="login-options">
                            <label className="stay-signed-in">
                                <input type="checkbox" />
                                <span className="checkmark"></span>
                                로그인 상태 유지
                            </label>
                        </div>

                        <div className="button_wrapper">
                            <Button
                                type='submit'
                                text={isLoading ? '로그인 중...' : '로그인'}
                                textColor='white'
                                borderRadius="6px"
                                color='#333333'
                                width="100%"
                                height="50px"
                                onClick={handleLogin}
                                disabled={isLoading}
                                fontWeight="bold"
                                fontSize="18px"
                            />
                        </div>
                    </form>

                    <div className="login-footer-links">
                        <span>비밀번호 찾기</span>
                        <span className="divider">|</span>
                        <span onClick={() => nav('/find-id')} className="find-id-link">아이디 찾기</span>
                        <span className="divider">|</span>
                        <span onClick={() => nav('/CreateAccount')} className="create-account-link">회원가입</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login;