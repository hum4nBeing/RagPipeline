import { useEffect, useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

export default function ProgressTracker({ documentId, progress, setProgress }) {
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
    const wsBase = apiUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/${documentId}`);
    
    ws.onmessage = (event) => {
      setProgress(event.data);
      if (event.data.includes('Done')) {
        setIsDone(true);
      }
    };

    return () => ws.close();
  }, [documentId, setProgress]);

  if (!documentId && !progress) return null;

  return (
    <div className="progress-container">
      <div className="progress-header">
        {isDone ? (
          <CheckCircle style={{ color: '#10b981' }} size={20} />
        ) : (
          <Loader2 className="upload-icon" style={{ width: 20, height: 20, animation: 'spin 2s linear infinite' }} />
        )}
        <span>Processing Status</span>
      </div>
      <div className="progress-text">
        {progress || 'Initializing...'}
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
