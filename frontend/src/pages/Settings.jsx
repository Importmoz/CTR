import { useState, useEffect } from 'react';
import { Save, AlertTriangle, Key, MessageSquare, Building2 } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    whatchimp_api_token: '',
    whatchimp_phone_id: '',
    template_alerta_carga_pagar: '',
    template_alerta_carga_pago: '',
    template_notas_regras_pago: '',
    template_notas_regras_pagamento: '',
    template_banco_jupiter: '',
    template_banco_filipe: '',
    template_levantamento: '',
    template_levantamento_nota: '',
    bank_info_jupiter: '',
    bank_info_filipe: ''
  });
  const [resetCode, setResetCode] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // type: 'success' | 'error'
  const [editableFields, setEditableFields] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8000/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setStatusMsg({ text: 'Configurações guardadas com sucesso!', type: 'success' });
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
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
      const res = await fetch('http://localhost:8000/reset', {
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

  return (
    <div className="container animate-fade-in">
      <h2>⚙️ Configurações do Sistema</h2>
      <p className="text-muted" style={{ marginBottom: '32px' }}>Altere os parâmetros do sistema sem precisar de alterar o código.</p>

      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px',
          background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: statusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${statusMsg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`
        }}>
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="flex-col gap-6">
        <div className="glass-panel">
          <h3 className="flex-row items-center gap-2" style={{ marginBottom: '16px' }}><Key size={20} /> Chaves da API WhatsApp</h3>
          <div className="flex-col gap-4">
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>WhatChimp API Token</label>
              <input type="password" className="glass-input" value={settings.whatchimp_api_token} onChange={e => setSettings({...settings, whatchimp_api_token: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>WhatChimp Phone Number ID</label>
              <input type="text" className="glass-input" value={settings.whatchimp_phone_id} onChange={e => setSettings({...settings, whatchimp_phone_id: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <h3 className="flex-row items-center gap-2" style={{ marginBottom: '16px' }}><MessageSquare size={20} /> Templates do WhatsApp</h3>
          <div className="flex-row gap-4 flex-wrap">
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>alerta_carga_pagar</label>
              <input type="text" className="glass-input" value={settings.template_alerta_carga_pagar} onChange={e => setSettings({...settings, template_alerta_carga_pagar: e.target.value})} placeholder="409806" readOnly={!editableFields.alerta_carga_pagar} onDoubleClick={() => setEditableFields({...editableFields, alerta_carga_pagar: true})} onBlur={() => setEditableFields({...editableFields, alerta_carga_pagar: false})} style={{ cursor: editableFields.alerta_carga_pagar ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>alerta_carga_pago</label>
              <input type="text" className="glass-input" value={settings.template_alerta_carga_pago} onChange={e => setSettings({...settings, template_alerta_carga_pago: e.target.value})} placeholder="409807" readOnly={!editableFields.alerta_carga_pago} onDoubleClick={() => setEditableFields({...editableFields, alerta_carga_pago: true})} onBlur={() => setEditableFields({...editableFields, alerta_carga_pago: false})} style={{ cursor: editableFields.alerta_carga_pago ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>notas_regras_pago</label>
              <input type="text" className="glass-input" value={settings.template_notas_regras_pago} onChange={e => setSettings({...settings, template_notas_regras_pago: e.target.value})} placeholder="409400" readOnly={!editableFields.notas_regras_pago} onDoubleClick={() => setEditableFields({...editableFields, notas_regras_pago: true})} onBlur={() => setEditableFields({...editableFields, notas_regras_pago: false})} style={{ cursor: editableFields.notas_regras_pago ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>notas_regras_pagamento</label>
              <input type="text" className="glass-input" value={settings.template_notas_regras_pagamento} onChange={e => setSettings({...settings, template_notas_regras_pagamento: e.target.value})} placeholder="409373" readOnly={!editableFields.notas_regras_pagamento} onDoubleClick={() => setEditableFields({...editableFields, notas_regras_pagamento: true})} onBlur={() => setEditableFields({...editableFields, notas_regras_pagamento: false})} style={{ cursor: editableFields.notas_regras_pagamento ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>banco_jupiter</label>
              <input type="text" className="glass-input" value={settings.template_banco_jupiter} onChange={e => setSettings({...settings, template_banco_jupiter: e.target.value})} placeholder="409374" readOnly={!editableFields.banco_jupiter} onDoubleClick={() => setEditableFields({...editableFields, banco_jupiter: true})} onBlur={() => setEditableFields({...editableFields, banco_jupiter: false})} style={{ cursor: editableFields.banco_jupiter ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>banco_filipe</label>
              <input type="text" className="glass-input" value={settings.template_banco_filipe} onChange={e => setSettings({...settings, template_banco_filipe: e.target.value})} placeholder="409375" readOnly={!editableFields.banco_filipe} onDoubleClick={() => setEditableFields({...editableFields, banco_filipe: true})} onBlur={() => setEditableFields({...editableFields, banco_filipe: false})} style={{ cursor: editableFields.banco_filipe ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>levantamento</label>
              <input type="text" className="glass-input" value={settings.template_levantamento} onChange={e => setSettings({...settings, template_levantamento: e.target.value})} placeholder="412705" readOnly={!editableFields.levantamento} onDoubleClick={() => setEditableFields({...editableFields, levantamento: true})} onBlur={() => setEditableFields({...editableFields, levantamento: false})} style={{ cursor: editableFields.levantamento ? 'text' : 'pointer' }} />
            </div>
            <div style={{ flex: '1 1 45%' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>levantamento_nota</label>
              <input type="text" className="glass-input" value={settings.template_levantamento_nota} onChange={e => setSettings({...settings, template_levantamento_nota: e.target.value})} placeholder="412707" readOnly={!editableFields.levantamento_nota} onDoubleClick={() => setEditableFields({...editableFields, levantamento_nota: true})} onBlur={() => setEditableFields({...editableFields, levantamento_nota: false})} style={{ cursor: editableFields.levantamento_nota ? 'text' : 'pointer' }} />
            </div>
          </div>
        </div>


        <div>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={18} /> Salvar Todas as Configurações
          </button>
        </div>
      </form>

      <div className="glass-panel mt-6" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <h3 className="flex-row items-center gap-2" style={{ color: 'var(--danger)', marginBottom: '8px' }}><AlertTriangle size={20} /> Zona de Perigo (Reset do Sistema)</h3>
        <p className="text-muted" style={{ marginBottom: '16px' }}>Atenção! Esta ação vai apagar todo o histórico de envios, configurações guardadas, pastas geradas e logs.</p>
        
        <form onSubmit={handleReset} className="flex-row items-center gap-4">
          <input 
            type="password" 
            placeholder="Código de Autorização" 
            className="glass-input" 
            value={resetCode} 
            onChange={e => setResetCode(e.target.value)} 
            style={{ width: '250px' }}
          />
          <div className="flex-row items-center gap-2">
            <input type="checkbox" id="confirm_reset" checked={confirmReset} onChange={e => setConfirmReset(e.target.checked)} style={{ width: '16px', height: '16px' }} />
            <label htmlFor="confirm_reset" style={{ fontSize: '14px', cursor: 'pointer' }}>Tenho a certeza absoluta</label>
          </div>
          <button type="submit" className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
            🧨 RESET TOTAL
          </button>
        </form>
      </div>
    </div>
  );
}
