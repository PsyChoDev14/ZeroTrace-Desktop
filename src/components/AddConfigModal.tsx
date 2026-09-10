import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { X, Clipboard, ArrowRight, AlertCircle, ScanLine } from 'lucide-react';
import { ProxyConfig } from '../types';
import { api } from '../utils/tauriBridge';

interface AddConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (config: ProxyConfig) => void;
}

export const AddConfigModal: React.FC<AddConfigModalProps> = ({ isOpen, onClose, onAdded }) => {
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, mounted]);

  // ESC key dismissal
  useEffect(() => {
    if (!mounted || isClosing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isClosing, onClose]);

  if (!mounted) return null;

  const handlePaste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setRawText(clip.trim());
      setError(null);
    } catch {
      setError('Could not read from clipboard');
    }
  };

  const handleScanQrImage = () => {
    fileInputRef.current?.click();
  };

  const handleQrFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load image'));
        image.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) {
        setError('Could not process the image on this device.');
        return;
      }
      canvasCtx.drawImage(img, 0, 0);
      const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        setRawText(code.data);
      } else {
        setError('No QR code found in that image. Try a clearer screenshot or photo.');
      }
    } catch {
      setError('Could not read the selected image.');
    }
  };

  const handleImport = async () => {
    if (!rawText.trim()) {
      setError('Please enter a proxy link or JSON');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const parsed = await api.parseConfig(rawText.trim());
      if (parsed) {
        await api.saveConfig(parsed);
        onAdded(parsed);
        onClose();
        setRawText('');
      } else {
        setError('Unsupported format. Please provide a valid VLESS, VMess, Trojan, Shadowsocks URI or Xray JSON.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to parse configuration');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md cursor-pointer ${
        isClosing ? 'animate-backdrop-exit' : 'animate-backdrop-enter'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl bg-zt-surface border border-zt-border p-6 shadow-2xl cursor-default ${
          isClosing ? 'animate-modal-exit' : 'animate-modal-enter'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zt-border">
          <div>
            <h2 className="text-base font-bold text-zt-text">Add Xray Server</h2>
            <p className="text-xs text-zt-text-muted mt-0.5">
              Supports VLESS Reality, VMess, Trojan, Shadowsocks, and Custom JSON
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input Area */}
        <div className="my-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-zt-text-muted">Configuration Link or JSON</label>
            <div className="flex items-center gap-3">
              <button
                onClick={handleScanQrImage}
                className="flex items-center gap-1 text-xs text-zt-accent hover:underline"
              >
                <ScanLine size={12} />
                <span>Scan QR Image</span>
              </button>
              <button
                onClick={handlePaste}
                className="flex items-center gap-1 text-xs text-zt-accent hover:underline"
              >
                <Clipboard size={12} />
                <span>Paste from Clipboard</span>
              </button>
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleQrFileSelected}
              className="hidden"
            />
          </div>

          <textarea
            value={rawText}
            onChange={e => {
              setRawText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste vless://, vmess://, trojan://, ss://, or { &quot;outbounds&quot;: [...] }"
            rows={6}
            className="w-full rounded-2xl bg-zt-surface-2 border border-zt-border px-4 py-3 text-xs font-mono text-zt-text placeholder-zt-text-faint focus:outline-none focus:border-zt-accent transition-colors resize-none"
          />

          {error && (
            <div className="flex items-center gap-2 mt-2 text-xs text-zt-danger bg-zt-danger-soft border border-zt-danger/20 rounded-xl p-2.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-zt-accent text-white hover:bg-zt-accent-hover transition-colors shadow-lg shadow-zt-accent/25 disabled:opacity-50"
          >
            <span>{isProcessing ? 'Importing...' : 'Add Server'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
