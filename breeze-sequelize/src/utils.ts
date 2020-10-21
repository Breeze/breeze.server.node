/** Wrapper around console.log.  Use `log.enabled` to enable/disable */
export function log(...args: any[]) {
  if (!log['enabled']) return;
  console.log('[Breeze]', ...args);
}
log['enabled'] = true;

