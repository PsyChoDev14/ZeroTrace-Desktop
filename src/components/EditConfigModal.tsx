import React, { useState, useEffect } from 'react';
import { X, Save, Server } from 'lucide-react';
import { ProxyConfig } from '../types';
import { api } from '../utils/tauriBridge';

interface EditConfigModalProps {
  config: ProxyConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: ProxyConfig) => void;
}

export const EditConfigModal: React.FC<EditConfigModalProps> = ({ config, isOpen, onClose, onSaved }) => {
  const [mounted, setMounted] = useState(isOpen && !!config);
  const [isClosing, setIsClosing] = useState(false);

  const [name, setName] = useState(config?.name || '');
  const [server, setServer] = useState(config?.server || '');
  const [port, setPort] = useState(config?.port?.toString() || '');
  const [uuid, setUuid] = useState(config?.uuid || '');
  const [sni, setSni] = useState(config?.sni || '');
  const [path, setPath] = useState(config?.path || '');
  const [publicKey, setPublicKey] = useState(config?.publicKey || '');
  const [shortId, setShortId] = useState(config?.shortId || '');

  useEffect(() => {
    if (config) {
      setName(config.name);
      setServer(config.server);
      setPort(config.port.toString());
      setUuid(config.uuid || '');
      setSni(config.sni || '');
      setPath(config.path || '');
      setPublicKey(config.publicKey || '');
      setShortId(config.shortId || '');
    }
  }, [config]);

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

  const handleSave = async () => {
    const updated: ProxyConfig = {
      ...config,
      name: name.trim() || config.name,
      server: server.trim() || config.server,
      port: parseInt(port) || config.port,
      uuid: uuid.trim(),
      sni: sni.trim(),
      path: path.trim(),
      publicKey: publicKey.trim(),
      shortId: shortId.trim(),
    };

    await api.saveConfig(updated);
    onSaved(updated);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md cursor-pointer ${
        isClosing ? 'animate-backdrop-exit' : 'animate-backdrop-enter'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-3xl bg-zt-surface border border-zt-border p-6 shadow-2xl cursor-default ${
          isClosing ? 'animate-modal-exit' : 'animate-modal-enter'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-zt-border">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-zt-accent" />
            <h2 className="text-base font-bold text-zt-text">Edit Server Config</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="my-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">Server Name / Alias</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs text-zt-text focus:outline-none focus:border-zt-accent"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">Host / Domain</label>
              <input
                type="text"
                value={server}
                onChange={e => setServer(e.target.value)}
                className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">Port</label>
              <input
                type="number"
                value={port}
                onChange={e => setPort(e.target.value)}
                className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">
              UUID / Password / Secret
            </label>
            <input
              type="text"
              value={uuid}
              onChange={e => setUuid(e.target.value)}
              className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">SNI / Bug Host</label>
            <input
              type="text"
              value={sni}
              onChange={e => setSni(e.target.value)}
              className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
            />
          </div>

          {config.network === 'ws' && (
            <div>
              <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">WebSocket Path</label>
              <input
                type="text"
                value={path}
                onChange={e => setPath(e.target.value)}
                className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
              />
            </div>
          )}

          {config.security === 'reality' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">Reality Public Key (pbk)</label>
                <input
                  type="text"
                  value={publicKey}
                  onChange={e => setPublicKey(e.target.value)}
                  className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zt-text-muted mb-1">Reality Short ID (sid)</label>
                <input
                  type="text"
                  value={shortId}
                  onChange={e => setShortId(e.target.value)}
                  className="w-full rounded-xl bg-zt-surface-2 border border-zt-border px-3 py-2 text-xs font-mono text-zt-text focus:outline-none focus:border-zt-accent"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zt-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-zt-accent text-white hover:bg-zt-accent-hover transition-colors shadow-lg shadow-zt-accent/25"
          >
            <Save size={14} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
