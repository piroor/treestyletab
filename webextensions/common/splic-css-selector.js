/*
  Original: https://github.com/joakimbeng/split-css-selector
  MIT License © Joakim Carlstein
*/

'use strict';

/* eslint-disable no-undef,no-var */
module.exports = function splitSelectors(selectors) {
	if (isAtRule(selectors)) {
		return [selectors];
	}
	var splitted = [];
	var parens = 0;
	var angulars = 0;
	var soFar = '';
	for (var i = 0, len = selectors.length; i < len; i++) {
		var char = selectors[i];
		if (char === '(') {
			parens += 1;
		} else if (char === ')') {
			parens -= 1;
		} else if (char === '[') {
			angulars += 1;
		} else if (char === ']') {
			angulars -= 1;
		} else if (char === ',') {
			if (!parens && !angulars) {
				splitted.push(soFar.trim());
				soFar = '';
				continue;
			}
		}
		soFar += char;
	}
	splitted.push(soFar.trim());
	return splitted;
};

function isAtRule(selector) {
	return selector.indexOf('@') === 0;
}
