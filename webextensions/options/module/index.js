import * as Constants from '/common/module/constants.js';
import * as Common from '/common/module/common.js';

// Set to the global to make compatibility with other classic sources.
for (let key of Object.keys(Constants)) {
  window[key] = Constants[key];
}
for (let key of Object.keys(Common)) {
  window[key] = Common[key];
}
