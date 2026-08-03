import { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, Users, XCircle, RefreshCw, Activity, Layers, LayoutDashboard, Folder, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config/api';

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
      const res = await fetch(`${API_BASE}/metrics/summary`);
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
      <div className="flex-row items-center justify-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard size={26} color="var(--primary)" /> Dashboard & Monitorização Geral
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>Acompanhe os KPIs globais em tempo real e consulte o histórico de sessões processadas.</p>
        </div>
        <div className="flex-row items-center gap-2">
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
          <span className="text-muted" style={{ fontSize: '14px' }}>Sistema Conectado</span>
        </div>
      </div>

      {/* KPI & Reports Summary section */}
      <div className="glass-panel" style={{ marginBottom: '32px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36)', padding: '24px' }}>
        <div className="flex-row items-center justify-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--primary)" size={28} />
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '600', color: 'white' }}>Resumo Geral & Monitorização de Operações</h3>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Métricas globais e relatórios em tempo real do sistema</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={fetchMetrics}
            disabled={loadingMetrics}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', transition: 'all 0.2s', fontWeight: '500' }}
            title="Atualizar Métricas"
          >
            <RefreshCw size={14} style={{ animation: loadingMetrics ? 'spin 1s linear infinite' : 'none' }} />
            {loadingMetrics ? 'A atualizar...' : 'Atualizar Relatórios'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          {/* Card 1: Total Mensagens */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Total de Mensagens</span>
              <MessageSquare size={20} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#60A5FA' }}>
              {metrics.total_messages.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Em <strong style={{ color: 'white' }}>{metrics.total_projects}</strong> projetos/sessões</span>
            </div>
          </div>

          {/* Card 2: Sucessos no Envio */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Enviadas com Sucesso</span>
              <CheckCircle2 size={20} color="#10B981" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#34D399' }}>
              {metrics.total_success.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
              <TrendingUp size={14} /> <span>Taxa de Êxito: <strong>{metrics.success_rate}%</strong></span>
            </div>
          </div>

          {/* Card 3: Falhas / Erros */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Falhas & Sem Contacto</span>
              <XCircle size={20} color="#EF4444" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#F87171' }}>
              {metrics.total_errors.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Números inválidos ou inacessíveis</span>
            </div>
          </div>

          {/* Card 4: Clientes Únicos */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Clientes Únicos</span>
              <Users size={20} color="#A78BFA" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#C084FC' }}>
              {metrics.unique_clients.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Base total de códigos servidos</span>
            </div>
          </div>

          {/* Card 5: Cloud & Drive */}
          <div style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Sincronização Cloud</span>
              <Folder size={20} color="#F59E0B" />
            </div>
            <div style={{ fontSize: '30px', fontWeight: '700', color: '#FBBF24' }}>
              {metrics.gdrive_synced} <span style={{ fontSize: '16px', fontWeight: '400', color: 'var(--text-muted)' }}>/ {metrics.total_projects}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Projetos salvos no Google Drive</span>
            </div>
          </div>
        </div>

        {/* Tabela dos processamentos */}
        {metrics.recent_projects && metrics.recent_projects.length > 0 && (
          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
            <h4 style={{ fontSize: '15px', color: 'white', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', textAlign: 'left' }}>
              <Layers size={17} color="var(--primary)" /> Histórico Geral de Operações Processadas
            </h4>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '10px 12px' }}>Projeto (ID CTR)</th>
                    <th style={{ padding: '10px 12px' }}>Última Atualização</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Sucesso</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent_projects.map(rp => (
                    <tr key={rp.id_ctr} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--primary)' }}>{rp.id_ctr}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{rp.updated_at}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'white' }}>{rp.total}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#10B981', fontWeight: '600' }}>{rp.success}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: rp.error > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: rp.error > 0 ? '600' : '400' }}>{rp.error}</td>
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
