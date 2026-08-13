import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { API_BASE, fetchApi } from '../config/api';

export const MessageStatusPill = ({ status, wa_message_id, currentError }) => {
  const [realStatus, setRealStatus] = useState(status);
  
  useEffect(() => {
    // Nós já não fazemos fetch ao Whatchimp por cada cliente!
    // O Webhook do backend é que atualiza o status na Base de Dados e o painel lê da Base de Dados.
    setRealStatus(status || 'Pendente');
  }, [status]);

  let bg = 'var(--glass-bg-active)';
  let color = 'var(--text-muted)';
  let border = '1px solid var(--glass-border)';

  if (realStatus === 'Lido' || realStatus === 'Entregue' || realStatus === 'Enviado') {
    bg = 'var(--success-bg)';
    color = 'var(--success)';
    border = '1px solid transparent';
  } else if (realStatus === 'Falhou' || (realStatus && String(realStatus).includes('Erro'))) {
    bg = 'var(--danger-bg)';
    color = 'var(--danger)';
    border = '1px solid transparent';
  }

  return (
    <span 
      title={currentError || ''}
      style={{
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
      border: border,
      cursor: currentError ? 'help' : 'default'
    }}>
      <span>
        {realStatus} {realStatus === 'Lido' && <CheckCircle2 size={10} style={{display:'inline', marginLeft:'2px'}}/>}
      </span>
    </span>
  );
};
