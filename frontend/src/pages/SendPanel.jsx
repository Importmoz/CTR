import { useState, useEffect, useMemo } from 'react';
import { Play, Calendar, Clock, DollarSign, Send, ChevronDown, List, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { setHours, setMinutes } from 'date-fns';
import { API_BASE } from '../config/api';

export default function SendPanel() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendMode, setSendMode] = useState('normal');
  const [isModeOpen, setIsModeOpen] = useState(false);
  const [sendingJobs, setSendingJobs] = useState([]);

  const [levantamentoData, setLevantamentoData] = useState({
    data_disp: new Date(),
    time_start: setHours(setMinutes(new Date(), 0), 9),
    time_end: setHours(setMinutes(new Date(), 0), 15),
    valor_taxa_disp: ''
  });

  const [isSending, setIsSending] = useState(false);
  const [retryingIndex, setRetryingIndex] = useState(null);

  useEffect(() => {
    fetchSessions();
    fetchSendingQueue();
    const interval = setInterval(fetchSendingQueue, 2500);
    return () => clearInterval(interval);
  }, []);

  // Guarda os dados de levantamento sempre que são alterados
  useEffect(() => {
    if (selectedSession) {
      localStorage.setItem(`levantamento_${selectedSession}`, JSON.stringify(levantamentoData));
    }
  }, [selectedSession, levantamentoData]);

  const fetchSendingQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/send-queue/status`);
      if (res.ok) {
        const data = await res.json();
        setSendingJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Erro ao buscar fila de envios:", err);
    }
  };

  const removeSendingJob = async (jobId) => {
    try {
      await fetch(`${API_BASE}/send-queue/remove/${jobId}`, { method: 'POST' });
      fetchSendingQueue();
    } catch (err) { console.error(err); }
  };

  const clearCompletedSendJobs = async () => {
    try {
      await fetch(`${API_BASE}/send-queue/clear-completed`, { method: 'POST' });
      fetchSendingQueue();
    } catch (err) { console.error(err); }
  };

  // GERA LISTA EXPLÍCITA DE HORÁRIOS PERMITIDOS
  // IMPORTANTE: Todos os Date objects para horas DEVEM usar new Date() como base.
  // react-datepicker v9 compara ano/mês/dia internamente.
  const selectedDate = levantamentoData.data_disp || new Date();
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
  const maxHour = isWeekend ? 12 : 17;

  // Gera a lista usando new Date() — NÃO selectedDate
  const allowedTimes = useMemo(() => {
    const times = [];
    for (let h = 8; h <= maxHour; h++) {
      times.push(setHours(setMinutes(new Date(), 0), h));
      if (h < maxHour) {
        times.push(setHours(setMinutes(new Date(), 30), h));
      }
    }
    return times;
  }, [maxHour]);

  // Auto-corrige horários se ficarem fora do permitido ao trocar o dia
  useEffect(() => {
    const checkOutOfBounds = (time) => {
      if (!time) return true;
      const h = time.getHours();
      return h < 8 || h > maxHour || (h === maxHour && time.getMinutes() > 0);
    };
    if (checkOutOfBounds(levantamentoData.time_start) || checkOutOfBounds(levantamentoData.time_end)) {
      setLevantamentoData(prev => ({
        ...prev,
        time_start: setHours(setMinutes(new Date(), 0), 9),
        time_end: setHours(setMinutes(new Date(), 0), isWeekend ? 12 : 15)
      }));
    }
  }, [selectedDate]);

  // Garante que selected usa new Date() como base (mesmo dia que includeTimes)
  const startTimeForPicker = useMemo(() => {
    return setHours(setMinutes(new Date(), levantamentoData.time_start?.getMinutes() ?? 0), levantamentoData.time_start?.getHours() ?? 9);
  }, [levantamentoData.time_start]);

  const endTimeForPicker = useMemo(() => {
    return setHours(setMinutes(new Date(), levantamentoData.time_end?.getMinutes() ?? 0), levantamentoData.time_end?.getHours() ?? 15);
  }, [levantamentoData.time_end]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSession = async (id_ctr, silent = false) => {
    if (!silent) setLoading(true);
    setSelectedSession(id_ctr);
    
    try {
      const saved = localStorage.getItem(`levantamento_${id_ctr}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLevantamentoData({
          data_disp: parsed.data_disp ? new Date(parsed.data_disp) : new Date(),
          time_start: parsed.time_start ? new Date(parsed.time_start) : setHours(setMinutes(new Date(), 0), 9),
          time_end: parsed.time_end ? new Date(parsed.time_end) : setHours(setMinutes(new Date(), 0), 15),
          valor_taxa_disp: parsed.valor_taxa_disp || ''
        });
      }
    } catch(e) {}

    try {
      const res = await fetch(`${API_BASE}/sessions/${id_ctr}`);
      const data = await res.json();
      if (data.success) {
        setQueue(data.queue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll for updates if a session is selected
  useEffect(() => {
    if (!selectedSession) return;
    const interval = setInterval(() => {
      loadSession(selectedSession, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedSession]);

  const handleStartSend = async () => {
    if (!selectedSession) return;
    if (sendMode === 'levantamento' && (!levantamentoData.data_disp ||!levantamentoData.time_start ||!levantamentoData.time_end ||!levantamentoData.valor_taxa_disp)) {
      alert("Para o modo Levantamento, preencha a Data, Horário e Valor da Taxa.");
      return;
    }
    setIsSending(true);
    const formData = new FormData();
    formData.append('id_ctr', selectedSession);
    formData.append('send_mode', sendMode);
    if (sendMode === 'levantamento') {
      const formattedDate = levantamentoData.data_disp.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric' });
      const finalDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      const formatTime = (dateObj) => {
        if (!dateObj ||!(dateObj instanceof Date)) return '00:00';
        return dateObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      };
      const horario_disp = `${formatTime(levantamentoData.time_start)} - ${formatTime(levantamentoData.time_end)}`;
      formData.append('data_disp', finalDate);
      formData.append('horario_disp', horario_disp);
      formData.append('valor_taxa_disp', levantamentoData.valor_taxa_disp);
    }
    try {
      const res = await fetch(`${API_BASE}/send-queue/add`, { method: 'POST', body: formData });
      if (res.ok) {
        alert("✅ Sessão adicionada à Fila de Envio do WhatsApp!\nO sistema processará os CTRs em ordem na fila.");
        fetchSendingQueue();
      } else {
        alert("Erro ao adicionar envio à fila.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryItem = async (index) => {
    if (!selectedSession) return;
    if (sendMode === 'levantamento' && (!levantamentoData.data_disp || !levantamentoData.time_start || !levantamentoData.time_end || !levantamentoData.valor_taxa_disp)) {
      alert("Para o modo Levantamento, preencha a Data, Horário e Valor da Taxa.");
      return;
    }
    setRetryingIndex(index);
    const formData = new FormData();
    formData.append('id_ctr', selectedSession);
    formData.append('index', index);
    formData.append('send_mode', sendMode);
    if (sendMode === 'levantamento') {
      const formattedDate = levantamentoData.data_disp.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric' });
      const finalDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      const formatTime = (dateObj) => {
        if (!dateObj || !(dateObj instanceof Date)) return '00:00';
        return dateObj.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
      };
      const horario_disp = `${formatTime(levantamentoData.time_start)} - ${formatTime(levantamentoData.time_end)}`;
      formData.append('data_disp', finalDate);
      formData.append('horario_disp', horario_disp);
      formData.append('valor_taxa_disp', levantamentoData.valor_taxa_disp);
    }
    try {
      const res = await fetch(`${API_BASE}/send/retry-item`, { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("✅ Mensagem reenviada com sucesso!");
      } else {
        alert(`❌ Erro no reenvio: ${data.detail || data.error || 'Falha ao re-enviar'}`);
      }
      loadSession(selectedSession, true);
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação com o servidor ao reenviar.");
    } finally {
      setRetryingIndex(null);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <h2 style={{ flexShrink: 0 }}>Painel de Envio</h2>
      <p className="text-muted" style={{ marginBottom: '24px', flexShrink: 0 }}>Controle os envios de WhatsApp para a sua remessa.</p>

      <div className="flex-row gap-6" style={{ flex: 1, overflow: 'hidden' }}>
        <div className="glass-panel" style={{ flex: '1', minWidth: '250px', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 'fit-content', maxHeight: '100%' }}>
          <h3 style={{ flexShrink: 0 }}>Sessões Gravadas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 50px)', alignContent: 'start', gap: '8px', marginTop: '16px', overflowY: 'auto' }}>
            {sessions.length === 0? (
              <p className="text-muted text-sm">Sem sessões ativas.</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s.id_ctr}
                  onClick={() => loadSession(s.id_ctr)}
                  className={`btn ${selectedSession === s.id_ctr? 'btn-primary' : ''}`}
                  style={{ width: '50px', padding: '8px 4px', justifyContent: 'center', background: selectedSession === s.id_ctr? '' : 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}
                >
                  {s.id_ctr}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ flex: '3', minWidth: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 'fit-content', maxHeight: '100%' }}>
          {loading? (
            <div className="flex-col items-center justify-center py-8" style={{ flex: 1 }}>
              <div className="spinner"></div>
              <p className="mt-4 text-muted">A carregar...</p>
            </div>
          ) : queue.length > 0? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="flex-row justify-between items-center flex-wrap gap-4" style={{ marginBottom: '24px' }}>
                <h3>Mensagens ({queue.length})</h3>
                <div className="flex-row gap-4 items-center">
                  <div className="flex-row items-center gap-2">

                    <div style={{ position: 'relative' }}>
                      <div 
                        className="input-wrapper" 
                        style={{ width: '160px', cursor: 'pointer', justifyContent: 'space-between', padding: '8px 12px' }}
                        onClick={() => setIsModeOpen(!isModeOpen)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Send size={18} color="var(--primary)" />
                          <span style={{ fontSize: '14px' }}>{sendMode === 'normal' ? 'Normal' : 'Levantamento'}</span>
                        </div>
                        <ChevronDown size={16} color="var(--text-muted)" />
                      </div>
                      
                      {isModeOpen && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          width: '100%',
                          marginTop: '4px',
                          background: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          zIndex: 50,
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                          <div 
                            className="dropdown-item"
                            style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: sendMode === 'normal' ? 'var(--primary)' : 'var(--text-main)', background: sendMode === 'normal' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                            onClick={() => { setSendMode('normal'); setIsModeOpen(false); }}
                          >
                            Normal
                          </div>
                          <div 
                            className="dropdown-item"
                            style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: sendMode === 'levantamento' ? 'var(--primary)' : 'var(--text-main)', background: sendMode === 'levantamento' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                            onClick={() => { setSendMode('levantamento'); setIsModeOpen(false); }}
                          >
                            Levantamento
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {queue.some(it => (sendMode === 'levantamento' ? it.status_levantamento : it.status)?.includes('Erro')) && (
                    <button onClick={handleStartSend} disabled={isSending} className="btn" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#F87171', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer' }} title="Adicionar de volta à fila para re-tentar o envio a todos os que falharam">
                      <RefreshCw size={16} /> Reenviar Falhados à Fila
                    </button>
                  )}
                  <button onClick={handleStartSend} disabled={isSending} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <Play size={16} /> {isSending? 'A agendar...' : '+ Adicionar à Fila de Envio'}
                  </button>
                </div>
              </div>

              {sendMode === 'levantamento' && (
                <div className="flex-row gap-4 mb-6 animate-fade-in" style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', position: 'relative', zIndex: 10, alignItems: 'flex-end' }}>
                  <div style={{ width: '125px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Data da Entrega</label>
                    <div className="input-wrapper">
                      <Calendar size={18} color="var(--primary)" />
                      <DatePicker
                        selected={levantamentoData.data_disp}
                        onChange={(date) => setLevantamentoData({...levantamentoData, data_disp: date})}
                        className="transparent-input"
                        dateFormat="dd/MM/yyyy"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Horário de Atendimento</label>
                    <div className="flex-row items-center gap-2">
                      <div className="input-wrapper" style={{ width: '100px' }}>
                        <Clock size={18} color="var(--primary)" />
                        <DatePicker
                          selected={startTimeForPicker}
                          onChange={(date) => setLevantamentoData({...levantamentoData, time_start: date})}
                          showTimeSelect
                          showTimeSelectOnly
                          timeIntervals={30}
                          timeCaption="Início"
                          timeFormat="HH:mm"
                          dateFormat="HH:mm"
                          className="transparent-input"
                        />
                      </div>
                      <span className="text-muted" style={{ fontSize: '14px' }}>até</span>
                      <div className="input-wrapper" style={{ width: '100px' }}>
                        <Clock size={18} color="var(--primary)" />
                        <DatePicker
                          selected={endTimeForPicker}
                          onChange={(date) => setLevantamentoData({...levantamentoData, time_end: date})}
                          showTimeSelect
                          showTimeSelectOnly
                          timeIntervals={30}
                          timeCaption="Fim"
                          timeFormat="HH:mm"
                          dateFormat="HH:mm"
                          className="transparent-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ width: '125px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>Valor da Taxa</label>
                    <div className="input-wrapper">
                      <DollarSign size={18} color="var(--primary)" />
                      <input 
                        type="text" 
                        placeholder="Ex: 5.000,00"
                        className="transparent-input"
                        value={levantamentoData.valor_taxa_disp}
                        onChange={(e) => setLevantamentoData({...levantamentoData, valor_taxa_disp: e.target.value})}
                      />
                    </div>
                  </div>

                </div>
              )}

              <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Código</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Nome</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Telefone</th>
                      <th style={{ padding: '6px 10px', fontWeight: '500' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item, idx) => {
                    const currentStatus = sendMode === 'levantamento' ? (item.status_levantamento || 'Pendente') : (item.status || 'Pendente');
                    const currentError = sendMode === 'levantamento' ? (item.error_levantamento || '') : (item.error || '');
                    return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '4px 10px' }}>{item.id_code}</td>
                      <td style={{ padding: '4px 10px' }}>{item.name}</td>
                      <td style={{ padding: '4px 10px' }}>{item.phone}</td>
                      <td style={{ padding: '4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: currentStatus === 'Pendente'? 'rgba(255,255,255,0.1)' : currentStatus.includes('Erro')? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: currentStatus === 'Pendente'? 'var(--text-main)' : currentStatus.includes('Erro')? 'var(--danger)' : 'var(--success)'
                        }}>
                          {currentStatus}
                          {currentError && <div style={{ fontSize: '10px', marginTop: '2px' }}>{currentError}</div>}
                        </span>
                        {currentStatus.includes('Erro') && (
                          <button
                            type="button"
                            onClick={() => handleRetryItem(idx)}
                            disabled={retryingIndex === idx || isSending}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              color: '#60A5FA',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title="Tentar re-enviar a mensagem apenas para esta pessoa agora"
                          >
                            <RefreshCw size={13} className={retryingIndex === idx ? 'spinner' : ''} />
                            {retryingIndex === idx ? 'A tentar...' : '🔄 Tentar Novamente'}
                          </button>
                        )}
                      </td>
                    </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-col items-center justify-center py-8">
              <p className="text-muted">Selecione uma sessão à esquerda para ver as mensagens ou adicioná-las à fila de envio.</p>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DE MONITORAMENTO DA FILA DE ENVIO WHATSAPP */}
      {sendingJobs.length > 0 && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '28px' }}>
          <div className="flex-row justify-between items-center" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <List size={22} color="var(--success)" />
              <h3 style={{ margin: 0, fontSize: '18px' }}>Fila de Disparo WhatsApp ({sendingJobs.length} em fila)</h3>
            </div>
            {sendingJobs.some(j => j.status === 'completed' || j.status === 'error') && (
              <button 
                type="button" 
                onClick={clearCompletedSendJobs}
                style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
              >
                Limpar Concluídos da Fila
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sendingJobs.map((job) => (
              <div key={job.job_id} style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: 'white', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '4px 12px', borderRadius: '8px' }}>
                      CTR {job.id_ctr}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Modo: {job.send_mode === 'normal' ? 'Envio Normal' : 'Notificação de Levantamento'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {job.status === 'queued' && (
                      <>
                        <span style={{ color: '#FBBF24', fontSize: '14px', fontWeight: '500' }}>⏳ Aguardando vez na fila...</span>
                        <button type="button" onClick={() => removeSendingJob(job.job_id)} style={{ background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer' }} title="Remover da Fila"><Trash2 size={18} /></button>
                      </>
                    )}
                    {job.status === 'processing' && (
                      <span style={{ color: '#3B82F6', fontSize: '14px', fontWeight: '600' }}>🔄 A Disparar Mensagens Agora...</span>
                    )}
                    {job.status === 'completed' && (
                      <span style={{ color: '#10B981', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={18} /> Envio Concluído!</span>
                    )}
                    {job.status === 'error' && (
                      <span style={{ color: '#F87171', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={18} /> Falhou</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}