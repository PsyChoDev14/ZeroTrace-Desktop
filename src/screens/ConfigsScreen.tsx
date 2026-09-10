import React, { useState } from 'react';
import { Zap, Search, Trash2, Server } from 'lucide-react';
import { ProxyConfig } from '../types';
import { ServerCard } from '../components/ServerCard';

interface ConfigsScreenProps {
  configs: ProxyConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPing: (id: string) => void;
  onPingAll: () => void;
  onOpenAddModal: () => void;
  onEdit: (config: ProxyConfig) => void;
  onShare: (config: ProxyConfig) => void;
  onDelete: (id: string) => void;
  isPingingAll?: boolean;
}

export const ConfigsScreen: React.FC<ConfigsScreenProps> = ({
  configs,
  selectedId,
  onSelect,
  onPing,
  onPingAll,
  onEdit,
  onShare,
  onDelete,
  isPingingAll = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = configs.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.server.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.protocol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-2 max-w-sm mx-auto w-full overflow-hidden select-none">
      {/* 1. Decluttered Clean Header */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-zt-text tracking-tight">Servers</h1>
          <span className="text-[11px] font-mono text-zt-text-muted px-2 py-0.5 rounded-full bg-zt-surface border border-zt-border">
            {configs.length}
          </span>
        </div>

        {/* Ping All Benchmark */}
        <button
          onClick={onPingAll}
          disabled={isPingingAll || configs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zt-surface hover:bg-zt-surface-2 border border-zt-border hover:border-zt-border-strong text-xs font-medium text-zt-text transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          title="Test latency for all servers"
        >
          <Zap size={13} className={`text-zt-accent ${isPingingAll ? 'animate-spin' : ''}`} />
          <span>{isPingingAll ? 'Testing…' : 'Ping All'}</span>
        </button>
      </div>

      {/* 2. Compact Search Input */}
      <div className="relative my-2 shrink-0">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zt-text-faint" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search servers…"
          className="w-full rounded-xl bg-zt-surface-2 border border-zt-border pl-9 pr-4 py-2 text-xs text-zt-text placeholder-zt-text-faint focus:outline-none focus:border-zt-accent/50 transition-colors"
        />
      </div>

      {/* 3. Server Cards Scroll List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pt-1">
        {filtered.length > 0 ? (
          filtered.map(config => (
            <ServerCard
              key={config.id}
              config={config}
              isSelected={config.id === selectedId}
              onSelect={() => onSelect(config.id)}
              onPing={() => onPing(config.id)}
              onEdit={() => onEdit(config)}
              onShare={() => onShare(config)}
              onDelete={() => setConfirmDeleteId(config.id)}
            />
          ))
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center text-zt-text-faint">
            <Server size={28} className="opacity-40 mb-2" />
            <p className="text-xs">
              {searchQuery ? 'No matching servers' : 'No servers configured yet'}
            </p>
            <p className="text-[11px] text-zt-text-faint/80 mt-1">Tap the (+) button below to add one</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-backdrop-enter cursor-pointer"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="relative w-full max-w-xs rounded-2xl bg-zt-surface border border-zt-border p-5 text-center shadow-2xl animate-modal-enter cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={20} />
            </div>
            <h3 className="text-sm font-bold text-zt-text">Delete Server?</h3>
            <p className="text-xs text-zt-text-muted mt-1">
              Are you sure you want to remove this configuration?
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-medium text-zt-text bg-zt-surface-2 hover:bg-zt-surface border border-zt-border transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
