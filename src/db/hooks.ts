import { useMemo, useSyncExternalStore, type DependencyList } from 'react';
import { dbVersion, subscribe } from './db';

/** Читает данные из базы и перечитывает, когда в базу что-то записали. */
export function useLive<T>(read: () => T, deps: DependencyList = []): T {
  const v = useSyncExternalStore(subscribe, dbVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [v, ...deps]);
}
