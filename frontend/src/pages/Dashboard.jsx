import { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, DownloadCloud, Calendar, ChevronDown, MapPin, Navigation, ExternalLink, Copy, FileText, Folder, Check, Trash2, Database, History as HistoryIcon, List } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    id_ctr: '',
    origin_sel: 'CHINA',
    dest_sel: 'MAPUTO',
    loading_date: '',
    expected_date: '',
    payment_deadline: '',
    dist_mode: 'Padrão',
    filipe_target: 200000,
    send_whatsapp: false
  });
  const [isOriginOpen, setIsOriginOpen] = useState(false);
  const [isDestOpen, setIsDestOpen] = useState(false);
  const [isDistModeOpen, setIsDistModeOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [gdriveData, setGdriveData] = useState({ sheetId: '', folderId: '' });
  const [copiedField, setCopiedField] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, success: 0, error: 0 });
  const [gdriveInfo, setGdriveInfo] = useState({ sheetId: '', folderId: '' });
  const [activeView, setActiveView] = useState('upload'); // 'upload' ou 'monitor'
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
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
      setGdriveInfo({ sheetId: '', folderId: '' });
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:8000/sessions/${id_ctr}`);
      if (res.ok) {
        const data = await res.json();
        const queue = data.queue || [];
        setHistoryData(queue);
        setGdriveInfo({ sheetId: data.sheetId || '', folderId: data.folderId || '' });
        
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
      setLoadingHistory(false);
    }
  };

  const deleteSession = async () => {
    if (!selectedSession) return;
    
    const code = window.prompt(`Para apagar a sessão ${selectedSession}, por favor insira o código de autorização:`);
    if (code === null) return;
    
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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const startProcessing = async (data) => {
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: data,
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus('error');
        setProgress({ percent: 0, message: result.detail || 'Erro no upload' });
      }
    } catch (err) {
      setStatus('error');
      setProgress({ percent: 0, message: 'Erro de comunicação com servidor' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      alert("Por favor, selecione ou arraste uma planilha Excel antes de iniciar!");
      return;
    }
    if (!formData.id_ctr || !formData.id_ctr.trim()) {
      alert("Por favor, preencha o campo 'ID CTR'!");
      return;
    }
    if (!formData.loading_date || !formData.expected_date) {
      alert("Por favor, selecione as datas de 'Loading' e 'Chegada'!");
      return;
    }
    
    setStatus('uploading');
    setGdriveData({ sheetId: '', folderId: '' });
    setProgress({ percent: 5, message: 'A enviar ficheiro para o servidor...' });
    
    const data = new FormData();
    data.append('file', file);
    Object.keys(formData).forEach(key => {
      let val = formData[key];
      if (key === 'filipe_target' && (val === '' || isNaN(val))) {
        val = 0;
      }
      data.append(key, typeof val === 'string' ? val.trim() : val);
    });

    const wsUrl = `ws://localhost:8000/ws/progress/${encodeURIComponent(formData.id_ctr.trim())}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setStatus('processing');
      setProgress({ percent: 10, message: 'A processar dados no servidor...' });
    };

    ws.onmessage = (event) => {
      const msgData = JSON.parse(event.data);
      setProgress({ percent: msgData.progress, message: msgData.message });
      if (msgData.progress === 100 && msgData.message === 'Concluído!') {
        setStatus('completed');
        if (msgData.sheetId || msgData.folderId) {
          setGdriveData({ sheetId: msgData.sheetId || '', folderId: msgData.folderId || '' });
        }
        fetchSessions();
        ws.close();
      } else if (msgData.message.startsWith('Erro')) {
        setStatus('error');
        ws.close();
      }
    };

    ws.onerror = () => {
      console.warn("Falha no WebSocket de progresso em tempo real.");
    };

    wsRef.current = ws;
    startProcessing(data);
  };

  const downloadZip = () => {
    window.location.href = `http://localhost:8000/download/zip/${formData.id_ctr}`;
  };

  return (
    <div className="container animate-fade-in">
      <div className="flex-row items-center justify-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeView === 'upload' ? <><UploadCloud size={26} color="var(--primary)" /> Processador de CTR</> : <><HistoryIcon size={26} color="var(--primary)" /> Monitorização de Operações & Projetos</>}
          </h2>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            {activeView === 'upload' ? 'Carregue arquivos Excel para processamento, envio de WhatsApp e sincronização no Cloud.' : 'Inspecione sessões salvas, consulte relatórios no Google Drive e acompanhe o status dos envios.'}
          </p>
        </div>

        <div className="flex-row items-center gap-4" style={{ flexWrap: 'wrap' }}>
          {/* Toggle Switch Buttons */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
          }}>
            <button
              type="button"
              onClick={() => setActiveView('upload')}
              style={{
                background: activeView === 'upload' ? 'var(--primary)' : 'transparent',
                color: activeView === 'upload' ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: activeView === 'upload' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UploadCloud size={16} /> Processar CTR
            </button>
            <button
              type="button"
              onClick={() => { setActiveView('monitor'); fetchSessions(); }}
              style={{
                background: activeView === 'monitor' ? 'var(--primary)' : 'transparent',
                color: activeView === 'monitor' ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: activeView === 'monitor' ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <HistoryIcon size={16} /> Monitorizar Operações
            </button>
          </div>

          <div className="flex-row items-center gap-2" style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
            <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '600' }}>API Online</span>
          </div>
        </div>
      </div>

      {activeView === 'upload' ? (
        <div className="animate-fade-in">
          <div className="flex-row gap-6" style={{ flexWrap: 'wrap' }}>
            <div className="glass-panel" style={{ flex: '1', minWidth: '300px' }}>
              <h3 style={{ marginBottom: '24px' }}>Ficheiro Excel</h3>
          
          <div 
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls" />
            <UploadCloud size={48} color="var(--primary)" style={{ margin: '0 auto 16px auto' }} />
            {file ? (
              <div>
                <p style={{ fontWeight: '500' }}>{file.name}</p>
                <p className="text-muted" style={{ fontSize: '12px' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: '500' }}>Arraste o ficheiro ou clique para selecionar</p>
                <p className="text-muted" style={{ fontSize: '14px', marginTop: '8px' }}>Formatos suportados: .xlsx, .xls</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ flex: '2', minWidth: '350px' }}>
          <h3 style={{ marginBottom: '24px' }}>Parâmetros da Remessa</h3>
          <form onSubmit={handleSubmit} className="flex-col gap-4">
            <div className="flex-row gap-4">
              <div style={{ width: '125px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>CTR</label>
                <input type="text" className="glass-input" value={formData.id_ctr} onChange={e => setFormData({...formData, id_ctr: e.target.value})} required placeholder="Ex: 597" style={{ width: '125px' }} />
              </div>
              <div style={{ width: '125px', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Origem</label>
                <div 
                  className="input-wrapper" 
                  style={{ width: '125px', cursor: 'pointer', justifyContent: 'space-between', padding: '8px 12px' }}
                  onClick={() => setIsOriginOpen(!isOriginOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} color="var(--primary)" />
                    <span style={{ fontSize: '14px' }}>{formData.origin_sel}</span>
                  </div>
                  <ChevronDown size={16} color="var(--text-muted)" />
                </div>
                {isOriginOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
                    background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    {['CHINA', 'DUBAI'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.origin_sel === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.origin_sel === opt ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                        onClick={() => { setFormData({...formData, origin_sel: opt}); setIsOriginOpen(false); }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ width: '125px', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Destino</label>
                <div 
                  className="input-wrapper" 
                  style={{ width: '125px', cursor: 'pointer', justifyContent: 'space-between', padding: '8px 12px' }}
                  onClick={() => setIsDestOpen(!isDestOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={18} color="var(--primary)" />
                    <span style={{ fontSize: '14px' }}>{formData.dest_sel}</span>
                  </div>
                  <ChevronDown size={16} color="var(--text-muted)" />
                </div>
                {isDestOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
                    background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    {['MAPUTO', 'NACALA'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.dest_sel === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.dest_sel === opt ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                        onClick={() => { setFormData({...formData, dest_sel: opt}); setIsDestOpen(false); }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'transparent', userSelect: 'none' }}>-</label>
                <div 
                  className="input-wrapper" 
                  style={{ cursor: 'pointer', padding: '8px 12px', background: formData.send_whatsapp ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)', borderColor: formData.send_whatsapp ? 'var(--success)' : 'var(--border-color)', transition: 'all 0.2s', width: '125px' }}
                  onClick={() => setFormData({...formData, send_whatsapp: !formData.send_whatsapp})}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.send_whatsapp} 
                      onChange={e => setFormData({...formData, send_whatsapp: e.target.checked})} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--success)' }} 
                      onClick={e => e.stopPropagation()}
                    />
                    <span style={{ fontSize: '14px', color: formData.send_whatsapp ? 'var(--success)' : 'var(--text-main)', fontWeight: formData.send_whatsapp ? '500' : '400' }}>WhatsApp</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-row" style={{ gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ width: '125px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Loading</label>
                <div className="input-wrapper" style={{ width: '125px', padding: '4px 8px' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <DatePicker 
                    className="transparent-input" 
                    selected={formData.loading_date ? new Date(formData.loading_date + 'T12:00:00') : null} 
                    onChange={date => setFormData({...formData, loading_date: date ? date.toISOString().split('T')[0] : ''})} 
                    dateFormat="dd/MM/yyyy"
                    required 
                  />
                </div>
              </div>
              <div style={{ width: '125px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Chegada</label>
                <div className="input-wrapper" style={{ width: '125px', padding: '4px 8px' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <DatePicker 
                    className="transparent-input" 
                    selected={formData.expected_date ? new Date(formData.expected_date + 'T12:00:00') : null} 
                    onChange={date => setFormData({...formData, expected_date: date ? date.toISOString().split('T')[0] : ''})} 
                    dateFormat="dd/MM/yyyy"
                    required 
                  />
                </div>
              </div>
              <div style={{ width: '125px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Limite</label>
                <div className="input-wrapper" style={{ width: '125px', padding: '4px 8px' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <DatePicker 
                    className="transparent-input" 
                    selected={formData.payment_deadline ? new Date(formData.payment_deadline + 'T12:00:00') : null} 
                    onChange={date => setFormData({...formData, payment_deadline: date ? date.toISOString().split('T')[0] : ''})} 
                    dateFormat="dd/MM/yyyy"
                  />
                </div>
              </div>
            </div>

            <div className="flex-row gap-4">
              <div style={{ width: '150px', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Distribuição</label>
                <div 
                  className="input-wrapper" 
                  style={{ width: '150px', cursor: 'pointer', justifyContent: 'space-between', padding: '8px 12px' }}
                  onClick={() => setIsDistModeOpen(!isDistModeOpen)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Navigation size={18} color="var(--primary)" />
                    <span style={{ fontSize: '14px' }}>{formData.dist_mode}</span>
                  </div>
                  <ChevronDown size={16} color="var(--text-muted)" />
                </div>
                {isDistModeOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
                    background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    {['Padrão', 'FILIPE', 'JUPITER', 'Meta FILIPE'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.dist_mode === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.dist_mode === opt ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                        onClick={() => { setFormData({...formData, dist_mode: opt}); setIsDistModeOpen(false); }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {formData.dist_mode === 'Meta FILIPE' && (
                <div style={{ width: '150px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Valor</label>
                  <input type="number" step="10000" className="glass-input" value={formData.filipe_target} onChange={e => setFormData({...formData, filipe_target: e.target.value})} style={{ width: '150px' }} />
                </div>
              )}
            </div>

            <hr style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', margin: '8px 0' }} />

            <div className="flex-row items-center justify-between mt-4">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={status === 'uploading' || status === 'processing'}
                style={{ opacity: (status === 'uploading' || status === 'processing') ? 0.6 : 1, cursor: 'pointer' }}
              >
                {status === 'idle' ? 'Iniciar Processamento' : status === 'uploading' ? 'A enviar ficheiro...' : status === 'processing' ? 'A processar em background...' : 'Iniciar Novo Processamento'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {status !== 'idle' && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '24px' }}>
          <div className="flex-row justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="flex-row items-center gap-2">
              {status === 'completed' ? <CheckCircle2 color="var(--success)" /> : status === 'error' ? <AlertCircle color="var(--danger)" /> : <div className="spinner"></div>}
              <h3>{status === 'uploading' ? 'A carregar ficheiro...' : status === 'processing' ? 'A processar em Background' : status === 'completed' ? 'Processamento Concluído' : 'Ocorreu um Erro'}</h3>
            </div>
            <div className="flex-row items-center gap-4">
              {status === 'completed' && (
                <button onClick={downloadZip} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DownloadCloud size={16} /> Baixar ZIP
                </button>
              )}
              <span style={{ fontSize: '18px', fontWeight: '600', color: status === 'error' ? 'var(--danger)' : 'var(--primary)' }}>{progress.percent}%</span>
            </div>
          </div>
          
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress.percent}%`, background: status === 'error' ? 'var(--danger)' : status === 'completed' ? 'var(--success)' : 'var(--primary)' }}></div>
          </div>
          <p className="text-muted" style={{ marginTop: '12px', fontSize: '14px' }}>{progress.message}</p>

          {status === 'completed' && (gdriveData.sheetId || gdriveData.folderId) && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <h4 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                <CheckCircle2 size={18} /> Sincronizado com Google Drive:
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {gdriveData.sheetId && (
                  <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <FileText size={22} color="#10B981" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Planilha (Lista_{formData.id_ctr}):</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveData.sheetId}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(gdriveData.sheetId); setCopiedField('sheet'); setTimeout(() => setCopiedField(''), 2000); }}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Copiar SheetID"
                      >
                        {copiedField === 'sheet' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} Copiar ID
                      </button>
                      <a 
                        href={`https://docs.google.com/spreadsheets/d/${gdriveData.sheetId}`} 
                        target="_blank" rel="noreferrer"
                        style={{ background: 'var(--primary)', textDecoration: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                      >
                        <ExternalLink size={14} /> Abrir
                      </a>
                    </div>
                  </div>
                )}
                {gdriveData.folderId && (
                  <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <Folder size={22} color="#F59E0B" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Pasta (PAGAMENTOS):</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveData.folderId}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(gdriveData.folderId); setCopiedField('folder'); setTimeout(() => setCopiedField(''), 2000); }}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Copiar FolderID"
                      >
                        {copiedField === 'folder' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} Copiar ID
                      </button>
                      <a 
                        href={`https://drive.google.com/drive/folders/${gdriveData.folderId}`} 
                        target="_blank" rel="noreferrer"
                        style={{ background: 'var(--primary)', textDecoration: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                      >
                        <ExternalLink size={14} /> Abrir
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      ) : (
      <div className="animate-fade-in">
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HistoryIcon size={20} color="var(--primary)" /> Monitorização & Inspeção Detalhada de Projetos
          </h4>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: '500' }}>Selecione um projeto salvo para detalhar todas as mensagens, aceder a links no Cloud e gerir relatórios:</label>
          <div style={{ position: 'relative', maxWidth: '450px' }}>
            <div 
              className="input-wrapper" 
              style={{ cursor: 'pointer', justifyContent: 'space-between', padding: '10px 14px' }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <List size={18} color="var(--primary)" />
                <span style={{ fontSize: '14px', fontWeight: selectedSession ? '600' : '400', color: selectedSession ? 'white' : 'var(--text-main)' }}>
                  {selectedSession ? `${selectedSession} (Atualizado a ${sessions.find(s => s.id_ctr === selectedSession)?.updated_at || '...'})` : '-- Escolha uma sessão processada --'}
                </span>
              </div>
              <ChevronDown size={16} color="var(--text-muted)" />
            </div>
            
            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '4px',
                background: 'rgba(15, 23, 42, 0.98)', border: '1px solid var(--border-color)',
                borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)', maxHeight: '300px', overflowY: 'auto'
              }}>
                <div 
                  className="dropdown-item"
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', color: !selectedSession ? 'var(--primary)' : 'var(--text-main)', background: !selectedSession ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                  onClick={() => { loadSessionHistory({target: {value: ''}}); setIsDropdownOpen(false); }}
                >
                  -- Escolha uma sessão processada --
                </div>
                {sessions.map(s => (
                  <div key={s.id_ctr} className="dropdown-item"
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', color: selectedSession === s.id_ctr ? 'var(--primary)' : 'var(--text-main)', background: selectedSession === s.id_ctr ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                    onClick={() => { loadSessionHistory({target: {value: s.id_ctr}}); setIsDropdownOpen(false); }}
                  >
                    <strong style={{ color: 'white' }}>{s.id_ctr}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>(Atualizado a {s.updated_at})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex-col items-center justify-center py-8">
            <div className="spinner"></div>
            <p className="mt-4 text-muted">A carregar dados do projeto...</p>
          </div>
        ) : selectedSession && historyData.length > 0 ? (
          <div className="animate-fade-in">
            {/* Project Metrics Summary */}
            <div className="flex-row gap-4" style={{ marginBottom: '24px' }}>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <p className="text-muted text-sm">Total de Mensagens</p>
                <h2 style={{ fontSize: '32px', margin: '8px 0 0 0' }}>{summary.total}</h2>
              </div>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <p className="text-muted text-sm" style={{ color: 'var(--success)' }}>Enviadas com Sucesso</p>
                <h2 style={{ fontSize: '32px', margin: '8px 0 0 0', color: 'var(--success)' }}>{summary.success}</h2>
              </div>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <p className="text-muted text-sm" style={{ color: 'var(--danger)' }}>Erros</p>
                <h2 style={{ fontSize: '32px', margin: '8px 0 0 0', color: 'var(--danger)' }}>{summary.error}</h2>
              </div>
            </div>

            {(gdriveInfo.sheetId || gdriveInfo.folderId) && (
              <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', padding: '20px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                  <CheckCircle2 size={18} /> Arquivo e Planilha Sincronizados com o Google Drive:
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {gdriveInfo.sheetId && (
                    <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <FileText size={22} color="#10B981" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Planilha (Lista_{selectedSession}):</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveInfo.sheetId}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button 
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(gdriveInfo.sheetId); setCopiedField('sheet'); setTimeout(() => setCopiedField(''), 2000); }}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Copiar SheetID"
                        >
                          {copiedField === 'sheet' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} Copiar ID
                        </button>
                        <a 
                          href={`https://docs.google.com/spreadsheets/d/${gdriveInfo.sheetId}`} 
                          target="_blank" rel="noreferrer"
                          style={{ background: 'var(--primary)', textDecoration: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                        >
                          <ExternalLink size={14} /> Abrir
                        </a>
                      </div>
                    </div>
                  )}
                  {gdriveInfo.folderId && (
                    <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <Folder size={22} color="#F59E0B" style={{ flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Pasta (PAGAMENTOS):</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveInfo.folderId}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button 
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(gdriveInfo.folderId); setCopiedField('folder'); setTimeout(() => setCopiedField(''), 2000); }}
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Copiar FolderID"
                        >
                          {copiedField === 'folder' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />} Copiar ID
                        </button>
                        <a 
                          href={`https://drive.google.com/drive/folders/${gdriveInfo.folderId}`} 
                          target="_blank" rel="noreferrer"
                          style={{ background: 'var(--primary)', textDecoration: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}
                        >
                          <ExternalLink size={14} /> Abrir
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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

            <div className="flex-row gap-4" style={{ flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={() => window.location.href = `http://localhost:8000/download/csv/${selectedSession}`}
                className="btn btn-primary" 
                style={{ flex: 1, minWidth: '200px', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px' }}
              >
                <Database size={18} /> Baixar Relatório (CSV)
              </button>
              <button 
                type="button"
                onClick={() => window.location.href = `http://localhost:8000/download/zip/${selectedSession}`}
                className="btn" 
                style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px' }}
              >
                <DownloadCloud size={18} /> Baixar ZIP ({selectedSession}.zip)
              </button>
              <button 
                type="button"
                onClick={deleteSession}
                className="btn" 
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.5)', display: 'flex', justifyContent: 'center', gap: '8px', padding: '12px' }}
              >
                <Trash2 size={18} /> Apagar Sessão
              </button>
            </div>
          </div>
        ) : selectedSession && historyData.length === 0 ? (
          <div className="glass-panel text-center py-8">
            <p className="text-muted">Este projeto não possui registos gravados.</p>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
