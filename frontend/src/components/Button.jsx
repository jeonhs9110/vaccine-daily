import './Button.css';
import React from 'react';

/**
 * 다양한 설정값(props)을 받아 커스터마이징이 가능한 재사용 버튼 컴포넌트입니다.
 * * @param {string} text - 버튼 내부에 표시될 텍스트입니다.
 * @param {string} color - 버튼의 배경색을 지정합니다. (기본값: "#111111")
 * @param {string} textColor - 버튼 텍스트의 색상을 지정합니다. (기본값: "white")
 * @param {string} fontSize - 텍스트의 크기를 지정합니다. (기본값: "16px")
 * @param {string} borderRadius - outline 의 라운드 효과를 지정합니다. (기본값: "50px")
 * @param {function} onClick - 버튼 클릭 시 실행될 이벤트 핸들러 함수입니다.
 * @param {boolean} disabled - 버튼의 비활성화 상태를 결정합니다. true일 경우 클릭이 불가능합니다.
 * @param {string} className - 컴포넌트 외부에 추가로 정의된 CSS 클래스를 적용할 때 사용합니다.
 * @param {string|number} width - 버튼의 가로 너비를 지정합니다. (예: "100px", "50%")
 * @param {string|number} height - 버튼의 세로 높이를 지정합니다. (예: "40px")
 */
function Button({
    text,                   // 버튼에 표시할 글자
    color = "#111111",      // 버튼 배경색 (기본값: 검정 계열)
    textColor = "white",    // 글자 색상 (기본값: 흰색)
    fontSize = "16px",      // 글자 크기 (기본값: 16px)
    borderRadius = "50px",  // 외각 라운드값 (기본값: 50px)
    onClick = () => { },     // 버튼 클릭 시 실행할 함수 (기본값: 빈 함수)
    disabled = false,       // 버튼 비활성화 여부 (기본값: false)
    className = "",         // 외부에서 추가할 CSS 클래스 이름
    style: customStyle,     // 외부에서 전달받는 커스텀 스타일
    width,                  // 버튼 너비 (선택 사항)
    height                  // 버튼 높이 (선택 사항)
}) {
    // 인라인 스타일 객체: props로 받은 동적인 값들을 스타일로 변환합니다.
    const defaultStyle = {
        backgroundColor: color,
        color: textColor,
        fontSize: fontSize,
        borderRadius: borderRadius,
        width: width,
        height: height,
    };

    const finalStyle = { ...defaultStyle, ...customStyle };

    return (
        <button
            // 기본 클래스 'Button'과 외부에서 받아온 'className'을 합쳐서 적용합니다.
            className={`Button ${className}`}
            // 위에서 정의한 인라인 스타일을 적용합니다.
            style={finalStyle}
            // 클릭 이벤트 핸들러를 연결합니다.
            onClick={onClick}
            // disabled 속성이 true가 되면 버튼이 비활성화됩니다.
            disabled={disabled}
        >
            {/* 버튼 내부에 텍스트 출력 */}
            {text}
        </button>
    );
}

export default Button;