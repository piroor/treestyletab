// Original author: ClearCode Inc.
// License: MIT
// Repository: https://github.com/clear-code/js-extended-immutable

var EXPORTED_SYMBOLS = ['ExtendedImmutable'];

function ExtendedImmutable(aImmutable, aExtraProperties) {
  var descriptors = {};
  Object.keys(aExtraProperties).forEach(function(aName) {
    descriptors[aName] = Object.getOwnPropertyDescriptor(aExtraProperties, aName);
  });

  var base = Object.create({}, descriptors);
  return new Proxy(base, {
    getPrototypeOf: function(aTarget) {
      return Object.getPrototypeOf(aImmutable);
    },
    setPrototypeOf: function(aTarget, aPrototype) {
      return Object.setPrototypeOf(aImmutable, aPrototype);
    },
    isExtensible: function(aTarget) {
      return Object.isExtensible(aImmutable);
    },
    preventExtensions: function(aTarget) {
      return Object.preventExtensions(aImmutable);
    },
    getOwnPropertyDescriptor: function(aTarget, aProperty) {
      return Object.getOwnPropertyDescriptor(aImmutable, aProperty);
    },
    defineProperty: function(aTarget, aProperty, aDescriptor) {
      return Object.defineProperty(aImmutable, aProperty, aDescriptor);
    },
    has: function(aTarget, aProperty) {
      return aProperty in aImmutable;
    },
    get: function(aTarget, aName, aReceiver) {
      if (descriptors.hasOwnProperty(aName)) {
        let value;
        if (typeof descriptors[aName].get == 'function')
          value = descriptors[aName].get.call(base);
        else
          value = descriptors[aName].value;

        if (typeof value == 'function')
          return value.bind(base);
        else
          return value;
      }
      var value = aImmutable[aName];
      if (typeof value == 'function')
        return value.bind(aImmutable);
      else
        return value;
    },
    set: function(aTarget, aName, aValue, aReceiver) {
      if (descriptors.hasOwnProperty(aName)) {
        if (typeof descriptors[aName].set == 'function')
          return descriptors[aName].set.call(base, aValue);
        else
          return descriptors[aName].value = aValue;
      }
      return aImmutable[aName] = aValue;
    },
    deleteProperty: function(aTarget, aProperty) {
      delete aImmutable[aProperty];
    },
    enumerate: function(aTarget) {
      return Reflect.enumerate(aImmutable);
    },
    ownKeys: function(aTarget) {
      return Object.getOwnPropertyNames(aImmutable);
    },
    apply: function(aTarget, aThis, aArgs) {
      return aImmutable.apply(aThis, aArgs);
    },
    construct: function(aTarget, aArgs) {
      return new aImmutable(...aArgs);
    }
  });
}
