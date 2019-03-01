/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message ||
        typeof message != 'object' ||
        message.type != 'treestyletab:response-query-logs')
      return;
    if (!message.logs || message.logs.length < 1)
      return;
    document.getElementById('queryLogs').textContent += message.logs.filter(log => !!log).map(log => {
      log.windowId = message.windowId || 'background';
      return JSON.stringify(log);
    }).join(',\n')+',\n';
    analyze();
  });
  browser.runtime.sendMessage({ type: 'treestyletab:request-query-logs' });
})();

function analyze() {
  const logs = JSON.parse(`[${document.getElementById('queryLogs').textContent.replace(/,\s*$/, '')}]`);

  function toString(data) {
    return JSON.stringify(data);
  }

  function fromString(data) {
    return JSON.parse(data);
  }

  const totalElapsedTimes = {};
  function normalize(log) {
    const elapsedTime = log.elapsed || log.elasped || 0;
    log = fromString(toString(log));
    delete log.elasped;
    delete log.elapsed;
    log.source = (typeof log.windowId == 'number') ? 'sidebar' : log.windowId;
    delete log.windowId;
    if (log.fromId) log.fromId = 'given';
    if (log.toId) log.toId = 'given';
    for (const key of ['id', '!id']) {
      if (log[key])
        log[key] = Array.isArray(log[key]) ? 'array' : (typeof log[key]);
    }
    const sorted = {};
    for (const key of Object.keys(log).sort()) {
      sorted[key] = log[key];
    }
    const type = toString(sorted);
    const total = totalElapsedTimes[type] || 0;
    totalElapsedTimes[type] = total + elapsedTime;
    return sorted;
  }
  const normalizedLogs = logs.map(normalize).map(toString).sort().map(fromString);

  function uniq(logs) {
    const logTypes = logs.map(toString);
    let lastType;
    let lastCount;
    const results = [];
    for (const type of logTypes) {
      if (type != lastType) {
        if (lastType) {
          results.push({
            count: lastCount,
            query: fromString(lastType),
            totalElapsed: totalElapsedTimes[lastType]
          });
        }
        lastType = type;
        lastCount = 0;
      }
      lastCount++;
    }
    if (lastType)
      results.push({
        count: lastCount,
        query: fromString(lastType),
        totalElapsed: totalElapsedTimes[lastType]
      });
    return results;
  }

  const results = [];
  results.push('Slowest query:\n' + toString(logs.sort((a,b) => (b.elasped || b.elapsed || 0) - (a.elasped || a.elapsed || 0))[0]));
  results.push('Count of query tyepes:\n' + uniq(normalizedLogs).sort((a, b) => b.count - a.count).map(toString).join('\n'));
  results.push('Sorted in total elapsed time:\n' + uniq(normalizedLogs).sort((a, b) => b.totalElapsed - a.totalElapsed).map(toString).join('\n'));
  document.getElementById('results').textContent = '`\n' + results.join('\n') + '\n`';
}
