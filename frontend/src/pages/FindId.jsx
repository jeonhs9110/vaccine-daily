import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import './FindId.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function FindId() {
    const navigate = useNavigate();

    const [form, setForm] = useState({ username: '', email: '' });
    const [resultId, setResultId] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        if (error) setError('');
        if (resultId) setResultId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username.trim() || !form.email.trim()) {
            setError('이름과 이메일을 모두 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');
        setResultId(null);

        try {
            const response = await fetch(`${API_BASE_URL}/users/find-id`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            const data = await response.json();

            if (response.ok) {
                setResultId(data.login_id);
            } else {
                setError(data.detail || '사용자를 찾을 수 없습니다.');
            }
        } catch (err) {
            console.error(err);
            setError('서버 연결 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="find-id-container">
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

            <div className="find-id-wrapper">
                <div className="find-id-box">
                    <h2>아이디 찾기</h2>
                    <form className="find-id-form" onSubmit={handleSubmit}>
                        <div className="find-id-input-group">
                            <label>이름</label>
                            <input
                                type="text"
                                name="username"
                                placeholder="가입 시 등록한 이름"
                                value={form.username}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="find-id-input-group">
                            <label>이메일</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="가입 시 등록한 이메일"
                                value={form.email}
                                onChange={handleChange}
                            />
                        </div>

                        {error && <p className="error-msg">{error}</p>}

                        <button type="submit" className="find-id-btn" disabled={loading}>
                            {loading ? '확인 중...' : '아이디 찾기'}
                        </button>
                    </form>

                    {resultId && (
                        <div className="find-id-result">
                            <p>회원님의 아이디는 아래와 같습니다.</p>
                            <span className="found-id">{resultId}</span>
                            <button
                                className="find-id-btn login-btn-link"
                                onClick={() => navigate('/login')}
                            >
                                로그인하러 가기
                            </button>
                        </div>
                    )}

                    <div className="find-id-links">
                        <span onClick={() => navigate('/login')}>로그인</span>
                        <span>|</span>
                        <span onClick={() => navigate('/CreateAccount')}>회원가입</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
