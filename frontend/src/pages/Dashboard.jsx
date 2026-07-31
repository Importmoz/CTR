import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, DownloadCloud, Calendar, ChevronDown, MapPin, Navigation } from 'lucide-react';
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
  const wsRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (!file || !formData.id_ctr) return;
    
    setStatus('uploading');
    
    const data = new FormData();
    data.append('file', file);
    Object.keys(formData).forEach(key => {
      let val = formData[key];
      if (key === 'filipe_target' && (val === '' || isNaN(val))) {
        val = 0;
      }
      data.append(key, val);
    });

    const ws = new WebSocket(`ws://localhost:8000/ws/progress/${formData.id_ctr}`);
    
    ws.onopen = () => {
      setStatus('processing');
      setProgress({ percent: 1, message: 'A enviar ficheiro e iniciar processamento...' });
      startProcessing(data);
    };

    ws.onmessage = (event) => {
      const msgData = JSON.parse(event.data);
      setProgress({ percent: msgData.progress, message: msgData.message });
      if (msgData.progress === 100 && msgData.message === 'Concluído!') {
        setStatus('completed');
        ws.close();
      } else if (msgData.message.startsWith('Erro')) {
        setStatus('error');
        ws.close();
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setProgress({ percent: 0, message: 'Erro ao ligar ao servidor de tempo real' });
    };

    wsRef.current = ws;
  };

  const downloadZip = () => {
    window.location.href = `http://localhost:8000/download/zip/${formData.id_ctr}`;
  };

  return (
    <div className="container animate-fade-in">
      <div className="flex-row items-center justify-between" style={{ marginBottom: '32px' }}>
        <h2>Processador de CTR</h2>
        <div className="flex-row items-center gap-2">
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }}></div>
          <span className="text-muted" style={{ fontSize: '14px' }}>API Online</span>
        </div>
      </div>

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
                disabled={!file || !formData.id_ctr || status === 'uploading' || status === 'processing'}
              >
                {status === 'idle' ? 'Iniciar' : status === 'uploading' ? 'A enviar...' : 'A processar...'}
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
        </div>
      )}
    </div>
  );
}
