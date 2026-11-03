/**
 * A tiny external store that tracks slow and failed API calls, so a single banner can tell
 * the user that a free-tier server is cold-starting (Render sleeps after inactivity).
 * Read it from React with useSyncExternalStore (see components/banners.tsx).
 */

export interface NetworkStatus {
  /** Number of in-flight requests that have exceeded the slow threshold. */
  slowCount: number;
  /** Set when a request failed to reach the server at all (network error / timeout). */
  unreachable: boolean;
}

let state: NetworkStatus = { slowCount: 0, unreachable: false };
const listeners = new Set<() => void>();

function set(next: Partial<NetworkStatus>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export const networkStatus = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => state,

  slowStarted: () => set({ slowCount: state.slowCount + 1 }),
  slowFinished: () => set({ slowCount: Math.max(0, state.slowCount - 1) }),
  markUnreachable: () => set({ unreachable: true }),
  markReachable: () => {
    if (state.unreachable) set({ unreachable: false });
  },
};
