import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: '40px', textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>문제가 발생했습니다</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>페이지를 새로고침 해주세요.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', fontSize: '15px', cursor: 'pointer',
              border: '1px solid #333', borderRadius: '6px', background: '#fff'
            }}
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
