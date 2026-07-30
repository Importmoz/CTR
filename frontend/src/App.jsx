import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SendPanel from './pages/SendPanel';
import History from './pages/History';
import Settings from './pages/Settings';
import { LayoutDashboard, Send, History as HistoryIcon, Settings as SettingsIcon, LogOut } from 'lucide-react';

function ProtectedLayout({ children, setAuth }) {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth(false);
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <nav style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ fontWeight: '700', fontSize: '20px', color: 'var(--primary)' }}>CTR_WEB</div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link to="/history" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HistoryIcon size={18} /> Histórico
          </Link>
          <Link to="/painel" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} /> Painel de Envio
          </Link>
          <Link to="/settings" style={{ color: 'var(--text-main)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={18} /> Configurações
          </Link>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', marginLeft: '16px' }}>
            <LogOut size={18} /> Sair
          </button>
        </div>
      </nav>
      <main style={{ flex: 1, padding: '24px 32px', overflow: 'hidden' }}>
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
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><Dashboard /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/history" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><History /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/painel" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><SendPanel /></ProtectedLayout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={isAuthenticated ? <ProtectedLayout setAuth={setIsAuthenticated}><Settings /></ProtectedLayout> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;

