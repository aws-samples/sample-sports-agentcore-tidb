import type { DebugEntry } from '../types';

let debugLogs: DebugEntry[] = [];
let debugEnabled = false;

export function debugLog(toolName: string, phase: 'INPUT' | 'OUTPUT', data: unknown) {
  if (!debugEnabled) return;
  debugLogs.push({
    tool: toolName,
    phase,
    data,
    timestamp: Date.now(),
  });
}

export function resetDebug(enabled: boolean) {
  debugLogs = [];
  debugEnabled = enabled;
}

export function getDebugLogs(): DebugEntry[] {
  return debugLogs;
}
