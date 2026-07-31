import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SendPanel from './pages/SendPanel';
import History from './pages/History';
import Settings from './pages/Settings';
import GoogleCallback from './pages/GoogleCallback';
import { LayoutDashboard, Send, History as HistoryIcon, Settings as SettingsIcon, LogOut } from 'lucide-react';

function ProtectedLayout({ children, setAuth }) {
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
      color: isActive ? '#f8fafc' : '#94a3b8',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderRadius: '12px',
      background: isActive ? 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)' : 'transparent',
      fontWeight: isActive ? '700' : '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontSize: '13px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
      boxShadow: isActive ? '0 4px 12px rgba(59,130,246,0.1)' : 'none'
    };
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-dark)' }}>
      <nav style={{ 
        background: 'rgba(15, 23, 42, 0.8)', 
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)', 
        padding: '12px 32px', 
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
          fontSize: '22px', 
          background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          letterSpacing: '-0.5px'
        }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>
            ⚡
          </div>
          CTR_WEB
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
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

        <div>
          <button onClick={handleLogout} style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
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
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.transform = 'none'; }}
          >
            <LogOut size={16} /> SAIR
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><History /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/history" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><Dashboard /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/painel" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><SendPanel /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><Settings /></ProtectedLayout> : <Navigate to="/login" />} 
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

