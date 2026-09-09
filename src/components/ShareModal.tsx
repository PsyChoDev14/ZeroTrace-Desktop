import React, { useState } from 'react';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { ProxyConfig } from '../types';

interface ShareModalProps {
  config: ProxyConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ config, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen || !config) return null;

  const shareText = config.rawConfig || `${config.protocol.toLowerCase()}://${config.uuid}@${config.server}:${config.port}#${encodeURIComponent(config.name)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple clean SVG QR code visualizer representation
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-3xl bg-zt-surface border border-zt-border p-6 shadow-2xl text-center">
        <div className="flex items-center justify-between pb-3 border-b border-zt-border">
          <h2 className="text-sm font-bold text-zt-text">Share Server Config</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="my-5 flex flex-col items-center">
          <div className="w-48 h-48 rounded-2xl bg-white p-3 flex flex-col items-center justify-center shadow-lg">
            <QrCode size={140} className="text-black" />
            <span className="text-[10px] text-gray-600 font-mono mt-1 font-semibold truncate max-w-full">
              {config.name}
            </span>
          </div>

          <p className="text-xs text-zt-text-muted mt-3">
            Scan from ZeroTrace Mobile or copy the encrypted link below
          </p>

          <div className="mt-3 w-full p-2.5 rounded-xl bg-zt-surface-2 border border-zt-border text-[11px] font-mono text-zt-text-muted break-all max-h-20 overflow-y-auto select-all">
            {shareText}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              copied
                ? 'bg-zt-success text-white'
                : 'bg-zt-accent text-white hover:bg-zt-accent-hover shadow-lg shadow-zt-accent/25'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
