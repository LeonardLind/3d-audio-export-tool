import { useContext } from 'react';
import { ResourcesContext } from './resources.ts';
import type { Resources } from './resources.ts';

export function useResources(): Resources {
  const resources = useContext(ResourcesContext);
  if (!resources) throw new Error('ResourcesProvider is missing');
  return resources;
}
