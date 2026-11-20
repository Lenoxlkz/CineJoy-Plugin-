export type DeviceMode = 'tv' | 'phone';
export type FocusZone = 'appbar' | 'tabs' | 'grid';
export type DpadDirection = 'up' | 'down' | 'left' | 'right' | 'ok';
export type SdkFunction = 'resolve' | 'home' | 'search' | 'episodes' | 'screen';

export const SCREEN_TABS = ['trending', 'movies', 'series', 'action'] as const;

export const SDK_DEFAULT_ARGS: Record<SdkFunction, string> = {
  resolve: 'movie:550',
  search: 'Matrix',
  episodes: 'series:1399',
  home: '',
  screen: '',
};

export function sdkFunctionNeedsArg(fn: SdkFunction): boolean {
  return fn !== 'home' && fn !== 'screen';
}

/**
 * Recursively counts UI nodes in a Kino screen tree to check against the 600-node budget.
 */
export function countScreenNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) {
    return node.reduce((sum, child) => sum + countScreenNodes(child), 0);
  }
  const obj = node as Record<string, unknown>;
  let count = typeof obj.type === 'string' ? 1 : 0;

  if (obj.appBar) count += countScreenNodes(obj.appBar);
  if (obj.leading) count += countScreenNodes(obj.leading);
  if (obj.actions) count += countScreenNodes(obj.actions);
  if (obj.bottom) count += countScreenNodes(obj.bottom);
  if (obj.body) count += countScreenNodes(obj.body);
  if (obj.children) count += countScreenNodes(obj.children);
  if (Array.isArray(obj.items)) count += obj.items.length;
  if (Array.isArray(obj.tabs)) count += obj.tabs.length;

  return count;
}

export interface DpadState {
  zone: FocusZone;
  focusedIndex: number;
}

export function nextDpadFocus(
  current: DpadState,
  direction: Exclude<DpadDirection, 'ok'>,
  options: {
    tabsCount: number;
    itemsCount: number;
    cols: number;
    currentTabIndex: number;
  }
): DpadState {
  const { tabsCount, itemsCount, cols, currentTabIndex } = options;
  const safeTabIdx = Math.max(0, Math.min(tabsCount - 1, currentTabIndex));

  if (current.zone === 'appbar') {
    if (direction === 'down') {
      return { zone: 'tabs', focusedIndex: safeTabIdx };
    }
    return current;
  }

  if (current.zone === 'tabs') {
    if (direction === 'up') {
      return { zone: 'appbar', focusedIndex: 0 };
    }
    if (direction === 'down') {
      if (itemsCount > 0) {
        return { zone: 'grid', focusedIndex: 0 };
      }
      return current;
    }
    if (direction === 'left') {
      return { zone: 'tabs', focusedIndex: Math.max(0, current.focusedIndex - 1) };
    }
    if (direction === 'right') {
      return { zone: 'tabs', focusedIndex: Math.min(Math.max(0, tabsCount - 1), current.focusedIndex + 1) };
    }
    return current;
  }

  // zone === 'grid'
  if (itemsCount <= 0) {
    return { zone: 'tabs', focusedIndex: safeTabIdx };
  }
  const clamped = Math.max(0, Math.min(itemsCount - 1, current.focusedIndex));

  if (direction === 'up') {
    if (clamped < cols) {
      return { zone: 'tabs', focusedIndex: safeTabIdx };
    }
    return { zone: 'grid', focusedIndex: Math.max(0, clamped - cols) };
  }
  if (direction === 'down') {
    return { zone: 'grid', focusedIndex: Math.min(itemsCount - 1, clamped + cols) };
  }
  if (direction === 'left') {
    return { zone: 'grid', focusedIndex: Math.max(0, clamped - 1) };
  }
  if (direction === 'right') {
    return { zone: 'grid', focusedIndex: Math.min(itemsCount - 1, clamped + 1) };
  }
  return current;
}

export function formatSdkCommandOutput(stdout: string, stderr: string): string {
  const out = (stdout || '').trim();
  const err = (stderr || '').trim();
  if (err && out) {
    return `${err}\n\n${out}`;
  }
  return out || err || 'Sin salida';
}
