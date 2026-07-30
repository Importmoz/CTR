import { useState, useEffect, useMemo } from 'react';
import { Play, Calendar, Clock, DollarSign, Send, ChevronDown } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { setHours, setMinutes } from 'date-fns';

export default function SendPanel() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendMode, setSendMode] = useState('normal');
  const [isModeOpen, setIsModeOpen] = useState(false);

  const [levantamentoData, setLevantamentoData] = useState({
    data_disp: new Date(),
    time_start: setHours(setMinutes(new Date(), 0), 9),
    time_end: setHours(setMinutes(new Date(), 0), 15),
    valor_taxa_disp: ''
  });

  const [isSending, setIsSending] = useState(false);

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

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:8000/sessions');
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
      const res = await fetch(`http://localhost:8000/sessions/${id_ctr}`);
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
      const res = await fetch('http://localhost:8000/send', { method: 'POST', body: formData });
      if (res.ok) {
        alert("Envio iniciado em background! Pode navegar ou recarregar a página para ver o progresso.");
      } else {
        alert("Erro ao iniciar envio.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container animate-fade-in">
      <h2>Painel de Envio</h2>
      <p className="text-muted" style={{ marginBottom: '24px' }}>Controle os envios de WhatsApp para a sua remessa.</p>

      <div className="flex-row gap-6">
        <div className="glass-panel" style={{ flex: '1', minWidth: '250px', alignSelf: 'flex-start' }}>
          <h3>Sessões Gravadas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 50px)', gap: '8px', marginTop: '16px' }}>
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

        <div className="glass-panel" style={{ flex: '3', minWidth: '400px' }}>
          {loading? (
            <div className="flex-col items-center justify-center py-8">
              <div className="spinner"></div>
              <p className="mt-4 text-muted">A carregar...</p>
            </div>
          ) : queue.length > 0? (
            <div>
              <div className="flex-row justify-between items-center flex-wrap gap-4" style={{ marginBottom: '24px' }}>
                <h3>Mensagens ({queue.length})</h3>
                <div className="flex-row gap-4 items-center">
                  <div className="flex-row items-center gap-2">

                    <div style={{ position: 'relative' }}>
                      <div 
                        className="input-wrapper" 
                        style={{ width: '130px', cursor: 'pointer', justifyContent: 'space-between', padding: '8px' }}
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
                  <button onClick={handleStartSend} disabled={isSending} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={16} /> {isSending? 'A iniciar...' : 'Iniciar Envio'}
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

              <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Código</th>
                      <th style={{ padding: '12px' }}>Nome</th>
                      <th style={{ padding: '12px' }}>Telefone</th>
                      <th style={{ padding: '12px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item, idx) => {
                    const currentStatus = sendMode === 'levantamento' ? (item.status_levantamento || 'Pendente') : (item.status || 'Pendente');
                    const currentError = sendMode === 'levantamento' ? (item.error_levantamento || '') : (item.error || '');
                    return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{item.id_code}</td>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px' }}>{item.phone}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: currentStatus === 'Pendente'? 'rgba(255,255,255,0.1)' : currentStatus.includes('Erro')? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: currentStatus === 'Pendente'? 'var(--text-main)' : currentStatus.includes('Erro')? 'var(--danger)' : 'var(--success)'
                        }}>
                          {currentStatus}
                          {currentError && <div style={{ fontSize: '10px', marginTop: '2px' }}>{currentError}</div>}
                        </span>
                      </td>
                    </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-col items-center justify-center py-8">
              <p className="text-muted">Selecione uma sessão à esquerda para ver as mensagens.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}