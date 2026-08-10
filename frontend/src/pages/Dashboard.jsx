import { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, DownloadCloud, Calendar, ChevronDown, MapPin, Navigation, ExternalLink, Copy, FileText, Folder, Check, Trash2, Database, History as HistoryIcon, List, MessageCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_BASE, WS_BASE, fetchApi } from '../config/api';
import { MessageStatusPill } from '../components/MessageStatusPill';

const formatLocalDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
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
  
  // Conversation Modal States
  const [showConversation, setShowConversation] = useState(false);
  const [currentConversation, setCurrentConversation] = useState([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationPhone, setConversationPhone] = useState('');

  const [summary, setSummary] = useState({ total: 0, success: 0, error: 0 });
  const [gdriveInfo, setGdriveInfo] = useState({ sheetId: '', folderId: '' });
  const [activeView, setActiveView] = useState('upload'); // 'upload' ou 'monitor'
  const [conversionQueue, setConversionQueue] = useState([]);
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    fetchSessions();
    fetchConversionQueue();
    const interval = setInterval(fetchConversionQueue, 2500);
    return () => {
        clearInterval(interval);
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const openConversation = async (phone) => {
    setConversationPhone(phone);
    setShowConversation(true);
    setConversationLoading(true);
    try {
      const res = await fetchApi(`${API_BASE}/whatsapp/conversation/${phone}?limit=50&offset=1`);
      const data = await res.json();
      if (data.success && data.data && data.data.status === "1") {
        setCurrentConversation(data.data.message || []);
      } else {
        setCurrentConversation([]);
      }
    } catch (e) {
      setCurrentConversation([]);
    } finally {
      setConversationLoading(false);
    }
  };

  // Auto-select latest session if none is selected
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      loadSessionHistory({ target: { value: sessions[0].id_ctr } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const fetchConversionQueue = async () => {
    try {
      const res = await fetchApi(`${API_BASE}/conversion-queue/status`);
      if (res.ok) {
        const data = await res.json();
        setConversionQueue(data.jobs || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const removeConversionJob = async (jobId) => {
    try {
      await fetchApi(`${API_BASE}/conversion-queue/remove/${jobId}`, { method: 'POST' });
      fetchConversionQueue();
    } catch (err) { console.error(err); }
  };

  const clearCompletedConversionJobs = async () => {
    try {
      await fetchApi(`${API_BASE}/conversion-queue/clear-completed`, { method: 'POST' });
      fetchConversionQueue();
    } catch (err) { console.error(err); }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetchApi(`${API_BASE}/sessions`);
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
      const res = await fetchApi(`${API_BASE}/sessions/${id_ctr}`);
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
    
    const confirmation = window.prompt(`Para apagar a sessão ${selectedSession}, por favor digite "APAGAR" para confirmar:`);
    if (confirmation !== "APAGAR") {
      alert("Ação cancelada. A palavra 'APAGAR' não foi introduzida corretamente.");
      return;
    }
    
    try {
      const res = await fetchApi(`${API_BASE}/sessions/${selectedSession}/delete`, { 
        method: 'POST'
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
      const res = await fetchApi(`${API_BASE}/upload`, {
        method: 'POST',
        body: data,
      });
      const result = await res.json();
      if (res.ok) {
        setStatus('idle');
        setFile(null);
        setFormData(prev => ({ ...prev, id_ctr: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchConversionQueue();
        fetchSessions();
        setShowUploadForm(false);
        alert(`✅ CTR adicionado à Fila de Conversão em background!`);
      } else {
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
    setProgress({ percent: 50, message: 'A enviar ficheiro para a Fila do servidor...' });
    
    const data = new FormData();
    data.append('file', file);
    Object.keys(formData).forEach(key => {
      let val = formData[key];
      if (key === 'filipe_target' && (val === '' || isNaN(val))) {
        val = 0;
      }
      data.append(key, typeof val === 'string' ? val.trim() : val);
    });

    startProcessing(data);
  };

  const downloadZip = () => {
    window.location.href = `${API_BASE}/download/zip/${formData.id_ctr}`;
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingBottom: 0 }}>
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
            background: 'var(--panel-bg-solid)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '4px',
            gap: '4px',
            boxShadow: '0 4px 12px var(--shadow-color)'
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


        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '40px', minHeight: 0, paddingRight: '8px', display: 'flex', flexDirection: 'column' }}>
      
      {activeView === 'upload' ? (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'flex-start' }}>
          {conversionQueue.length > 0 && (
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="btn"
                style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
              >
                {showUploadForm ? <><List size={16} /> Ver Fila ({conversionQueue.length})</> : <><UploadCloud size={16} /> Novo CTR</>}
              </button>
            </div>
          )}

          {(conversionQueue.length === 0 || showUploadForm) ? (
            <div className="flex-row gap-6 animate-fade-in" style={{ flexWrap: 'wrap', justifyContent: 'center', alignItems: 'stretch' }}>
            <div className="glass-panel" style={{ flex: '0 1 500px', width: '100%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '16px' }}>Ficheiro Excel</h3>
          
          <div 
            className="dropzone-area"
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '16px',
              textAlign: 'center',
              height: '100%',
              background: 'var(--glass-bg-hover)',
              transition: 'all 0.2s ease',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
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

        <div className="glass-panel" style={{ flex: '0 1 500px', width: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px' }}>Parâmetros da Remessa</h3>
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
                    background: 'var(--panel-bg-solid)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px var(--shadow-color)'
                  }}>
                    {['CHINA', 'DUBAI'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.origin_sel === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.origin_sel === opt ? 'var(--glass-bg-hover)' : 'transparent' }}
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
                    background: 'var(--panel-bg-solid)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px var(--shadow-color)'
                  }}>
                    {['MAPUTO', 'NACALA'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.dest_sel === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.dest_sel === opt ? 'var(--glass-bg-hover)' : 'transparent' }}
                        onClick={() => { setFormData({...formData, dest_sel: opt}); setIsDestOpen(false); }}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
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
                    onChange={date => setFormData({...formData, loading_date: formatLocalDate(date)})} 
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
                    onChange={date => setFormData({...formData, expected_date: formatLocalDate(date)})} 
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
                    onChange={date => setFormData({...formData, payment_deadline: formatLocalDate(date)})} 
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
                    background: 'var(--panel-bg-solid)', border: '1px solid var(--border-color)',
                    borderRadius: '12px', overflow: 'hidden', zIndex: 50,
                    boxShadow: '0 4px 6px -1px var(--shadow-color)'
                  }}>
                    {['Padrão', 'FILIPE', 'JUPITER', 'Meta FILIPE'].map(opt => (
                      <div key={opt} className="dropdown-item"
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: formData.dist_mode === opt ? 'var(--primary)' : 'var(--text-main)', background: formData.dist_mode === opt ? 'var(--glass-bg-hover)' : 'transparent' }}
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

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'transparent', userSelect: 'none' }}>-</label>
                <div 
                  className={`input-wrapper ${formData.send_whatsapp ? 'active' : ''}`}
                  style={{ cursor: 'pointer', padding: '8px 12px', background: formData.send_whatsapp ? 'var(--success-bg)' : 'var(--glass-bg-subtle)', borderColor: formData.send_whatsapp ? 'var(--success)' : 'var(--border-color)', transition: 'all 0.2s', width: '125px' }}
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

            <hr style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', margin: '8px 0' }} />

            <div className="flex-row items-center justify-between mt-4">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={status === 'uploading'}
                style={{ opacity: status === 'uploading' ? 0.6 : 1, cursor: 'pointer' }}
              >
                {status === 'uploading' ? 'A carregar na Fila...' : '+ Adicionar CTR à Fila e Processar'}
              </button>
            </div>
          </form>
        </div>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ marginTop: '0', maxWidth: '1024px', width: '100%', margin: '0 auto', padding: '24px 0' }}>
          <div className="flex-row justify-between items-center" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <List size={22} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>Fila de Conversão de Múltiplos CTRs ({conversionQueue.length})</h3>
            </div>
            {conversionQueue.some(j => j.status === 'completed' || j.status === 'error') && (
              <button 
                type="button" 
                onClick={clearCompletedConversionJobs}
                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
              >
                Limpar Concluídos da Fila
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {conversionQueue.map((job) => (
              <div key={job.job_id} style={{
                background: 'var(--glass-bg-subtle)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 6px -1px var(--shadow-color), 0 2px 4px -1px var(--shadow-color)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                {/* Left: CTR Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '150px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>
                    {job.id_ctr}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {job.params?.dest_sel || 'MAPUTO'}
                  </span>
                </div>

                {/* Middle: Progress and Message */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.message}</span>
                    {job.status === 'completed' && <span style={{ color: '#10B981', flexShrink: 0, marginLeft: '8px' }}>Sincronizado!</span>}
                  </div>
                  <div className="progress-container" style={{ height: '4px', margin: 0, background: 'var(--glass-bg-subtle)' }}>
                    <div className="progress-bar" style={{
                      width: `${job.progress || 0}%`,
                      background: job.status === 'error' ? '#EF4444' : job.status === 'completed' ? '#10B981' : 'var(--primary)'
                    }}></div>
                  </div>
                </div>

                {/* Right: Status / Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '100px', justifyContent: 'flex-end' }}>
                  {job.status === 'queued' && (
                    <>
                      <span style={{ color: '#FBBF24', fontSize: '12px', fontWeight: '500' }}>⏳ Na fila</span>
                      <button type="button" onClick={() => removeConversionJob(job.job_id)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: 0 }} title="Remover da Fila"><Trash2 size={16} /></button>
                    </>
                  )}
                  {job.status === 'processing' && (
                    <span style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: '600' }}>🔄 {job.progress}%</span>
                  )}
                  {job.status === 'completed' && (
                    <span style={{ color: '#10B981', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14} /> OK</span>
                  )}
                  {job.status === 'error' && (
                    <span style={{ color: '#F87171', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> Erro</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status !== 'idle' && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '24px' }}>
          <div className="flex-row justify-between items-center" style={{ marginBottom: '16px' }}>
            <div className="flex-row items-center gap-2">
              {status === 'completed' ? <CheckCircle2 color="var(--success)" /> : status === 'error' ? <AlertCircle color="var(--danger)" /> : <div className="spinner"></div>}
              <h3>{status === 'uploading' ? 'A carregar ficheiro...' : status === 'processing' ? 'A processar em Background' : status === 'completed' ? 'Processamento Concluído' : 'Ocorreu um Erro'}</h3>
            </div>
            <div className="flex-row items-center gap-4">
              {status === 'completed' && (
                <button onClick={downloadZip} className="btn" style={{ background: 'var(--glass-bg-hover)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <h4 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
                <CheckCircle2 size={18} /> Sincronizado com Google Drive:
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {gdriveData.sheetId && (
                  <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'var(--panel-bg-translucent)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <FileText size={22} color="#10B981" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Planilha (Lista_{formData.id_ctr}):</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveData.sheetId}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(gdriveData.sheetId); setCopiedField('sheet'); setTimeout(() => setCopiedField(''), 2000); }}
                        style={{ background: 'var(--glass-bg-hover)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                  <div style={{ flex: 1, minWidth: '280px', padding: '12px', background: 'var(--panel-bg-translucent)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <Folder size={22} color="#F59E0B" style={{ flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID da Pasta (PAGAMENTOS):</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gdriveData.folderId}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(gdriveData.folderId); setCopiedField('folder'); setTimeout(() => setCopiedField(''), 2000); }}
                        style={{ background: 'var(--glass-bg-hover)', border: 'none', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
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
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div 
              className="input-wrapper" 
              style={{ cursor: 'pointer', justifyContent: 'space-between', padding: '10px 14px', whiteSpace: 'nowrap' }}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title={selectedSession ? `Atualizado a ${sessions.find(s => s.id_ctr === selectedSession)?.updated_at || '...'}` : ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <List size={18} color="var(--primary)" />
                  <span style={{ fontSize: '14px', fontWeight: selectedSession ? '600' : '400', color: selectedSession ? 'var(--primary)' : 'var(--text-main)' }}>
                    {selectedSession ? selectedSession : (sessions.length > 0 ? 'A carregar...' : 'Nenhum projeto salvo')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ChevronDown size={16} color="var(--text-muted)" />
                </div>
              </div>
            </div>
            
            {isDropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, minWidth: '240px', marginTop: '4px',
                background: 'var(--panel-bg-solid)', border: '1px solid var(--border-color)',
                borderRadius: '12px', zIndex: 50, padding: '8px',
                boxShadow: '0 8px 24px var(--shadow-color)', maxHeight: '300px', overflowY: 'auto',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px'
              }}>
                {sessions.map(s => (
                  <div key={s.id_ctr} className="dropdown-item"
                    title={`Atualizado a ${s.updated_at}`}
                    style={{ padding: '8px', cursor: 'pointer', fontSize: '14px', color: selectedSession === s.id_ctr ? 'var(--primary)' : 'var(--text-main)', background: selectedSession === s.id_ctr ? 'rgba(59, 130, 246, 0.15)' : 'var(--glass-bg-subtle)', border: selectedSession === s.id_ctr ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
                    onClick={() => { loadSessionHistory({target: {value: s.id_ctr}}); setIsDropdownOpen(false); }}
                  >
                    <strong style={{ color: selectedSession === s.id_ctr ? 'var(--primary)' : 'var(--text-main)' }}>{s.id_ctr}</strong> 
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Novos Ícones de Métricas, Drive e Ações ao lado do Dropdown */}
          {!loadingHistory && selectedSession && historyData.length > 0 && (
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--panel-bg-translucent)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                 
                 {/* Métricas */}
                 <div style={{ display: 'flex', gap: '12px', marginRight: '4px', borderRight: '1px solid var(--glass-border)', paddingRight: '12px' }}>
                    <span title="Total de Mensagens" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-main)' }}><strong>{summary.total}</strong> Total</span>
                    <span title="Sucessos" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '13px' }}><CheckCircle2 size={16} /> <strong>{summary.success}</strong></span>
                    <span title="Erros" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', fontSize: '13px' }}><AlertCircle size={16} /> <strong>{summary.error}</strong></span>
                 </div>

                 {/* Google Drive Links */}
                 {gdriveInfo.sheetId && (
                     <a href={`https://docs.google.com/spreadsheets/d/${gdriveInfo.sheetId}`} target="_blank" rel="noreferrer" title="Abrir Planilha de Pagamentos no Drive" style={{ color: '#10B981', display: 'flex', alignItems: 'center', padding: '6px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', transition: '0.2s' }}>
                         <FileText size={16} />
                     </a>
                 )}
                 {gdriveInfo.folderId && (
                     <a href={`https://drive.google.com/drive/folders/${gdriveInfo.folderId}`} target="_blank" rel="noreferrer" title="Abrir Pasta do Contentor no Drive" style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', padding: '6px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', transition: '0.2s' }}>
                         <Folder size={16} />
                     </a>
                 )}

                 {(gdriveInfo.sheetId || gdriveInfo.folderId) && (
                     <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 4px' }}></div>
                 )}

                 {/* Action Buttons */}
                 <button onClick={() => window.location.href = `${API_BASE}/download/csv/${selectedSession}`} title="Baixar Relatório (CSV)" style={{ background: 'transparent', border: 'none', color: '#60A5FA', cursor: 'pointer', padding: '6px', display: 'flex', transition: '0.2s' }}>
                     <Database size={16} />
                 </button>
                 <button onClick={() => window.location.href = `${API_BASE}/download/zip/${selectedSession}`} title="Baixar ZIP Completo" style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '6px', display: 'flex', transition: '0.2s' }}>
                     <DownloadCloud size={16} />
                 </button>
                 <button onClick={deleteSession} title="Apagar Sessão e Links" style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', padding: '6px', display: 'flex', transition: '0.2s' }}>
                     <Trash2 size={16} />
                 </button>
             </div>
          )}
        </div>

        {loadingHistory ? (
          <div className="flex-col items-center justify-center py-8">
            <div className="spinner"></div>
            <p className="mt-4 text-muted">A carregar dados do projeto...</p>
          </div>
        ) : selectedSession && historyData.length > 0 ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* O Resumo Compacto anterior foi movido para ícones ao lado do dropdown! */}

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Código</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>ID Code</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Nome</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Telefone</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Normal</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Levantamento</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '4px 10px' }}>{item.list_code}</td>
                        <td style={{ padding: '4px 10px' }}>{item.id_code}</td>
                        <td style={{ padding: '4px 10px' }}>{item.name}</td>
                        <td style={{ padding: '4px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.phone}
                            {/* 
                            {item.phone && (
                              <button 
                                onClick={() => openConversation(item.phone)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}
                                title="Ver Conversa"
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <MessageCircle size={14} />
                              </button>
                            )}
                            */}
                          </div>
                        </td>
                        <td style={{ padding: '4px 10px' }}>
                          <MessageStatusPill status={item.status} wa_message_id={item.wa_message_id} />
                        </td>
                        <td style={{ padding: '4px 10px' }}>
                          <MessageStatusPill status={item.status_levantamento} wa_message_id={item.wa_message_id_levantamento} />
                        </td>
                        <td style={{ padding: '4px 10px', color: 'var(--danger)', fontSize: '11px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          </div>
        ) : selectedSession && historyData.length === 0 ? (
          <div className="glass-panel text-center py-8">
            <p className="text-muted">Este projeto não possui registos gravados.</p>
          </div>
        ) : null}
      </div>
      )}
      </div>

      {showConversation && (
        <div className="modal-overlay" onClick={() => setShowConversation(false)}>
          <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', height: '600px', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--panel-bg-solid)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                <MessageCircle size={18} color="var(--primary)" />
                Conversa: {conversationPhone}
              </h3>
              <button onClick={() => setShowConversation(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '16px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              {conversationLoading ? (
                <div className="flex-col items-center justify-center" style={{ height: '100%' }}>
                   <div className="spinner"></div>
                   <p className="mt-4 text-muted">A carregar mensagens...</p>
                </div>
              ) : currentConversation.length === 0 ? (
                <div className="flex-col items-center justify-center" style={{ height: '100%' }}>
                  <p className="text-muted">Nenhuma mensagem encontrada para este número.</p>
                </div>
              ) : (
                [...currentConversation].reverse().map((msg, i) => (
                  <div key={i} style={{ 
                    alignSelf: msg.sender === 'bot' ? 'flex-end' : 'flex-start',
                    background: msg.sender === 'bot' ? 'var(--primary)' : 'var(--glass-bg-active)',
                    color: msg.sender === 'bot' ? 'white' : 'var(--text-main)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    borderBottomRightRadius: msg.sender === 'bot' ? '4px' : '12px',
                    borderBottomLeftRadius: msg.sender === 'bot' ? '12px' : '4px',
                    maxWidth: '85%',
                    boxShadow: '0 2px 4px var(--shadow-color)'
                  }}>
                     <div style={{ fontSize: '14px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                       {(() => {
                          try {
                            const content = JSON.parse(msg.message_content);
                            
                            let textContent = null;
                            let imageContent = null;

                            const extractContent = (obj) => {
                              if (!obj) return;
                              if (obj.messages && obj.messages[0]) {
                                if (obj.messages[0].text) textContent = obj.messages[0].text.body;
                                if (obj.messages[0].image && obj.messages[0].image.url) imageContent = obj.messages[0].image.url;
                              }
                              if (obj.message_echoes && obj.message_echoes[0]) {
                                if (obj.message_echoes[0].text) textContent = obj.message_echoes[0].text.body;
                                if (obj.message_echoes[0].image && obj.message_echoes[0].image.url) imageContent = obj.message_echoes[0].image.url;
                              }
                              if (obj.entry) {
                                obj.entry.forEach(e => {
                                  if (e.changes) e.changes.forEach(c => {
                                     if (c.value) extractContent(c.value);
                                  });
                                });
                              }
                              if (obj.mime_type && obj.mime_type.startsWith('image/')) {
                                 if (obj.url) imageContent = obj.url;
                              }
                              if (obj.components && Array.isArray(obj.components)) {
                                obj.components.forEach(comp => {
                                  if (comp.type === 'body' && comp.text) textContent = comp.text;
                                  if (comp.type === 'header' && comp.format === 'image' && comp.link) imageContent = comp.link;
                                });
                              }
                            };

                            extractContent(content);

                            if (textContent || imageContent) {
                              return (
                                <>
                                  {imageContent && <div style={{ marginBottom: '8px' }}><img src={imageContent.replace(/\\\//g, '/')} alt="Anexo" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} /></div>}
                                  {textContent && <div>{textContent}</div>}
                                  {!textContent && imageContent && <div style={{ fontStyle: 'italic', opacity: 0.8 }}>[Anexo de Imagem]</div>}
                                </>
                              );
                            }

                            if (content.template) return `[Template: ${content.template.name}]`;
                            if (content.interactive) return `[Interativo] ${content.interactive.header?.text || ''}\n${content.interactive.body?.text || ''}`;
                            if (content.text) return content.text.body;
                            
                            // If we couldn't parse it beautifully, return raw JSON slightly smaller and faded
                            return <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '11px', opacity: 0.6, fontFamily: 'monospace' }}>{msg.message_content}</pre>;
                          } catch(e) {
                            return msg.message_content;
                          }
                       })()}
                     </div>
                     <div style={{ fontSize: '10px', marginTop: '6px', textAlign: 'right', opacity: 0.7 }}>
                       {msg.conversation_time} {msg.message_status ? `• ${msg.message_status}` : ''}
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
