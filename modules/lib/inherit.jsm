/**
 * @fileOverview inherit, an alternative for __proto__
 * @author       YUKI "Piro" Hiroshi
 * @version      1
 *
 * @license
 *   The MIT License, Copyright (c) 2014 YUKI "Piro" Hiroshi.
 *   https://github.com/piroor/fxaddonlib-inherit/blob/master/LICENSE
 * @url http://github.com/piroor/fxaddonlib-inherit
 */

const EXPORTED_SYMBOLS = ['inherit'];

function toPropertyDescriptors(aProperties) {
	var descriptors = {};
	Object.keys(aProperties).forEach(function(aProperty) {
		var description = Object.getOwnPropertyDescriptor(aProperties, aProperty);
		descriptors[aProperty] = description;
	});
	return descriptors;
}

function inherit(aParent, aExtraProperties) {
	if (!Object.create) {
		aExtraProperties.__proto__ = aParent;
		return aExtraProperties;
	}
	if (aExtraProperties)
		return Object.create(aParent, toPropertyDescriptors(aExtraProperties));
	else
		return Object.create(aParent);
}
