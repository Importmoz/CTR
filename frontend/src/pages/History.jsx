import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, Users, XCircle, RefreshCw, Activity, Layers, Folder, CheckCircle2, BarChart2, CheckCheck, Send, Eye } from 'lucide-react';
import { API_BASE, fetchApi } from '../config/api';
import ListSkeletonLoader from '../components/ListSkeletonLoader';

export default function History() {
  const [metrics, setMetrics] = useState({
    total_projects: 0,
    total_messages: 0,
    total_sent: 0,
    total_delivered: 0,
    total_read: 0,
    total_success: 0,
    total_errors: 0,
    total_pending: 0,
    success_rate: 0.0,
    delivery_rate: 0.0,
    read_rate: 0.0,
    unique_clients: 0,
    gdrive_synced: 0,
    recent_projects: []
  });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [mainViewMode, setMainViewMode] = useState('overview'); // 'overview' ou 'analytics'

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
    <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Header com Switch Toggle */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '32px', paddingTop: '16px' }}>
        <div className="flex-row items-center justify-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {mainViewMode === 'overview' ? <Activity color="var(--primary)" size={28} /> : <BarChart2 color="var(--primary)" size={28} />}
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '600', color: 'var(--text-main)' }}>
                {mainViewMode === 'overview' ? 'Resumo Geral & Monitorização de Operações' : 'Estatísticas & Análise de Gráficos'}
              </h3>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {mainViewMode === 'overview' ? 'Métricas globais e relatórios em tempo real do sistema' : 'Análise gráfica avançada de mensagens disparadas, entregues e lidas'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Switch Toggle UI Button */}
            <div style={{
              display: 'flex',
              background: 'var(--panel-bg-solid)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '4px',
              gap: '4px',
              boxShadow: '0 4px 12px var(--shadow-color)'
            }}>
              <button
                type="button"
                onClick={() => setMainViewMode('overview')}
                style={{
                  background: mainViewMode === 'overview' ? 'var(--primary)' : 'transparent',
                  color: mainViewMode === 'overview' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: mainViewMode === 'overview' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Activity size={16} /> Visão Geral
              </button>
              <button
                type="button"
                onClick={() => setMainViewMode('analytics')}
                style={{
                  background: mainViewMode === 'analytics' ? 'var(--primary)' : 'transparent',
                  color: mainViewMode === 'analytics' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: mainViewMode === 'analytics' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <BarChart2 size={16} /> Estatísticas & Gráficos
              </button>
            </div>

            <button 
              type="button" 
              onClick={fetchMetrics}
              disabled={loadingMetrics}
              style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: 'all 0.2s', fontWeight: '500' }}
              title="Atualizar Métricas"
            >
              <RefreshCw size={14} style={{ animation: loadingMetrics ? 'spin 1s linear infinite' : 'none' }} />
              {loadingMetrics ? 'A atualizar...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {mainViewMode === 'overview' ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '12px 20px', marginTop: '8px', gap: '16px' }}>
              
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
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#34D399', lineHeight: '1.2' }}>{(metrics.total_sent || metrics.total_success || 0).toLocaleString()}</div>
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
            {loadingMetrics ? (
              <div style={{ marginTop: '24px' }}>
                <ListSkeletonLoader count={6} title="A carregar histórico geral de operações..." />
              </div>
            ) : metrics.recent_projects && metrics.recent_projects.length > 0 && (
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
                      {metrics.recent_projects.map((rp, idx) => (
                        <tr 
                          key={rp.id_ctr} 
                          className={`animate-stagger-item stagger-${(idx % 10) + 1}`}
                          style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} 
                          onMouseOver={e => e.currentTarget.style.background = 'var(--glass-bg-subtle)'} 
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 16px', fontWeight: '600', color: 'var(--primary)' }}>{rp.id_ctr}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{rp.updated_at}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-main)' }}>{rp.total}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'center', color: '#10B981', fontWeight: '600' }}>{rp.sent || rp.success}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'center', color: rp.error > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: rp.error > 0 ? '600' : '400' }}>{rp.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Visual Analytics & Graphs Page */
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Row 1: WhatsApp Lifecycle KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              
              {/* Card 1: Mensagens Disparadas */}
              <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Disparadas 📤</span>
                  <Send size={18} color="#3B82F6" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#60A5FA' }}>{(metrics.total_sent || metrics.total_success || 0).toLocaleString()}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>mensagens</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Enviadas para os servidores WhatsApp API
                </div>
              </div>

              {/* Card 2: Entregues no Telemóvel */}
              <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Entregues 📬</span>
                  <CheckCheck size={18} color="#10B981" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#34D399' }}>{(metrics.total_delivered || metrics.total_success || 0).toLocaleString()}</span>
                  <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>({metrics.delivery_rate || metrics.success_rate || 0}%)</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Recebidas no telemóvel do cliente (duplo risco)
                </div>
              </div>

              {/* Card 3: Confirmadas Lidas */}
              <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Confirmadas Lidas 👁️</span>
                  <Eye size={18} color="#60A5FA" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#60A5FA' }}>{(metrics.total_read || 0).toLocaleString()}</span>
                  <span style={{ fontSize: '12px', color: '#60A5FA', fontWeight: '600' }}>({metrics.read_rate || 0}%)</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Visualizadas pelo cliente (duplo risco azul)
                </div>
              </div>

              {/* Card 4: Falhados / Não Entregues */}
              <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Falhados ❌</span>
                  <XCircle size={18} color="#EF4444" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '900', color: '#F87171' }}>{(metrics.total_errors || 0).toLocaleString()}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>com erro</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Números sem WhatsApp ou falha de rede
                </div>
              </div>

            </div>

            {/* Row 3: Detalhamento por Lote de CTR */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ textAlign: 'left' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={18} color="var(--primary)" /> Análise Detalhada de Envio e Recepção por CTR
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Detalhamento individual de cada lote CTR com métricas de entregas e leituras</span>
                </div>
              </div>

              <div style={{ overflow: 'auto', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '500' }}>CTR</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Data</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Total</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Disparados 📤</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Entregues 📬</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Lidos 👁️</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '500' }}>Falhas ❌</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recent_projects && metrics.recent_projects.map((proj, idx) => (
                      <tr 
                        key={proj.id_ctr} 
                        className={`animate-stagger-item stagger-${(idx % 10) + 1}`}
                        style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }} 
                        onMouseOver={e => e.currentTarget.style.background = 'var(--glass-bg-subtle)'} 
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--primary)' }}>{proj.id_ctr}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>{proj.updated_at}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600' }}>{proj.total}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#60A5FA', fontWeight: '600' }}>{proj.sent || proj.success}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#34D399', fontWeight: '600' }}>{proj.delivered || proj.success}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: '#60A5FA', fontWeight: '600' }}>{proj.read || 0}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: proj.error > 0 ? '#F87171' : 'var(--text-muted)', fontWeight: proj.error > 0 ? '600' : '400' }}>{proj.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
