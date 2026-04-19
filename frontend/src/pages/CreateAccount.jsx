import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Logo from '../components/Logo';
import Searchbar from '../components/Searchbar';
import UserMenu from '../components/UserMenu';
import { categories as categoryData } from '../components/categoryIcon/categoryData';
import { useToast } from '../components/Toast';
import './CreateAccount.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export default function CreateAccount() {
    const navigate = useNavigate();
    const showToast = useToast();

    // --- State Management ---
    const [formData, setFormData] = useState({
        name: '',
        loginId: '',
        password: '',
        confirmPassword: '',
        email: '',
        ageGroup: '',
        gender: '',

    });

    const [selectedCategories, setSelectedCategories] = useState([]); // Stores chosen categories in order
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '#e0e0e0' });
    const [errors, setErrors] = useState({}); // To store validation error messages

    // --- Static Data ---
    const categoryOptions = categoryData
        .filter(cat => cat.label !== '전체메뉴' && cat.label !== '이슈' && cat.label !== '홈')
        .map(cat => cat.label);

    const ageGroups = ['10대', '20대', '30대', '40대', '50대', '60대+', '비공개'];
    const genders = ['남성', '여성', '비공개'];

    // --- Password Logic ---
    // Runs every time the password field changes
    useEffect(() => {
        const pwd = formData.password;
        if (!pwd) {
            setPasswordStrength({ score: 0, label: '', color: '#e0e0e0' });
            return;
        }

        let score = 0;
        if (pwd.length >= 8) score++;          // Check length
        if (/[A-Z]/.test(pwd)) score++;        // Check uppercase
        if (/[0-9]/.test(pwd)) score++;        // Check numbers
        if (/[!@#$%^&*]/.test(pwd)) score++;   // Check special chars

        const strengthConfig = [
            { label: '매우 약함', color: '#ff4d4d' }, // 0
            { label: '약함', color: '#ff944d' },      // 1
            { label: '보통', color: '#ffda4d' },      // 2
            { label: '강함', color: '#90ee90' },      // 3
            { label: '매우 강함', color: '#2ecc71' }  // 4
        ];

        // Cap score at 4
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

        // Clear specific error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }

        // If password changes, also clear confirmPassword error
        if (name === 'password' && errors.confirmPassword) {
            setErrors(prev => ({ ...prev, confirmPassword: null }));
        }
    };

    const handleCategoryClick = (category) => {
        if (selectedCategories.includes(category)) {
            // If already selected, remove it (deselect)
            setSelectedCategories(selectedCategories.filter(item => item !== category));
        } else {
            // If not selected, add to the end
            setSelectedCategories([...selectedCategories, category]);
        }
        // Clear category error if user selects
        if (errors.categories) {
            setErrors(prev => ({ ...prev, categories: null }));
        }
    };

    // --- Validation Logic ---
    const validate = () => {
        let newErrors = {};

        // 1. Name Check
        if (!formData.name.trim()) {
            newErrors.name = "이름을 입력해주세요.";
        }

        // 2. Login ID Check (6+ chars, at least 2 numbers)
        const numberCount = (formData.loginId.match(/\d/g) || []).length;
        if (formData.loginId.length < 6 || numberCount < 2) {
            newErrors.loginId = "아이디는 6자 이상이며, 숫자가 2개 이상 포함되어야 합니다.";
        }

        // 3. Email Check (@ symbol)
        if (!formData.email.includes('@')) {
            newErrors.email = "유효한 이메일 형식이 아닙니다 (@ 누락).";
        }

        // 3-1. Age Group Check
        if (!formData.ageGroup) {
            newErrors.ageGroup = "연령대를 선택해주세요.";
        }

        // 3-2. Gender Check
        if (!formData.gender) {
            newErrors.gender = "성별을 선택해주세요.";
        }

        // 4. Password Check (Basic requirement check)
        if (formData.password.length < 8) {
            newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
        }

        // 4-1. Password Confirmation Check
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
        }

        // 5. Category Check (At least 3)
        if (selectedCategories.length < 3) {
            newErrors.categories = `최소 3개의 관심 분야를 선택해주세요. (현재 ${selectedCategories.length}개 선택)`;
        }



        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (validate()) {
            // Prepare data for backend (matching UserCreateRequest schema)
            const submitData = {
                login_id: formData.loginId,
                username: formData.name,
                password_hash: formData.password, // Backend expects 'password_hash'
                email: formData.email,
                age_range: formData.ageGroup, // Backend expects 'age_range', not 'age_group'
                gender: formData.gender,
                subscribed_categories: selectedCategories,
                subscribed_keywords: [], // Optional field in backend

            };

            try {
                // POST request to backend
                const response = await fetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(submitData)
                });

                const data = await response.json();

                if (response.ok) {
                    // Success
                    showToast("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.", "success");
                    navigate('/login');
                } else {
                    // Backend returned an error
                    console.error("Signup failed:", data);
                    showToast(`회원가입 실패: ${data.detail || '알 수 없는 오류가 발생했습니다.'}`, "error");
                }
            } catch (error) {
                // Network or other error
                console.error("Network error:", error);
                showToast('서버와 연결할 수 없습니다. 나중에 다시 시도해주세요.', "error");
            }
        }
    };

    return (
        <div className="create-account-container">
            <Header
                leftChild={null}
                midChild={<Logo />}
                rightChild={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', width: 'auto' }}>
                        <div style={{ position: 'relative' }}>
                            <Searchbar className="always-open rounded-search" />
                        </div>
                        <UserMenu className="rounded-user-menu" />
                    </div>
                }
                headerTop="on"
                headerMain="on"
                headerBottom="on"
            />
            <div className="create-account-box">
                <h2>회원가입</h2>
                <p className="description">
                    맞춤형 뉴스 서비스를 경험하기 위해 계정을 생성하세요.
                </p>

                <form onSubmit={handleSubmit}>

                    {/* 1. Name Section */}
                    <div className="input-group">
                        <label>이름</label>
                        <input
                            type="text"
                            name="name"
                            placeholder="이름을 입력하세요"
                            value={formData.name}
                            onChange={handleChange}
                            className={errors.name ? "input-error" : ""}
                        />
                        {errors.name && <span className="error-msg">{errors.name}</span>}
                    </div>

                    {/* 2. Login ID Section */}
                    <div className="input-group">
                        <label>아이디</label>
                        <input
                            type="text"
                            name="loginId"
                            placeholder="영문+숫자 6자 이상 (숫자 2개 필수)"
                            value={formData.loginId}
                            onChange={handleChange}
                            className={errors.loginId ? "input-error" : ""}
                        />
                        {errors.loginId && <span className="error-msg">{errors.loginId}</span>}
                    </div>

                    {/* 3. Password Group (Joined) */}
                    <div className="input-group">
                        <label>비밀번호</label>
                        <div className="input-group-joined">
                            <div className="input-row-joined top">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="비밀번호 (8자 이상)"
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

                        {/* Password Feedback (Strength & Match) */}
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

                    {/* 4. Email Section */}
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

                    {/* 5. Age & Gender */}
                    <div className="input-row-flex">
                        <div className="input-group half">
                            <label>연령대</label>
                            <select
                                name="ageGroup"
                                value={formData.ageGroup}
                                onChange={handleChange}
                                className={errors.ageGroup ? "input-error" : ""}
                            >
                                <option value="">선택</option>
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
                                <option value="">선택</option>
                                {genders.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            {errors.gender && <span className="error-msg">{errors.gender}</span>}
                        </div>
                    </div>

                    {/* 6. Categories */}
                    <div className="category-section">
                        <label>관심 분야 <span className="sub-label">(3개 이상 선택)</span></label>
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



                    <button type="submit" className="submit-btn" disabled={false}>가입하기</button>

                    <div className="login-redirect">
                        <span onClick={() => navigate('/login')}>로그인으로 돌아가기</span>
                    </div>
                </form>
            </div >
        </div >
    );
}
