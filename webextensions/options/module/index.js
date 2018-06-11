import * as Constants from '../../common/module/constants.js';

// Set to the global to make compatibility with other classic sources.
for (let key of Object.keys(Constants)) {
  window[key] = Constants[key];
}
