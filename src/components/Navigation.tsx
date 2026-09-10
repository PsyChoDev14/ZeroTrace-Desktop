import React from 'react';
import { Shield, Globe, BarChart2, Settings, Plus } from 'lucide-react';

export type NavTab = 'home' | 'servers' | 'statistics' | 'settings' | 'logs';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  serverCount?: number;
  onOpenAddModal?: () => void;
}

/**
 * iOS Liquid Glass Floating Navbar (Obsidian Dark Cyber Theme)
 * - Ultra-frosted acrylic capsule with specular top highlight
 * - Balanced 5-element island: [Home] [Servers] ( + Add Node ) [Stats] [Settings]
 * - Translucent sapphire liquid glass active capsule with zero border flash or layout shift
 * - Center elevated vibrant circular (+) button with smooth rotation & glow
 */
const NavigationComponent: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  serverCount = 0,
  onOpenAddModal,
}) => {
  const leftTabs: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: <Shield size={20} strokeWidth={2} /> },
    { id: 'servers', label: 'Servers', icon: <Globe size={20} strokeWidth={2} />, badge: serverCount },
  ];

  const rightTabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'statistics', label: 'Statistics', icon: <BarChart2 size={20} strokeWidth={2} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} strokeWidth={2} /> },
  ];

  return (
    <div className="w-full px-4 pb-3 pt-1 pointer-events-none z-40 select-none shrink-0">
      {/* Floating Island */}
      <nav className="nav-glass pointer-events-auto w-full max-w-[344px] mx-auto flex items-center justify-between px-2.5 py-1.5 rounded-full relative">
        {/* Left Tabs */}
        <div className="flex items-center gap-1.5 flex-1 justify-around">
          {leftTabs.map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center relative cursor-pointer outline-none focus:outline-none focus:ring-0 select-none transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out ${
                  isActive
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-400 shadow-[0_0_14px_rgba(59,130,246,0.3)] scale-105'
                    : 'bg-transparent border-transparent text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 active:scale-95'
                }`}
                title={tab.label}
                aria-label={tab.label}
              >
                <div className={isActive ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]' : ''}>
                  {tab.icon}
                </div>

                {/* Badge for server count */}
                {typeof tab.badge === 'number' && tab.badge > 0 && !isActive && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-mono bg-blue-600 text-white font-bold flex items-center justify-center shadow-md">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center Elevated Action Button (+) */}
        <div className="px-1 shrink-0">
          <button
            onClick={onOpenAddModal}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white cursor-pointer bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 shadow-[0_4px_18px_rgba(37,99,235,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] border border-white/20 hover:scale-108 active:scale-90 active:shadow-[0_2px_10px_rgba(37,99,235,0.4)] outline-none focus:outline-none focus:ring-0 transition-all duration-200 ease-out group"
            title="Add Server Configuration"
            aria-label="Add Server Configuration"
          >
            <Plus
              size={22}
              strokeWidth={2.5}
              className="transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:rotate-90 group-active:rotate-180 group-active:scale-90"
            />
          </button>
        </div>

        {/* Right Tabs */}
        <div className="flex items-center gap-1.5 flex-1 justify-around">
          {rightTabs.map(tab => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center relative cursor-pointer outline-none focus:outline-none focus:ring-0 select-none transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out ${
                  isActive
                    ? 'bg-blue-500/20 border-blue-400/40 text-blue-400 shadow-[0_0_14px_rgba(59,130,246,0.3)] scale-105'
                    : 'bg-transparent border-transparent text-zt-text-muted hover:text-zt-text hover:bg-zt-surface-2 active:scale-95'
                }`}
                title={tab.label}
                aria-label={tab.label}
              >
                <div className={isActive ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]' : ''}>
                  {tab.icon}
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export const Navigation = React.memo(NavigationComponent);

