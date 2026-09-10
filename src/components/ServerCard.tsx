import React from 'react';
import { Globe, MoreVertical, Check, Edit2, Share2, Trash2 } from 'lucide-react';
import { ProxyConfig } from '../types';
import { ProtocolBadge } from './Icons';
import { formatPing } from '../utils/formatters';

interface ServerCardProps {
  config: ProxyConfig;
  isSelected?: boolean;
  onSelect: () => void;
  onPing?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  config,
  isSelected = false,
  onSelect,
  onPing,
  onEdit,
  onShare,
  onDelete,
  compact = false,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pingInfo = formatPing(config.pingMs);

  const subtitle = `${config.server}:${config.port}${
    config.network && config.network !== 'tcp' ? ` • ${config.network.toUpperCase()}` : ''
  }${config.security && config.security !== 'none' ? ` • ${config.security.toUpperCase()}` : ''}`;

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-zt-surface border-zt-accent/50 shadow-[0_0_20px_rgba(84,104,255,0.12)]'
          : 'bg-zt-surface/60 border-zt-border hover:bg-zt-surface hover:border-zt-border-strong'
      } ${compact ? 'py-2' : ''}`}
    >
      <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
        {/* Node Icon Box */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
            isSelected
              ? 'bg-zt-accent/15 border-zt-accent/40 text-zt-accent'
              : 'bg-zt-surface-2 border-zt-border text-zt-text-muted group-hover:text-zt-text'
          }`}
        >
          {isSelected ? <Check size={16} className="text-zt-accent" /> : <Globe size={16} />}
        </div>

        {/* Server Details */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <ProtocolBadge protocol={config.protocol} />
            <span className="text-xs font-semibold text-zt-text truncate">{config.name}</span>
          </div>
          <span className="text-[11px] font-mono text-zt-text-faint truncate mt-0.5">{subtitle}</span>
        </div>
      </div>

      {/* Right Actions: Latency Badge + Menu */}
      <div className="flex items-center gap-1.5 shrink-0 ml-1.5" onClick={e => e.stopPropagation()}>
        {/* Ping Badge with 1-tap ping (compact: dot + latency) */}
        <button
          onClick={onPing}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zt-surface-2 border border-zt-border hover:border-zt-border-strong text-[11px] font-mono transition-colors active:scale-95"
          title="Click to test ping"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${pingInfo.dotClass}`} />
          <span className={pingInfo.colorClass}>{pingInfo.text}</span>
        </button>

        {/* Action Menu (if not compact) */}
        {!compact && (onEdit || onShare || onDelete) && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-zt-text-faint hover:text-zt-text hover:bg-zt-surface-2 transition-colors"
            >
              <MoreVertical size={13} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 w-32 rounded-xl bg-zt-surface-2 border border-zt-border shadow-2xl z-50 py-1 flex flex-col text-xs animate-popover">
                  {onEdit && (
                    <button
                      onClick={() => { setMenuOpen(false); onEdit(); }}
                      className="flex items-center gap-2 px-3 py-2 text-zt-text hover:bg-zt-surface text-left"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                  )}
                  {onShare && (
                    <button
                      onClick={() => { setMenuOpen(false); onShare(); }}
                      className="flex items-center gap-2 px-3 py-2 text-zt-text hover:bg-zt-surface text-left"
                    >
                      <Share2 size={13} />
                      <span>Share</span>
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="flex items-center gap-2 px-3 py-2 text-zt-danger hover:bg-zt-danger-soft text-left"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
