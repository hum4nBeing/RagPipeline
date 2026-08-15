import { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

export default function UploadArea({ setDocumentId, setIsUploading }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0]);
    }
  };

  const [errorMsg, setErrorMsg] = useState(null);

  const uploadFile = async (file) => {
    setErrorMsg(null); // reset previous errors
    
    // Cloudflare Queue message limit is 128KB. We leave a tiny buffer for JSON overhead.
    if (file.size > 125000) {
      setErrorMsg(`File is too large (${(file.size / 1024).toFixed(1)} KB). Limit is 125 KB.`);
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const data = await response.json();
      setDocumentId(data.document_id);
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMsg('Upload failed. Check console for details.');
      setIsUploading(false);
    }
  };

  return (
    <>
      <div 
        className={`upload-area ${isDragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleChange}
          accept=".txt,.md,.json"
        />
        <UploadCloud className="upload-icon" />
        <div>
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Click or drag to upload</strong>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TXT, MD, or JSON</span>
        </div>
      </div>
      
      {errorMsg && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: 'rgba(255, 68, 68, 0.1)',
          border: '1px solid rgba(255, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#ff4444',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {errorMsg}
        </div>
      )}
    </>
  );
}
