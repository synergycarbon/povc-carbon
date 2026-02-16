import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { loadAllFixtures, getFixtureForTopic, type FixtureManifest } from './fixtures';

interface DemoContextValue {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  getTableData: (table: string) => unknown[];
  getTopicData: (topic: string) => unknown[];
}

const DemoContext = createContext<DemoContextValue>({
  isDemoMode: false,
  toggleDemoMode: () => {},
  getTableData: () => [],
  getTopicData: () => [],
});

export function useDemoMode() {
  return useContext(DemoContext);
}

interface DemoProviderProps {
  children: ReactNode;
}

/**
 * DemoProvider wraps the application and provides demo mode state.
 * When demo mode is active, useWidgetSubscription and useEsliteQuery
 * return fixture data instead of live data.
 *
 * Activation:
 * - URL parameter: ?demo=true
 * - UI toggle via DemoBanner component
 */
export function DemoProvider({ children }: DemoProviderProps) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === 'true';
    }
    return false;
  });

  const [fixtures, setFixtures] = useState<FixtureManifest[]>([]);

  useEffect(() => {
    if (isDemoMode) {
      setFixtures(loadAllFixtures());
    }
  }, [isDemoMode]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (next) {
          url.searchParams.set('demo', 'true');
        } else {
          url.searchParams.delete('demo');
        }
        window.history.replaceState({}, '', url.toString());
      }
      return next;
    });
  }, []);

  const getTableData = useCallback(
    (table: string): unknown[] => {
      if (!isDemoMode) return [];
      const manifest = fixtures.find((f) => f.table === table);
      return manifest?.records ?? [];
    },
    [isDemoMode, fixtures],
  );

  const getTopicData = useCallback(
    (topic: string): unknown[] => {
      if (!isDemoMode) return [];
      return getFixtureForTopic(topic);
    },
    [isDemoMode],
  );

  return (
    <DemoContext.Provider value={{ isDemoMode, toggleDemoMode, getTableData, getTopicData }}>
      {children}
    </DemoContext.Provider>
  );
}
