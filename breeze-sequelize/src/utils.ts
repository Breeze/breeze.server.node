
export function log(s: any, ...args: any[]) {
  if (!log['enabled']) return;
  console.log('[Breeze] ' + s + '\n', args);
}
log['enabled'] = true;

