import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HomePage } from './pages/HomePage';
import { GamePage } from './pages/GamePage';
import { StatsPage } from './pages/StatsPage';

const NotFoundPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
    <h1 className="text-3xl font-extrabold text-slate-900">404 - Page Not Found</h1>
    <p className="text-slate-600 text-sm">The requested page or game match route does not exist.</p>
    <a
      href="/"
      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-block"
    >
      Return to Home
    </a>
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
            },
          }}
        />

        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <NavLink to="/" className="flex items-center group">
              <span className="font-extrabold text-lg tracking-tight text-slate-950 group-hover:text-indigo-700 transition-colors">
                WAR <span className="text-slate-500 font-normal text-sm">Simulator</span>
              </span>
            </NavLink>

            <nav className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                <span>Home</span>
              </NavLink>

              <NavLink
                to="/stats"
                className={({ isActive }) =>
                  `flex items-center px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                <span>Analytics</span>
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <p>War Card Game Simulator Engine - Full-Stack FastAPI, Turso & React Setup</p>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
