/** Wrapper around console.log.  Use `log.enabled` to enable/disable */
export function log(s: any, ...args: any[]) {
  if (!log['enabled']) return;
  console.log('[Breeze] ' + s + '\n', args);
}
log['enabled'] = true;

