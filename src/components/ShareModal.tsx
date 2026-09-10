import React, { useState, useEffect } from 'react';
import * as QRCode from 'qrcode';
import { X, Copy, Check, QrCode } from 'lucide-react';
import { ProxyConfig } from '../types';

interface ShareModalProps {
  config: ProxyConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ config, isOpen, onClose }) => {
  const [mounted, setMounted] = useState(isOpen && !!config);
  const [isClosing, setIsClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Real, scannable QR code encoding the share link (not just a static icon).
  const shareText = config
    ? config.rawConfig || `${config.protocol.toLowerCase()}://${config.uuid}@${config.server}:${config.port}#${encodeURIComponent(config.name)}`
    : '';

  useEffect(() => {
    if (!shareText) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(shareText, {
      width: 176,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    })
      .then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shareText]);

  useEffect(() => {
    if (isOpen && config) {
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isOpen, config, mounted]);

  // ESC key dismissal
  useEffect(() => {
    if (!mounted || isClosing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isClosing, onClose]);

  if (!mounted || !config) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md cursor-pointer ${
        isClosing ? 'animate-backdrop-exit' : 'animate-backdrop-enter'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-sm rounded-3xl bg-zt-surface border border-zt-border p-6 shadow-2xl text-center cursor-default ${
          isClosing ? 'animate-modal-exit' : 'animate-modal-enter'
        }`}
        onClick={e => e.stopPropagation()}
      >
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
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR code for ${config.name}`} className="w-[140px] h-[140px]" />
            ) : (
              <QrCode size={140} className="text-black" />
            )}
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
