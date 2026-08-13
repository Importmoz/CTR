import { useState, useEffect } from 'react';
import { Save, AlertTriangle, MessageSquare, Truck, BookOpen, Building2, Banknote, Edit3, CheckCircle, CreditCard, Calendar, User, Zap, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { API_BASE, fetchApi } from '../config/api';

export default function Settings() {
  const [settings, setSettings] = useState({
    template_alerta_carga_pagar: '',
    template_alerta_carga_pago: '',
    template_notas_regras_pago: '',
    template_notas_regras_pagamento: '',
    template_banco_jupiter: '',
    template_banco_filipe: '',
    template_levantamento: '',
    template_levantamento_nota: '',
    google_api_json: '',
  });
  const [resetCode, setResetCode] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [editableFields, setEditableFields] = useState({});
  const [subStatus, setSubStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('geral');
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchSubscription();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetchApi(`${API_BASE}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await fetchApi(`${API_BASE}/subscription/status`);
      if (res.ok) {
        const data = await res.json();
        setSubStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchApi(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setStatusMsg({ text: 'Configurações guardadas com sucesso!', type: 'success' });
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
      }
    } catch (err) {
      setStatusMsg({ text: 'Erro ao guardar configurações.', type: 'error' });
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetCode !== '792721' || !confirmReset) {
      setStatusMsg({ text: 'Código incorreto ou confirmação em falta.', type: 'error' });
      return;
    }

    try {
      const res = await fetchApi(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: resetCode, confirm: confirmReset })
      });
      if (res.ok) {
        setStatusMsg({ text: 'Limpeza profunda concluída! Pode recarregar a página.', type: 'success' });
        setResetCode('');
        setConfirmReset(false);
      } else {
        setStatusMsg({ text: 'Erro ao executar o reset.', type: 'error' });
      }
    } catch (err) {
      setStatusMsg({ text: 'Erro de comunicação.', type: 'error' });
    }
  };

  const renderInput = (key, label, placeholder) => (
    <div style={{ width: '100%' }}>
      <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <span>{label}</span>
        <Edit3 size={14} style={{ opacity: editableFields[key] ? 1 : 0.4 }} />
      </label>
      <div className={`input-wrapper ${editableFields[key] ? 'editing' : ''}`} style={{ transition: 'all 0.3s' }}>
        <input 
          type="text" 
          className="transparent-input" 
          value={settings[key] || ''} 
          onChange={e => setSettings({...settings, [key]: e.target.value})} 
          placeholder={placeholder} 
          readOnly={!editableFields[key]} 
          onDoubleClick={() => setEditableFields({...editableFields, [key]: true})} 
          onBlur={() => setEditableFields({...editableFields, [key]: false})} 
          style={{ cursor: editableFields[key] ? 'text' : 'pointer', fontSize: '14px', fontWeight: '500', padding: '10px 8px' }} 
        />
      </div>
    </div>
  );

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ background: 'linear-gradient(90deg, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '12px' }}>
            ⚙️ Configurações
          </h2>
          <p className="text-muted" style={{ marginTop: '4px' }}>Faça duplo-clique nos campos de template para os editar.</p>
        </div>
        
        <button onClick={handleSave} className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <Save size={18} /> Guardar Alterações
        </button>
      </div>

      {statusMsg.text && (
        <div className="animate-fade-in" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '24px',
          background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: statusMsg.type === 'success' ? '#34d399' : '#f87171',
          border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {statusMsg.type === 'success' ? <Save size={20} /> : <AlertTriangle size={20} />}
          <span style={{ fontWeight: '500' }}>{statusMsg.text}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'var(--glass-bg-subtle)', padding: '6px', borderRadius: '16px', border: '1px solid var(--glass-border)', overflowX: 'auto', flexShrink: 0, position: 'relative', zIndex: 10 }}>
        {[
          { id: 'geral', label: 'Geral', icon: <MessageSquare size={16} /> },
          { id: 'integracoes', label: 'Integrações', icon: <Save size={16} /> },
          { id: 'subscricao', label: 'Subscrição', icon: <CreditCard size={16} /> },
          { id: 'avancado', label: 'Avançado', icon: <SettingsIcon size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '500',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', transition: 'all 0.3s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', flex: 1, minHeight: 0, paddingBottom: '40px' }}>
        
        {/* Templates Section - Geral Tab */}
        {activeTab === 'geral' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <MessageSquare size={24} color="#60a5fa" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Templates do WhatsApp</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '13px', marginTop: '2px' }}>IDs de templates aprovados na plataforma WhatChimp.</p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px' }}>
            
            {/* Cargas */}
            <div style={{ background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Truck size={14} /> Cargas
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderInput('template_alerta_carga_pagar', 'Alerta a Pagar', '409806')}
                {renderInput('template_alerta_carga_pago', 'Alerta Pago', '409807')}
              </div>
            </div>

            {/* Regras */}
            <div style={{ background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <BookOpen size={14} /> Regras
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderInput('template_notas_regras_pagamento', 'Regras Pagamento', '409373')}
                {renderInput('template_notas_regras_pago', 'Regras Pago', '409400')}
              </div>
            </div>

            {/* Bancos */}
            <div style={{ background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Building2 size={14} /> Bancos
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderInput('template_banco_jupiter', 'Banco Jupiter', '409374')}
                {renderInput('template_banco_filipe', 'Banco Filipe', '409375')}
              </div>
            </div>

            {/* Levantamentos */}
            <div style={{ background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Banknote size={14} /> Levantamentos
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {renderInput('template_levantamento', 'Levantamento', '412705')}
                {renderInput('template_levantamento_nota', 'Levantamento Nota', '412707')}
              </div>
            </div>
            
          </div>
        </div>
        )}

        {/* Integração Google Drive - Integrações Tab */}
        {activeTab === 'integracoes' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <Save size={24} color="#34d399" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Integração Google Drive</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '13px', marginTop: '2px' }}>Credenciais para fazer upload automático das folhas de cálculo para a nuvem.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <span>Estado da Integração</span>
            </label>
            
            {settings.google_oauth_token ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <CheckCircle size={24} color="var(--success)" />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: 'var(--success)' }}>Conta Vinculada</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>O sistema está pronto para fazer upload para o Google Drive automaticamente.</p>
                </div>
                <button 
                  className="btn btn-outline" 
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                  onClick={async () => {
                    const res = await fetchApi(`${API_BASE}/google/auth-url`);
                    const data = await res.json();
                    if (data.success) {
                      if (data.code_verifier) {
                        localStorage.setItem('google_code_verifier', data.code_verifier);
                      }
                      window.location.href = data.url;
                    } else {
                      setStatusMsg({ text: data.message || 'Erro ao gerar URL.', type: 'error' });
                    }
                  }}
                >
                  Re-autenticar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-main)' }}>Ainda não autorizaste a aplicação a aceder ao teu Google Drive.</p>
                <button 
                  className="btn btn-primary" 
                  style={{ alignSelf: 'flex-start', minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={loadingGoogle}
                  onClick={async () => {
                    setLoadingGoogle(true);
                    setStatusMsg({ text: '', type: '' });
                    try {
                      const res = await fetchApi(`${API_BASE}/google/auth-url`);
                      const data = await res.json();
                      if (data.success && data.url) {
                        if (data.code_verifier) {
                          localStorage.setItem('google_code_verifier', data.code_verifier);
                        }
                        window.location.href = data.url;
                      } else {
                        setStatusMsg({ 
                          text: data.message || 'Erro ao comunicar com o Google. Certifica-te que as variáveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão configuradas no Coolify.', 
                          type: 'error' 
                        });
                      }
                    } catch (err) {
                      setStatusMsg({ text: 'Erro de comunicação ao obter URL de autenticação do Google.', type: 'error' });
                    } finally {
                      setLoadingGoogle(false);
                    }
                  }}
                >
                  {loadingGoogle ? <Loader2 size={16} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  {loadingGoogle ? 'A redirecionar...' : 'Iniciar Sessão no Google'}
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Informações da Subscrição - Subscricao Tab */}
        {activeTab === 'subscricao' && subStatus && subStatus.details && (
          <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              <div style={{ background: 'rgba(167, 139, 250, 0.2)', padding: '10px', borderRadius: '12px' }}>
                <CreditCard size={24} color="#a78bfa" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Dados da Subscrição</h3>
                <p className="text-muted" style={{ margin: 0, fontSize: '13px', marginTop: '2px' }}>Informações sobre o seu plano e licença ativos.</p>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '12px' }}>
                <Zap size={24} color="var(--primary)" opacity={0.7} />
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plano Atual</p>
                  <h4 style={{ margin: '4px 0 0 0', fontSize: '16px' }}>{subStatus?.details?.plan_name || 'Desconhecido'}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--success)' }}>
                    ${parseFloat(subStatus?.details?.price || 0).toFixed(2)} {subStatus?.details?.currency || 'USD'}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '12px' }}>
                <User size={24} color="var(--primary)" opacity={0.7} />
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Titular</p>
                  <h4 style={{ margin: '4px 0 0 0', fontSize: '16px' }}>{subStatus?.details?.customer_name || 'N/A'}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{subStatus?.details?.customer_email || 'N/A'}</p>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--glass-bg-subtle)', padding: '16px', borderRadius: '12px' }}>
                <Calendar size={24} color="var(--primary)" opacity={0.7} />
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Próxima Renovação</p>
                  <h4 style={{ margin: '4px 0 0 0', fontSize: '16px' }}>
                    {subStatus?.details?.current_period_end ? new Date(subStatus.details.current_period_end).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Status: <span style={{ color: subStatus?.is_active ? 'var(--success)' : 'var(--danger)' }}>{String(subStatus?.status || 'desconhecido').toUpperCase()}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone - Avancado Tab */}
        {activeTab === 'avancado' && (
          <div className="glass-panel animate-fade-in" style={{ 
            border: '1px solid rgba(239, 68, 68, 0.4)', 
            background: 'linear-gradient(135deg, var(--danger-bg) 0%, var(--bg-card) 100%)',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s'
          }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 12px 40px 0 var(--shadow-color)'; e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.6)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px 0 var(--shadow-color)'; e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.4)'; }}
        >
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', opacity: 0.05, transform: 'rotate(15deg)' }}>
            <AlertTriangle size={200} color="#ef4444" />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <AlertTriangle size={24} color="#f87171" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f87171' }}>Zona de Perigo</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '13px', marginTop: '2px' }}>Reset do sistema</p>
            </div>
          </div>
          
          <p style={{ color: 'var(--text-main)', marginBottom: '24px', lineHeight: '1.6', fontSize: '14px', maxWidth: '800px' }}>
            Atenção! Esta ação é destrutiva e irreversível. Vai apagar permanentemente todo o histórico de envios, 
            ficheiros processados gerados e limpar as opções do sistema.
          </p>
          
          <form onSubmit={handleReset} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'var(--panel-bg-translucent)', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
            <div className="input-wrapper" style={{ width: '250px', background: 'var(--panel-bg-translucent)' }}>
              <input 
                type="password" 
                placeholder="Código Autenticação" 
                className="transparent-input" 
                value={resetCode} 
                onChange={e => setResetCode(e.target.value)} 
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setConfirmReset(!confirmReset)}>
              <div style={{ 
                width: '20px', height: '20px', borderRadius: '6px', 
                border: `2px solid ${confirmReset ? '#ef4444' : '#64748b'}`, 
                background: confirmReset ? '#ef4444' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}>
                {confirmReset && <span style={{ color: 'white', fontSize: '14px', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '14px', color: confirmReset ? '#f8fafc' : '#94a3b8', transition: 'all 0.2s', fontWeight: confirmReset ? '500' : '400' }}>
                Tenho a certeza absoluta
              </span>
            </div>
            
            <button type="submit" className="btn" disabled={!resetCode || !confirmReset} style={{ 
              background: (!resetCode || !confirmReset) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.2)', 
              color: (!resetCode || !confirmReset) ? 'rgba(239, 68, 68, 0.4)' : '#f87171', 
              border: `1px solid ${(!resetCode || !confirmReset) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.6)'}`,
              marginLeft: 'auto',
              cursor: (!resetCode || !confirmReset) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s'
            }}>
              🧨 EXECUTAR LIMPEZA
            </button>
          </form>
        </div>
        )}
      </div>
    </div>
  );
}

