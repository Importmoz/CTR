import { useState, useEffect } from 'react';
import { DownloadCloud, Trash2, Database, History as HistoryIcon, ChevronDown, List } from 'lucide-react';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, success: 0, error: 0 });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:8000/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSessionHistory = async (e) => {
    const id_ctr = e.target.value;
    setSelectedSession(id_ctr);
    if (!id_ctr) {
      setHistoryData([]);
      setSummary({ total: 0, success: 0, error: 0 });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/sessions/${id_ctr}`);
      if (res.ok) {
        const data = await res.json();
        const queue = data.queue || [];
        setHistoryData(queue);
        
        let success = 0;
        let error = 0;
        queue.forEach(item => {
          if (item.status === 'Enviado') success++;
          if (item.status === 'Erro') error++;
        });
        
        setSummary({ total: queue.length, success, error });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async () => {
    if (!selectedSession) return;
    
    const code = window.prompt(`Para apagar a sessão ${selectedSession}, por favor insira o código de autorização:`);
    if (code === null) return; // User cancelled
    
    if (!code.trim()) {
      alert("Código não pode estar vazio.");
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:8000/sessions/${selectedSession}/delete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: code.trim() })
      });
      
      if (res.ok) {
        setSelectedSession('');
        setHistoryData([]);
        setSummary({ total: 0, success: 0, error: 0 });
        fetchSessions();
        alert('Sessão e ficheiros associados apagados com sucesso!');
      } else if (res.status === 401) {
        alert('Erro: Código de autorização inválido.');
      } else {
        alert('Erro ao apagar sessão.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação ao apagar sessão.');
    }
  };

  return (
    <div className="container animate-fade-in">
      <h2><HistoryIcon size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'bottom' }} /> Histórico e Relatórios</h2>
      <p className="text-muted" style={{ marginBottom: '32px' }}>Consulte as sessões anteriores e o estado final dos envios.</p>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Selecione uma sessão para ver os detalhes:</label>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <div 
            className="input-wrapper" 
            style={{ cursor: 'pointer', justifyContent: 'space-between', padding: '8px 12px' }}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={18} color="var(--primary)" />
              <span style={{ fontSize: '14px' }}>
                {selectedSession ? `${selectedSession} (Atualizado a ${sessions.find(s => s.id_ctr === selectedSession)?.updated_at || '...'})` : '-- Escolha uma sessão --'}
              </span>
            </div>
            <ChevronDown size={16} color="var(--text-muted)" />
          </div>
          
          {isDropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
              background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)',
              borderRadius: '12px', overflow: 'hidden', zIndex: 50,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', maxHeight: '300px', overflowY: 'auto'
            }}>
              <div 
                className="dropdown-item"
                style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: !selectedSession ? 'var(--primary)' : 'var(--text-main)', background: !selectedSession ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                onClick={() => { loadSessionHistory({target: {value: ''}}); setIsDropdownOpen(false); }}
              >
                -- Escolha uma sessão --
              </div>
              {sessions.map(s => (
                <div key={s.id_ctr} className="dropdown-item"
                  style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: selectedSession === s.id_ctr ? 'var(--primary)' : 'var(--text-main)', background: selectedSession === s.id_ctr ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                  onClick={() => { loadSessionHistory({target: {value: s.id_ctr}}); setIsDropdownOpen(false); }}
                >
                  {s.id_ctr} (Atualizado a {s.updated_at})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-col items-center justify-center py-8">
          <div className="spinner"></div>
          <p className="mt-4 text-muted">A carregar dados...</p>
        </div>
      ) : selectedSession && historyData.length > 0 ? (
        <div className="animate-fade-in">
          {/* Dashboard Metrics */}
          <div className="flex-row gap-4" style={{ marginBottom: '24px' }}>
            <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
              <p className="text-muted text-sm">Total de Mensagens</p>
              <h2 style={{ fontSize: '32px', margin: '8px 0 0 0' }}>{summary.total}</h2>
            </div>
            <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
              <p className="text-muted text-sm" style={{ color: 'var(--success)' }}>Enviados com Sucesso</p>
              <h2 style={{ fontSize: '32px', margin: '8px 0 0 0', color: 'var(--success)' }}>{summary.success}</h2>
            </div>
            <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
              <p className="text-muted text-sm" style={{ color: 'var(--danger)' }}>Erros</p>
              <h2 style={{ fontSize: '32px', margin: '8px 0 0 0', color: 'var(--danger)' }}>{summary.error}</h2>
            </div>
          </div>

          <div className="glass-panel" style={{ marginBottom: '24px' }}>
            <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Código</th>
                    <th style={{ padding: '12px' }}>ID Code</th>
                    <th style={{ padding: '12px' }}>Nome</th>
                    <th style={{ padding: '12px' }}>Telefone</th>
                    <th style={{ padding: '12px' }}>Normal</th>
                    <th style={{ padding: '12px' }}>Levantamento</th>
                    <th style={{ padding: '12px' }}>Erro</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{item.list_code}</td>
                      <td style={{ padding: '12px' }}>{item.id_code}</td>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px' }}>{item.phone}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          background: item.status === 'Pendente' ? 'rgba(255,255,255,0.1)' : (item.status && item.status.includes('Erro')) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: item.status === 'Pendente' ? 'var(--text-main)' : (item.status && item.status.includes('Erro')) ? 'var(--danger)' : 'var(--success)'
                        }}>
                          {item.status || 'Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          background: (!item.status_levantamento || item.status_levantamento === 'Pendente') ? 'rgba(255,255,255,0.1)' : (item.status_levantamento && item.status_levantamento.includes('Erro')) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: (!item.status_levantamento || item.status_levantamento === 'Pendente') ? 'var(--text-main)' : (item.status_levantamento && item.status_levantamento.includes('Erro')) ? 'var(--danger)' : 'var(--success)'
                        }}>
                          {item.status_levantamento || 'Pendente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--danger)', fontSize: '12px' }}>
                        {item.error ? `Normal: ${item.error}` : ''}
                        {item.error && item.error_levantamento ? ' | ' : ''}
                        {item.error_levantamento ? `Levantamento: ${item.error_levantamento}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex-row gap-4">
            <button 
              onClick={() => window.location.href = `http://localhost:8000/download/csv/${selectedSession}`}
              className="btn btn-primary" 
              style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <Database size={18} /> Baixar Relatório (CSV)
            </button>
            <button 
              onClick={() => window.location.href = `http://localhost:8000/download/zip/${selectedSession}`}
              className="btn" 
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <DownloadCloud size={18} /> Baixar ZIP ({selectedSession}.zip)
            </button>
            <button 
              onClick={deleteSession}
              className="btn" 
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.5)', display: 'flex', gap: '8px' }}
            >
              <Trash2 size={18} /> Apagar Sessão
            </button>
          </div>
        </div>
      ) : selectedSession && historyData.length === 0 ? (
        <div className="glass-panel text-center py-8">
          <p className="text-muted">Esta sessão não tem dados guardados.</p>
        </div>
      ) : null}
    </div>
  );
}
