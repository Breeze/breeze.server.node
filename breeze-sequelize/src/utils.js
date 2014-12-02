exports.log = log;
exports.log.enabled = true;

function log(s) {
  if (!log.enabled) return;
  console.log('[Breeze] ' + s + '\n');
}

