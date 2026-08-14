import { Package, MessageCircle, Layers } from 'lucide-react';

export default function ListSkeletonLoader({ count = 6, title = "A carregar lista de dados..." }) {
  return (
    <div className="flex-col gap-4 py-4 animate-fade-in" style={{ width: '100%', flex: 1 }}>
      {/* Header com animação de pulso no contexto de logística e WhatsApp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          padding: '8px',
          borderRadius: '10px',
          background: 'var(--glass-bg-hover)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulseGlow 2s infinite ease-in-out'
        }}>
          <Layers size={18} color="var(--primary)" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>
          {title}
        </span>
      </div>

      {/* Linhas Skeleton Shimmer adaptadas ao tema */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className={`skeleton-shimmer stagger-${(idx % 10) + 1}`}
            style={{
              height: '46px',
              width: '100%',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ width: '20%', height: '14px', borderRadius: '4px', background: 'var(--glass-bg-active)' }}></div>
            <div style={{ width: '40%', height: '14px', borderRadius: '4px', background: 'var(--glass-bg-active)' }}></div>
            <div style={{ width: '15%', height: '14px', borderRadius: '4px', background: 'var(--glass-bg-active)' }}></div>
            <div style={{ width: '10%', height: '22px', borderRadius: '12px', background: 'var(--glass-bg-active)' }}></div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
