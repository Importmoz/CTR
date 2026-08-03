import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function Login({ setAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="flex-col items-center gap-4" style={{ marginBottom: '32px' }}>
          <div style={{ background: 'var(--primary)', padding: '16px', borderRadius: '50%' }}>
            <Lock size={32} color="white" />
          </div>
          <h2>Acesso Restrito</h2>
        </div>

        <form onSubmit={handleLogin} className="flex-col gap-4">
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>E-mail</label>
            <input 
              type="email" 
              className="glass-input" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Palavra-passe</label>
            <input 
              type="password" 
              className="glass-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'A verificar...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
