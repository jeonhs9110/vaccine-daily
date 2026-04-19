import React from 'react';
import './App.css';
import { Main } from './pages/Main';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ArticlePage from './pages/ArticlePage.jsx';
import CreateAccount from './pages/CreateAccount.jsx';
import Login from './components/Login.jsx';
import MyPage from './pages/MyPage.jsx';
import SearchResult from './pages/SearchResult.jsx';
import FindId from './pages/FindId.jsx';

import PoliticsPage from './pages/PoliticsPage.jsx';
import EconomicsPage from './pages/EconomicsPage.jsx';
import SocietyPage from './pages/SocietyPage.jsx';
import SciencePage from './pages/SciencePage.jsx';
import WorldPage from './pages/WorldPage.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { ToastProvider } from './components/Toast.jsx';

function App() {
  return (
    <HashRouter future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>
      <ScrollToTop />
      <ErrorBoundary>
        <ToastProvider>
          <div className="App">
            <Routes>
              <Route path="/" element={<Main />} />
              <Route path="/article/:id" element={<ArticlePage />} />
              <Route path="/politics" element={<PoliticsPage />} />
              <Route path="/economy" element={<EconomicsPage />} />
              <Route path="/society" element={<SocietyPage />} />
              <Route path="/science" element={<SciencePage />} />
              <Route path="/world" element={<WorldPage />} />

              <Route path='/login' element={<Login />} />
              <Route path='/CreateAccount' element={<CreateAccount />} />
              <Route path='/mypage/:login_id' element={<MyPage />} />
              <Route path='/search' element={<SearchResult />} />
              <Route path='/find-id' element={<FindId />} />
            </Routes>
          </div>
        </ToastProvider>
      </ErrorBoundary>
    </HashRouter>
  );
}

export default App;
