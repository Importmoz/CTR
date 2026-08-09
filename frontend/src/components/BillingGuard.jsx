import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, KeyRound, Loader2, ExternalLink } from 'lucide-react';
import { API_BASE } from '../config/api';

const BillingGuard = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [subId, setSubId] = useState("");
  const [activating, setActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/subscription/status`);
      setStatus(res.data);
      if (!res.data.is_active) setShowModal(true);
      else setShowModal(false);
    } catch (err) {
      console.error("Erro ao verificar subscrição:", err);
      // Assume inactive if server fails with 402 or similar
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 402) {
          setShowModal(true);
          setStatus({
            is_active: false,
            message: error.response.data?.detail || "Subscrição inativa ou pagamento necessário."
          });
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!subId.trim()) return;
    setActivating(true);
    setErrorMsg("");
    try {
      const res = await axios.post(`${API_BASE}/subscription/activate`, {
        subscription_id: subId
      });
      setStatus(res.data);
      if (res.data.is_active) {
        setShowModal(false);
      } else {
        setErrorMsg(res.data.message || "Licença inválida ou inativa.");
      }
    } catch (err) {
      setErrorMsg("Erro ao ativar licença. Verifique a sua conexão.");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)' }}>
        <Loader2 className="animate-spin" style={{ color: '#3b82f6' }} size={32} />
      </div>
    );
  }

  return (
    <>
      {children}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            padding: '40px', borderRadius: '24px', width: '100%', maxWidth: '450px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <ShieldAlert size={32} color="#ef4444" />
            </div>
            
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>
              Subscrição Inativa
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
              {status?.message || "O acesso ao sistema foi suspenso. Para continuar a processar CTRs, por favor ative a sua licença mensal."}
            </p>

            <form onSubmit={handleActivate} style={{ marginBottom: '24px' }}>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <KeyRound size={18} color="#64748b" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="ID da Subscrição (ex: sub_abc123)"
                  value={subId}
                  onChange={(e) => setSubId(e.target.value)}
                  style={{
                    width: '100%', padding: '14px 16px 14px 44px', boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', color: 'white', fontSize: '14px',
                    outline: 'none', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
              
              {errorMsg && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={activating || !subId.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white', fontWeight: '600', fontSize: '14px',
                  border: 'none', cursor: (activating || !subId.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (activating || !subId.trim()) ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'opacity 0.2s'
                }}
              >
                {activating ? <Loader2 className="animate-spin" size={18} /> : 'Ativar Sistema'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>Ainda não tem uma subscrição?</p>
              <a 
                href="https://creem.io" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  color: '#3b82f6', textDecoration: 'none', fontSize: '14px', fontWeight: '500'
                }}
              >
                Assinar Plano Mensal <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BillingGuard;
