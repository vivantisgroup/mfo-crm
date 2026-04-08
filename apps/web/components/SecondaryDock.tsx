'use client';

import React from 'react';

export interface SecondaryDockTab {
  id: string;
  label: string;
  icon?: any;
  badge?: React.ReactNode;
}

interface Props {
  tabs: SecondaryDockTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  rightAccessory?: React.ReactNode;
}

export function SecondaryDock({ tabs, activeTab, onTabChange, rightAccessory }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 24px',
      height: 48,
      minHeight: 48,
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.id;
        
        // Dynamically process the icon property (String vs Element vs Reference)
        let iconEl = null;
        if (typeof tab.icon === 'string') {
          iconEl = <span>{tab.icon}</span>;
        } else if (tab.icon) {
          const injectProps = {
            size: 16,
            strokeWidth: active ? 2.2 : 1.8,
            className: `transition-colors ${active ? "text-brand-500" : "text-slate-400 group-hover:text-slate-200"}`
          };
          
          if (React.isValidElement(tab.icon)) {
            iconEl = React.cloneElement(tab.icon as React.ReactElement<any>, injectProps);
          } else {
            const IconComponent = tab.icon;
            iconEl = <IconComponent {...injectProps} />;
          }
        }

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="group outline-none"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: '100%',
              padding: '0 4px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${active ? 'var(--brand-500)' : 'transparent'}`,
              color: active ? 'var(--brand-400)' : 'var(--text-secondary)',
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap'
            }}
          >
            {iconEl && <span className="flex items-center justify-center w-5 h-5">{iconEl}</span>}
            <span className={active ? "" : "transition-colors group-hover:text-[var(--text-primary)]"}>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
      {rightAccessory && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {rightAccessory}
        </div>
      )}
    </div>
  );
}
