
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categories as categoryData } from './categoryIcon/categoryData';
import axios from 'axios';

// Reuse styles from EditAccount.css, but we might want to scoped or rename later.
// For now, assuming MyPage will load EditAccount.css or we import it here.
// Since EditAccount.css selectors are scoped to .edit-account-container, we should keep that wrapper or update CSS.
import { useToast } from './Toast';
import './EditAccountForm.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function EditAccountForm({ loginId, onUpdateSuccess }) {
    const navigate = useNavigate();
    const showToast = useToast();

    // --- State Management ---
    const [formData, setFormData] = useState({
        name: '',
        loginId: '', // Display only
        password: '',
        confirmPassword: '',
        email: '',
        ageGroup: '',
        gender: '',
    });

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '#e0e0e0' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(true);

    // --- Fetch User Data ---
    useEffect(() => {
        const fetchUserData = async () => {
            if (!loginId) return;

            try {
                const response = await axios.get(`${API_BASE_URL}/users/${loginId}`);
                const data = response.data;

                setFormData({
                    name: data.username || '',
                    loginId: data.login_id,
                    password: '',
                    confirmPassword: '',
                    email: data.email || '',
                    ageGroup: data.age_range || '',
                    gender: data.gender || '',
                });
                setSelectedCategories(data.subscribed_categories || []);
            } catch (error) {
                console.error("사용자 정보 로딩 실패:", error);
                showToast("사용자 정보를 불러오는 데 실패했습니다.", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [loginId]);

    // --- Static Data ---
    const categoryOptions = categoryData
        .filter(cat => cat.label !== '전체메뉴' && cat.label !== '이슈' && cat.label !== '홈')
        .map(cat => cat.label);

    const ageGroups = ['10세 미만', '10~19세', '20~29세', '30~39세', '40~49세', '50~59세', '60~69세', '70세 이상', '비공개'];
    const genders = ['남성', '여성', '비공개'];

    // --- Password Logic ---
    useEffect(() => {
        const pwd = formData.password;
        if (!pwd) {
            setPasswordStrength({ score: 0, label: '', color: '#e0e0e0' });
            return;
        }

        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[!@#$%^&*]/.test(pwd)) score++;

        const strengthConfig = [
            { label: '매우 약함', color: '#ff4d4d' },
            { label: '약함', color: '#ff944d' },
            { label: '보통', color: '#ffda4d' },
            { label: '강함', color: '#90ee90' },
            { label: '매우 강함', color: '#2ecc71' }
        ];

        const finalScore = Math.min(score, 4);
        setPasswordStrength({
            score: finalScore,
            label: strengthConfig[finalScore].label,
            color: strengthConfig[finalScore].color
        });
    }, [formData.password]);

    // --- Event Handlers ---
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }

        if (name === 'password' && errors.confirmPassword) {
            setErrors(prev => ({ ...prev, confirmPassword: null }));
        }
    };

    const handleCategoryClick = (category) => {
        if (selectedCategories.includes(category)) {
            setSelectedCategories(selectedCategories.filter(item => item !== category));
        } else {
            setSelectedCategories([...selectedCategories, category]);
        }
        if (errors.categories) {
            setErrors(prev => ({ ...prev, categories: null }));
        }
    };

    // --- Validation Logic ---
    const validate = () => {
        let newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = "이름을 입력해주세요.";
        }

        if (!formData.email.includes('@')) {
            newErrors.email = "유효한 이메일 형식이 아닙니다 (@ 누락).";
        }

        if (!formData.ageGroup) {
            newErrors.ageGroup = "연령대를 선택해주세요.";
        }

        if (!formData.gender) {
            newErrors.gender = "성별을 선택해주세요.";
        }

        if (formData.password && formData.password.length < 8) {
            newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
        }

        if (selectedCategories.length < 3) {
            newErrors.categories = `최소 3개의 관심 분야를 선택해주세요. (현재 ${selectedCategories.length}개 선택)`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // --- Account Deletion ---
    const handleDeleteAccount = async () => {
        if (!window.confirm('정말로 회원탈퇴 하시겠습니까?')) {
            return;
        }

        if (!window.confirm('⚠️ 경고 ⚠️\n\n회원탈퇴 시 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.\n\n- 조회 기록\n- 좋아요/싫어요\n- 관심 키워드 통계\n- 구독 정보\n\n정말로 계속하시겠습니까?')) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/users/${loginId}`);

            // Logout logic
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user_id');
            localStorage.removeItem('login_id');
            localStorage.removeItem('username');

            showToast('회원탈퇴가 완료되었습니다.', "success");
            navigate('/');
            window.location.reload();
        } catch (error) {
            console.error("회원탈퇴 실패:", error);
            showToast(`회원탈퇴에 실패했습니다. ${error.response?.data?.detail || error.message}`, "error");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (validate()) {
            const submitData = {
                username: formData.name,
                email: formData.email,
                age_range: formData.ageGroup,
                gender: formData.gender,
                subscribed_categories: selectedCategories,
            };

            if (formData.password) {
                submitData.password = formData.password;
            }

            try {
                await axios.put(`${API_BASE_URL}/users/${formData.loginId}`, submitData);
                showToast("회원 정보가 수정되었습니다.", "success");
                if (onUpdateSuccess) onUpdateSuccess();
            } catch (error) {
                console.error("업데이트 실패:", error);
                showToast("회원 정보 수정 중 오류가 발생했습니다.", "error");
            }
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>로딩 중...</div>;
    }

    return (
        <div className="edit-account-container" style={{ minHeight: 'auto', backgroundColor: 'transparent' }}>
            <div className="edit-account-box" style={{ margin: '0', maxWidth: '100%', border: 'none', padding: '0 20px 20px 20px', boxShadow: 'none' }}>
                <h2 style={{ textAlign: 'left', fontSize: '1.5rem', marginBottom: '10px' }}>정보 수정</h2>
                <p className="description" style={{ textAlign: 'left', marginBottom: '30px' }}>
                    회원 정보를 수정하고 맞춤형 서비스를 계속 이용하세요.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>이름</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="홍길동"
                            value={formData.name}
                            onChange={handleChange}
                            className={errors.name ? "input-error" : ""}
                        />
                        {errors.name && <span className="error-msg">{errors.name}</span>}
                    </div>

                    <div className="input-group">
                        <label>아이디</label>
                        <input
                            type="text"
                            name="loginId"
                            value={formData.loginId}
                            disabled
                            style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                        />
                        <span className="sub-label" style={{ marginTop: '4px', display: 'block', textAlign: 'left' }}>아이디는 변경할 수 없습니다.</span>
                    </div>

                    <div className="input-group">
                        <label>새 비밀번호 (변경 시에만 입력)</label>
                        <div className="input-group-joined">
                            <div className="input-row-joined top">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="8자 이상, 대문자/특수문자 포함 권장"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={errors.password ? "input-error" : ""}
                                />
                                <button
                                    type="button"
                                    className="toggle-btn-joined"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? "숨기기" : "보기"}
                                </button>
                            </div>
                            <div className="input-row-joined bottom">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    placeholder="비밀번호 재확인"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className={errors.confirmPassword ? "input-error" : ""}
                                />
                            </div>
                        </div>

                        <div className="password-feedback">
                            {formData.password && (
                                <div className="strength-meter-container">
                                    <div
                                        className="strength-bar"
                                        style={{
                                            width: `${(passwordStrength.score + 1) * 20}%`,
                                            backgroundColor: passwordStrength.color
                                        }}
                                    ></div>
                                    <span style={{ color: passwordStrength.color }}>
                                        {passwordStrength.label}
                                    </span>
                                </div>
                            )}

                            {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                                <span className="success-msg" style={{ color: '#2ecc71', fontSize: '13px', marginTop: '5px', display: 'block' }}>
                                    비밀번호가 일치합니다.
                                </span>
                            )}

                            {errors.password && <span className="error-msg">{errors.password}</span>}
                            {errors.confirmPassword && <span className="error-msg">{errors.confirmPassword}</span>}
                        </div>
                    </div>

                    <div className="input-group">
                        <label>이메일</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="example@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            className={errors.email ? "input-error" : ""}
                        />
                        {errors.email && <span className="error-msg">{errors.email}</span>}
                    </div>

                    <div className="input-row">
                        <div className="input-group half">
                            <label>연령대</label>
                            <select
                                name="ageGroup"
                                value={formData.ageGroup}
                                onChange={handleChange}
                                className={errors.ageGroup ? "input-error" : ""}
                            >
                                <option value="">선택하세요</option>
                                {ageGroups.map(age => <option key={age} value={age}>{age}</option>)}
                            </select>
                            {errors.ageGroup && <span className="error-msg">{errors.ageGroup}</span>}
                        </div>
                        <div className="input-group half">
                            <label>성별</label>
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className={errors.gender ? "input-error" : ""}
                            >
                                <option value="">선택하세요</option>
                                {genders.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            {errors.gender && <span className="error-msg">{errors.gender}</span>}
                        </div>
                    </div>

                    <div className="category-section">
                        <label>관심 분야 선택 <span className="sub-label">(최소 3개)</span></label>
                        <div className="category-grid">
                            {categoryOptions.map((cat) => {
                                const index = selectedCategories.indexOf(cat);
                                const isSelected = index !== -1;
                                return (
                                    <div
                                        key={cat}
                                        className={`category-box ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleCategoryClick(cat)}
                                    >
                                        {cat}
                                        {isSelected && <div className="badge">{index + 1}</div>}
                                    </div>
                                )
                            })}
                        </div>
                        {errors.categories && <span className="error-msg">{errors.categories}</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '40px' }}>
                        <button type="submit" className="submit-btn outline-black" style={{ flex: 1, margin: 0 }}>수정 완료</button>
                    </div>

                    {/* Danger Zone: Delete Account */}
                    <div style={{
                        marginTop: '60px',
                        paddingTop: '30px',
                        borderTop: '1px solid #eee',
                        textAlign: 'left'
                    }}>
                        <h3 style={{ fontSize: '1rem', color: '#dc2626', marginBottom: '10px' }}>계정 삭제</h3>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px' }}>
                            계정을 삭제하면 모든 개인정보와 활동 기록이 영구적으로 제거됩니다.
                        </p>
                        <button
                            type="button"
                            onClick={handleDeleteAccount}
                            style={{
                                backgroundColor: 'white',
                                border: '1px solid #ff4d4d',
                                color: '#ff4d4d',
                                fontSize: '13px',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500'
                            }}
                        >
                            회원탈퇴
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
