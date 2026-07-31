import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, Loader } from 'lucide-react';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setError('Nenhum código de autorização encontrado no URL.');
      return;
    }

    const fetchToken = async () => {
      try {
        const code_verifier = localStorage.getItem('google_code_verifier') || '';
        const res = await fetch('http://localhost:8000/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier })
        });
        const data = await res.json();
        
        if (data.success) {
          setStatus('success');
          setTimeout(() => {
            navigate('/settings');
          }, 3000);
        } else {
          setStatus('error');
          setError(data.message || 'Erro ao processar o login no servidor.');
        }
      } catch (err) {
        setStatus('error');
        setError('Falha de comunicação com o servidor backend.');
      }
    };

    fetchToken();
  }, [searchParams, navigate]);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
        {status === 'loading' && (
          <div className="flex-col" style={{ alignItems: 'center', gap: '16px' }}>
            <Loader size={48} className="spin" color="var(--primary)" />
            <h2>A autenticar...</h2>
            <p className="text-muted">Por favor, aguarde enquanto validamos o seu acesso ao Google Drive.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex-col animate-fade-in" style={{ alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '50%' }}>
              <CheckCircle size={48} color="var(--success)" />
            </div>
            <h2>Login Efectuado!</h2>
            <p className="text-muted">A integração com o Google Drive foi concluída com sucesso. A redirecionar...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex-col animate-fade-in" style={{ alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '50%' }}>
              <AlertTriangle size={48} color="var(--danger)" />
            </div>
            <h2>Erro de Autenticação</h2>
            <p className="text-muted" style={{ color: 'var(--danger)' }}>{error}</p>
            <button onClick={() => navigate('/settings')} className="btn btn-primary" style={{ marginTop: '16px' }}>
              Voltar às Configurações
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
