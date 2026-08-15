import { useState } from 'react';
import UploadArea from './components/UploadArea';
import ProgressTracker from './components/ProgressTracker';
import ChatInterface from './components/ChatInterface';
import ResumeChat from './components/ResumeChat';

function App() {
  const [documentId, setDocumentId] = useState(null);
  const [progress, setProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.5rem', background: 'linear-gradient(to right, var(--primary-accent), var(--secondary-accent))', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            RAG Wizard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Upload a document and start chatting with it instantly.
          </p>
        </div>

        <div className="glass-panel">
          <UploadArea 
            setDocumentId={setDocumentId} 
            setIsUploading={setIsUploading} 
          />
        </div>

        <div className="glass-panel">
          <ResumeChat setDocumentId={setDocumentId} />
        </div>

        {(isUploading && documentId) && (
          <div className="glass-panel">
            <ProgressTracker 
              documentId={documentId} 
              progress={progress} 
              setProgress={setProgress} 
            />
          </div>
        )}
      </div>

      <div className="main-content glass-panel">
        <ChatInterface documentId={documentId} />
      </div>
    </div>
  );
}

export default App;
