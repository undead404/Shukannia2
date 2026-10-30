const enabled =
  new URLSearchParams(window.location.search).get('debug') === 'timeline';
const storageKey = 'shukannia-timeline-debug-v1';
let entries: unknown[] = [];
if (enabled) {
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? '[]',
    );
    if (Array.isArray(saved)) entries = saved.slice(-80);
  } catch {
    // Diagnostics also work when browser storage is unavailable.
  }
}

export const timelineDebugEnabled = enabled;

export function traceTimeline(event: string, data: object = {}) {
  if (!enabled) return;
  entries.push({ time: new Date().toISOString(), event, ...data });
  entries = entries.slice(-80);
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Keep the current page's diagnostics in memory.
  }
}

export function readTimelineDebug() {
  return JSON.stringify(entries, null, 2);
}

if (enabled) {
  const navigation = performance.getEntriesByType('navigation')[0];
  traceTimeline('page-loaded (debug v1)', {
    navigationType:
      navigation instanceof PerformanceNavigationTiming
        ? navigation.type
        : 'unknown',
  });
  window.addEventListener('pagehide', () => traceTimeline('page-hidden'));
}
