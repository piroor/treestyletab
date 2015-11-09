/**
 * How to use:
 *
 *  1. Insert "ReferenceCounter.add('unique key'); after "addEventListener()"
 *  2. Insert "ReferenceCounter.remove('unique key'); after "removeEventListener()"
 *  3. Open and close windows multiple times.
 *  4. Go to the browser console and run the script:
 *     (function() { let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {}); return ReferenceCounter.report() })();
 *
 * Expected result for good case:
 *
 *   Blank array is returned.
 *
 * Expected result for bad case:
 *
 *   Not-removed counters are reported as the elements of the returned array.
 */

"use strict";

var EXPORTED_SYMBOLS = ['ReferenceCounter'];

var ReferenceCounter = {
	_listeners: {},
	add: function(aKey) {
		this._listeners[aKey] = this._listeners[aKey] || 0;
		this._listeners[aKey]++;
	},
	remove: function(aKey) {
		this._listeners[aKey] = this._listeners[aKey] || 0;
		this._listeners[aKey]--;
	},
	report: function() {
		var keys = [];
		Object.keys(this._listeners).forEach(function(aKey) {
			if (this._listeners[aKey] <= 1)
				return;
			keys.push(aKey+'('+this._listeners[aKey]+')');
		}, this);
		return keys;
	}
};
