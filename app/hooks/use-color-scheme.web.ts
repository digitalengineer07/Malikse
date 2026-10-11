import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
const subscribe = () => () => {};
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const colorScheme = useRNColorScheme();
  return hydrated ? colorScheme : 'light';
}
