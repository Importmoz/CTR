import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, Users, XCircle, RefreshCw, Activity, Layers, LayoutDashboard, Folder, CheckCircle2 } from 'lucide-react';
import { API_BASE, fetchApi } from '../config/api';

export default function History() {
  const [metrics, setMetrics] = useState({
    total_projects: 0,
    total_messages: 0,
    total_success: 0,
    total_errors: 0,
    total_pending: 0,
    success_rate: 0.0,
    unique_clients: 0,
    gdrive_synced: 0,
    recent_projects: []
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetchApi(`${API_BASE}/metrics/summary`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar métricas:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="container animate-fade-in">


      {/* KPI & Reports Summary section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '32px', paddingTop: '16px' }}>
        <div className="flex-row items-center justify-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--primary)" size={28} />
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '600', color: 'var(--text-main)' }}>Resumo Geral & Monitorização de Operações</h3>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Métricas globais e relatórios em tempo real do sistema</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={fetchMetrics}
            disabled={loadingMetrics}
            style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: 'all 0.2s', fontWeight: '500' }}
            title="Atualizar Métricas"
          >
            <RefreshCw size={14} style={{ animation: loadingMetrics ? 'spin 1s linear infinite' : 'none' }} />
            {loadingMetrics ? 'A atualizar...' : 'Atualizar Relatórios'}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '12px 20px', marginTop: '16px', gap: '16px' }}>
          
          {/* Item 1 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Total Mensagens</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#60A5FA', lineHeight: '1.2' }}>{metrics.total_messages.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <MessageSquare size={18} color="#3B82F6" />
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)' }} className="hide-on-mobile"></div>

          {/* Item 2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Sucessos</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#34D399', lineHeight: '1.2' }}>{metrics.total_success.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <CheckCircle2 size={18} color="#10B981" />
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)' }} className="hide-on-mobile"></div>

          {/* Item 3 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Falhas</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#F87171', lineHeight: '1.2' }}>{metrics.total_errors.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <XCircle size={18} color="#EF4444" />
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)' }} className="hide-on-mobile"></div>

          {/* Item 4 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Clientes</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#C084FC', lineHeight: '1.2' }}>{metrics.unique_clients.toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <Users size={18} color="#A78BFA" />
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--glass-border)' }} className="hide-on-mobile"></div>

          {/* Item 5 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>Drive</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#FBBF24', lineHeight: '1.2' }}>
                {metrics.gdrive_synced} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '400' }}>/ {metrics.total_projects}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '8px' }}>
              <Folder size={18} color="#F59E0B" />
            </div>
          </div>
        </div>

        {/* Tabela dos processamentos */}
        {metrics.recent_projects && metrics.recent_projects.length > 0 && (
          <div style={{ marginTop: '32px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600', textAlign: 'left', flexShrink: 0 }}>
              <Layers size={18} color="var(--primary)" /> Histórico Geral de Operações Processadas
            </h4>
            <div style={{ overflow: 'auto', flex: 1, minHeight: 0, borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 1 }}>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '10px 16px', fontWeight: '500', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTR</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '500', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atualização</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '500', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '500', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sucesso</th>
                    <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '500', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent_projects.map(rp => (
                    <tr key={rp.id_ctr} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--glass-bg-subtle)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '8px 16px', fontWeight: '600', color: 'var(--primary)' }}>{rp.id_ctr}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{rp.updated_at}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-main)' }}>{rp.total}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', color: '#10B981', fontWeight: '600' }}>{rp.success}</td>
                      <td style={{ padding: '8px 16px', textAlign: 'center', color: rp.error > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: rp.error > 0 ? '600' : '400' }}>{rp.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
