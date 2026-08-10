import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { API_BASE, fetchApi } from '../config/api';

export const MessageStatusPill = ({ status, wa_message_id, currentError }) => {
  const [realStatus, setRealStatus] = useState(status);
  
  useEffect(() => {
    if (status === 'Enviado' && wa_message_id) {
      fetchApi(`${API_BASE}/whatsapp/status/${wa_message_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data && data.data.message_status) {
            const st = data.data.message_status.toLowerCase();
            if (st === 'read') setRealStatus('Lido');
            else if (st === 'delivered') setRealStatus('Entregue');
            else if (st === 'failed') setRealStatus('Falhou');
            else if (st === 'sent') setRealStatus('Enviado');
          }
        })
        .catch(err => console.error("Status fetch error", err));
    } else {
      setRealStatus(status || 'Pendente');
    }
  }, [status, wa_message_id]);

  let bg = 'var(--glass-bg-active)';
  let color = 'var(--text-muted)';
  let border = '1px solid var(--glass-border)';

  if (realStatus === 'Lido' || realStatus === 'Entregue' || realStatus === 'Enviado') {
    bg = 'var(--success-bg)';
    color = 'var(--success)';
    border = '1px solid transparent';
  } else if (realStatus === 'Falhou' || (realStatus && realStatus.includes('Erro'))) {
    bg = 'var(--danger-bg)';
    color = 'var(--danger)';
    border = '1px solid transparent';
  }

  return (
    <span style={{
      padding: '4px 10px', 
      borderRadius: '12px', 
      fontSize: '11px', 
      fontWeight: '600', 
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '70px', 
      textAlign: 'center',
      background: bg, 
      color: color, 
      border: border
    }}>
      <span>
        {realStatus} {realStatus === 'Lido' && <CheckCircle2 size={10} style={{display:'inline', marginLeft:'2px'}}/>}
      </span>
      {currentError && <div style={{ fontSize: '10px', marginTop: '2px', color: 'var(--danger)' }}>{currentError}</div>}
    </span>
  );
};
