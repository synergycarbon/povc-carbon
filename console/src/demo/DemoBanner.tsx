import React from 'react';
import { useDemoMode } from './DemoProvider';

/**
 * Floating demo mode banner with toggle.
 * Appears at the top of the screen when demo mode is active.
 * Provides a toggle to switch between demo and live modes.
 */
export function DemoBanner() {
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  if (!isDemoMode) {
    return (
      <button
        onClick={toggleDemoMode}
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          zIndex: 9999,
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          border: '1px solid rgba(22, 163, 74, 0.3)',
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#22c55e',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        Enable Demo Mode
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0.5rem 1rem',
        background: 'linear-gradient(90deg, #15803d 0%, #16a34a 50%, #15803d 100%)',
        color: 'white',
        fontSize: '0.875rem',
        fontWeight: 600,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#fbbf24',
            animation: 'demo-pulse 2s infinite',
          }}
        />
        Demo Mode — Viewing sample data
      </span>
      <button
        onClick={toggleDemoMode}
        style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.4)',
          background: 'transparent',
          color: 'white',
          fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Switch to Live
      </button>
      <style>{`
        @keyframes demo-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
