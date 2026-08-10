import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Wrench, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function Login({ setAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setAuth(true);
        navigate('/');
      } else {
        setError(data.detail || 'Erro ao efetuar login');
      }
    } catch (err) {
      setError('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col items-center justify-center animate-fade-in" style={{ minHeight: '100vh', width: '100%' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '360px', padding: '32px' }}>
        <div className="flex-col items-center gap-4" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <img src="/logo.png" alt="Whatss Logo" style={{ width: '50px', height: '50px', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(16, 185, 129, 0.3))' }} />
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Whatss
            </h1>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex-col gap-4">
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="email" 
              className="glass-input" 
              style={{ paddingLeft: '40px', background: 'var(--glass-bg-subtle)', border: '1px solid transparent', opacity: loading ? 0.6 : 1 }}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              disabled={loading}
              required 
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type={showPassword ? "text" : "password"} 
              className="glass-input" 
              style={{ paddingLeft: '40px', paddingRight: '40px', background: 'var(--glass-bg-subtle)', border: '1px solid transparent', opacity: loading ? 0.6 : 1 }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              required 
            />
            <div 
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </div>
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              width: '100%', marginTop: '16px', padding: '12px', fontSize: '15px', 
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              opacity: loading ? 0.8 : 1, transition: 'all 0.3s ease'
            }} 
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Lock size={16} />
            )}
            {loading ? 'A autenticar...' : 'Iniciar Sessão'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
