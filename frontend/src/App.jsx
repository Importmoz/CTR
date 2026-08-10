import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SendPanel from './pages/SendPanel';
import History from './pages/History';
import Settings from './pages/Settings';
import GoogleCallback from './pages/GoogleCallback';
import BillingGuard from './components/BillingGuard';
import { LayoutDashboard, Send, History as HistoryIcon, Settings as SettingsIcon, LogOut, MessageCircle, Wrench, Sun, Moon } from 'lucide-react';

function ProtectedLayout({ children, setAuth, theme, toggleTheme }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth(false);
  };

  const getLinkStyle = (path) => {
    const isActive = currentPath === path;
    return {
      color: isActive ? 'var(--primary)' : 'var(--text-muted)',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '12px',
      background: isActive ? 'var(--bg-grad-1)' : 'transparent',
      fontWeight: isActive ? '700' : '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontSize: '13px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: isActive ? '1px solid var(--glass-border)' : '1px solid transparent',
      boxShadow: isActive ? '0 4px 12px var(--shadow-color)' : 'none'
    };
  };

  return (
    <BillingGuard>
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-dark)' }}>
      <nav className="top-nav" style={{ 
        background: 'var(--panel-bg-translucent)', 
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--glass-border)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ 
          fontWeight: '800', 
          fontSize: '28px', 
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          letterSpacing: '-0.5px'
        }}>
          <img src="/logo.png" alt="Whatss Logo" style={{ width: '84px', height: '84px', objectFit: 'contain', filter: 'drop-shadow(0 4px 14px rgba(16, 185, 129, 0.4))' }} />
          <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '900',
            letterSpacing: '-0.5px',
            paddingRight: '4px'
          }}>
            Whatss
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: 'var(--glass-bg-subtle)', padding: '6px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
          <Link to="/" style={getLinkStyle('/')}>
            <LayoutDashboard size={16} color={currentPath === '/' ? '#60a5fa' : 'currentColor'} /> DASHBOARD
          </Link>
          <Link to="/history" style={getLinkStyle('/history')}>
            <HistoryIcon size={16} color={currentPath === '/history' ? '#60a5fa' : 'currentColor'} /> CTR
          </Link>
          <Link to="/painel" style={getLinkStyle('/painel')}>
            <Send size={16} color={currentPath === '/painel' ? '#60a5fa' : 'currentColor'} /> ENVIO
          </Link>
          <Link to="/settings" style={getLinkStyle('/settings')}>
            <SettingsIcon size={16} color={currentPath === '/settings' ? '#60a5fa' : 'currentColor'} /> CONFIGURAÇÕES
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{
            background: 'var(--glass-bg-subtle)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '12px',
            transition: 'all 0.2s'
          }} title="Mudar Tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={handleLogout} style={{ 
            background: 'var(--danger-bg)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#f87171', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '13px', 
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '8px 16px',
            borderRadius: '12px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.transform = 'none'; }}
          >
            <LogOut size={16} /> SAIR
          </button>
        </div>
      </nav>
      <main className="main-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      </div>
    </BillingGuard>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={<Login setAuth={setIsAuthenticated} />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated} theme={theme} toggleTheme={toggleTheme}><History /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/history" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated} theme={theme} toggleTheme={toggleTheme}><Dashboard /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/painel" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated} theme={theme} toggleTheme={toggleTheme}><SendPanel /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated} theme={theme} toggleTheme={toggleTheme}><Settings /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/api/google/auth/callback" 
          element={<GoogleCallback />} 
        />
      </Routes>
    </Router>
  );
}

export default App;

