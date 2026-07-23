import React, { useEffect, useState } from 'react';
import './ImagePreview.css';

const EXT_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff',
};

export function isImagePath(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return ext in EXT_MIME;
}

function mimeForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'image/png';
}

interface Props {
  filePath: string;
}

export const ImagePreview: React.FC<Props> = ({ filePath }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setSrc(null);
    setError(null);
    setZoom(1);
    window.electronAPI?.readFileBase64?.(filePath).then((b64) => {
      const mime = mimeForPath(filePath);
      setSrc(`data:${mime};base64,${b64}`);
    }).catch((e: any) => setError(e?.message ?? 'Failed to load image'));
  }, [filePath]);

  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;

  return (
    <div className="img-preview-root">
      <div className="img-preview-toolbar">
        <span className="img-preview-name">{fileName}</span>
        <div className="img-preview-zoom-controls">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.25).toFixed(2)))} title="Zoom out">−</button>
          <span className="img-preview-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(8, +(z + 0.25).toFixed(2)))} title="Zoom in">+</button>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom">1:1</button>
          <button type="button" onClick={() => setZoom(0)} title="Fit to view">Fit</button>
        </div>
      </div>
      <div className="img-preview-canvas">
        {error && <p className="img-preview-error">{error}</p>}
        {!error && !src && <p className="img-preview-loading">Loading…</p>}
        {src && (
          <img
            src={src}
            alt={fileName}
            className="img-preview-img"
            style={zoom === 0
              ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
              : { transform: `scale(${zoom})`, transformOrigin: 'top left' }
            }
          />
        )}
      </div>
    </div>
  );
};
