/**
 * @fileOverview inherit, an alternative for __proto__
 * @author       YUKI "Piro" Hiroshi
 * @contributor  Infocatcher
 * @version      4
 *
 * @license
 *   The MIT License, Copyright (c) 2014-2016 YUKI "Piro" Hiroshi.
 *   https://github.com/piroor/fxaddonlib-inherit/blob/master/LICENSE
 * @url http://github.com/piroor/fxaddonlib-inherit
 */

var EXPORTED_SYMBOLS = ['inherit'];

function toPropertyDescriptors(aProperties) {
	var descriptors = {};
	Object.keys(aProperties).forEach(function(aProperty) {
		var description = Object.getOwnPropertyDescriptor(aProperties, aProperty);
		descriptors[aProperty] = description;
	});
	return descriptors;
}

function inherit(aParent, aExtraProperties, aObjectClass) {
	aObjectClass = aObjectClass || Object;
	if (aExtraProperties)
		return aObjectClass.create(aParent, toPropertyDescriptors(aExtraProperties));
	else
		return aObjectClass.create(aParent);
}

