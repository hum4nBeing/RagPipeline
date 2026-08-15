import { useState } from 'react';
import { Play } from 'lucide-react';

export default function ResumeChat({ setDocumentId }) {
  const [inputId, setInputId] = useState('');

  const handleResume = (e) => {
    e.preventDefault();
    if (inputId.trim()) {
      setDocumentId(inputId.trim());
      setInputId('');
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-color)' }}>Resume Session</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Paste a Document ID (UUID) to resume an earlier chat session.
      </p>
      <form onSubmit={handleResume} style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #333',
            background: 'rgba(0,0,0,0.2)',
            color: 'var(--text-color)'
          }}
        />
        <button type="submit" disabled={!inputId.trim()} className="send-button" style={{ padding: '0.5rem 1rem' }}>
          <Play size={16} />
        </button>
      </form>
    </div>
  );
}
