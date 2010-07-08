/*
 JavaScript Timer Library

 Usage:
   var namespace = {};
   Components.utils.import('resource://foo-modules/jstimer.jsm', namespace);

   var callback = function(aMessage) { alert(aMessage); };
   var timeout = namespace.setTimeout(callback, 1000, 'OK');
   namespace.clearTimeout(timeout);
   var interval = namespace.setInterval(callback, 1000, 'OK');
   namespace.clearInterval(interval);

 lisence: The MIT License, Copyright (c) 2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/jstimer.jsm
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/jstimer.test.js
*/

var Cc = Components.classes;
var Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [
		'setTimeout',
		'clearTimeout',
		'setInterval',
		'clearInterval'
	];

function setTimeout()
{
	var args = Array.slice(arguments);
	var callback = args.shift();
	var timeout = args.shift();
	if (typeof callback != 'string') {
		let source = callback;
		callback = function() { source.apply(getGlobal(), args); };
		callback.source = source;
	}
	return (new Timer(
		callback,
		timeout,
		Ci.nsITimer.TYPE_ONE_SHOT,
		getOwnerWindowFromCaller(arguments.callee.caller)
	)).id;
}

function clearTimeout(aId)
{
	Timer.cancel(aId);
}

function setInterval()
{
	var args = Array.slice(arguments);
	var callback = args.shift();
	var interval = args.shift();
	if (typeof callback != 'string') {
		let source = callback;
		callback = function() { source.apply(getGlobal(), args); };
		callback.source = source;
	}
	return (new Timer(
		callback,
		interval,
		Ci.nsITimer.TYPE_REPEATING_SLACK,
		getOwnerWindowFromCaller(arguments.callee.caller)
	)).id;
}

function clearInterval(aId)
{
	Timer.cancel(aId);
}


function Timer(aCallback, aTime, aType, aOwner) {
	this.finished = false;
	this.callback = aCallback;
	this.type = aType;
	this.owner = aOwner;
	this.init(aTime);

	Timer.instances[this.id] = this;
}
Timer.prototype = {
	init : function(aTime, aType)
	{
		this.id = parseInt(Math.random() * 65000)
		this.timer = Cc['@mozilla.org/timer;1']
						.createInstance(Ci.nsITimer);
		this.timer.init(this, aTime, this.type);
	},
	cancel : function()
	{
		if (!this.timer) return;

		this.timer.cancel();
		delete this.timer;
		delete this.callback;
		this.finished = true;

		delete Timer.instances[this.id];
	},
	observe : function(aSubject, aTopic, aData)
	{
		if (aTopic != 'timer-callback') return;
		this.notify(aSubject);
	},
	notify : function(aTimer)
	{
		if (this.owner && this.owner.closed) {
			dump('jstimer.jsm:'+
				'  timer is stopped because the owner window was closed.\n'+
				'  type: '+(this.type == Ci.nsITimer.TYPE_ONE_SHOT ? 'TYPE_ONE_SHOT' : 'TYPE_REPEATING_SLACK' )+'\n'+
				'  callback: '+(this.callback.source || this.callback)+'\n');
			this.cancel();
			return;
		}

		if (typeof this.callback == 'function')
			this.callback();
		else
			evalInSandbox(this.callback);

		if (this.type == Ci.nsITimer.TYPE_ONE_SHOT)
			this.cancel();
	}
};
Timer.instances = {};
Timer.cancel = function(aId) {
	var timer = this.getInstanceById(aId);
	if (timer)
		timer.cancel();
};
Timer.getInstanceById = function(aId) {
	return this.instances[aId] || null ;
};

function evalInSandbox(aCode, aSandboxOwner)
{
	var sandbox = new Components.utils.Sandbox(aSandboxOwner || 'about:blank');
	return Components.utils.evalInSandbox(aCode, sandbox);
}

function getGlobal()
{
	return (function() { return this; })();
}

function getOwnerWindowFromCaller(aCaller)
{
	try {
		var global = aCaller.valueOf.call(null);
		if (global && global instanceof Ci.nsIDOMWindow)
			return global;
	}
	catch(e) {
	}
	return null;
}
