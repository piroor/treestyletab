/**
 * @fileOverview inherit, an alternative for __proto__
 * @author       YUKI "Piro" Hiroshi
 * @contributor  Infocatcher
 * @version      3
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
	var global;
	if (Components.utils.getGlobalForObject)
		global = Components.utils.getGlobalForObject(aParent);
	else
		global = aParent.valueOf.call();
	global = global || this;

	var ObjectClass = global.Object || Object;

	if (!ObjectClass.create) {
		aExtraProperties = aExtraProperties || new ObjectClass;
		aExtraProperties.__proto__ = aParent;
		return aExtraProperties;
	}
	if (aExtraProperties)
		return ObjectClass.create(aParent, toPropertyDescriptors(aExtraProperties));
	else
		return ObjectClass.create(aParent);
}
