// Usage:: Components.utils.import('..../jsdeferred.jscodemodule.js');
// JSDeferred 0.4.0 Copyright (c) 2007 cho45 ( www.lowreal.net )
// See http://github.com/cho45/jsdeferred
var EXPORTED_SYMBOLS = ["Deferred"];

function D () {

var timers = [];

function setTimeout (f, i) {
	let timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
	timer.initWithCallback(f, i, timer.TYPE_ONE_SHOT);
	timers.push(timer);
	return timer;
}

function clearTimeout (timer) {
	timers.splice(timers.indexOf(timer), 1);
	timer.cancel();
}


function Deferred () { return (this instanceof Deferred) ? this.init() : new Deferred() }
Deferred.ok = function (x) { return x };
Deferred.ng = function (x) { throw  x };
Deferred.prototype = {
	
	_id : 0xe38286e381ae,

	
	init : function () {
		this._next    = null;
		this.callback = {
			ok: Deferred.ok,
			ng: Deferred.ng
		};
		return this;
	},

	
	next  : function (fun) { return this._post("ok", fun) },

	
	error : function (fun) { return this._post("ng", fun) },

	
	call  : function (val) { return this._fire("ok", val) },

	
	fail  : function (err) { return this._fire("ng", err) },

	
	cancel : function () {
		(this.canceller || function () {})();
		return this.init();
	},

	_post : function (okng, fun) {
		this._next =  new Deferred();
		this._next.callback[okng] = fun;
		return this._next;
	},

	_fire : function (okng, value) {
		var next = "ok";
		try {
			value = this.callback[okng].call(this, value);
		} catch (e) {
			next  = "ng";
			value = e;
			if (Deferred.onerror) Deferred.onerror(e);
		}
		if (Deferred.isDeferred(value)) {
			value._next = this._next;
		} else {
			if (this._next) this._next._fire(next, value);
		}
		return this;
	}
};
Deferred.isDeferred = function (obj) {
	return !!(obj && obj._id == Deferred.prototype._id);
};

Deferred.next_default = function (fun) {
	var d = new Deferred();
	var id = setTimeout(function () { d.call() }, 0);
	d.canceller = function () { clearTimeout(id) };
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_faster_way_readystatechange = ((typeof window === 'object') && (location.protocol == "http:") && !window.opera && /\bMSIE\b/.test(navigator.userAgent)) && function (fun) {
	var d = new Deferred();
	var t = Date.now();
	if (t - arguments.callee._prev_timeout_called < 150) {
		var cancel = false;
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src  = "data:text/javascript,";
		script.onreadystatechange = function () {
			if (!cancel) {
				d.canceller();
				d.call();
			}
		};
		d.canceller = function () {
			if (!cancel) {
				cancel = true;
				script.onreadystatechange = null;
				document.body.removeChild(script);
			}
		};
		document.body.appendChild(script);
	} else {
		arguments.callee._prev_timeout_called = t;
		var id = setTimeout(function () { d.call() }, 0);
		d.canceller = function () { clearTimeout(id) };
	}
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_faster_way_Image = ((typeof window === 'object') && (typeof(Image) != "undefined") && !window.opera && document.addEventListener) && function (fun) {
	var d = new Deferred();
	var img = new Image();
	var handler = function () {
		d.canceller();
		d.call();
	};
	img.addEventListener("load", handler, false);
	img.addEventListener("error", handler, false);
	d.canceller = function () {
		img.removeEventListener("load", handler, false);
		img.removeEventListener("error", handler, false);
	};
	img.src = "data:image/png," + Math.random();
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_tick = (typeof process === 'object' && typeof process.nextTick === 'function') && function (fun) {
	var d = new Deferred();
	process.nextTick(function() { d.call() });
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next = Deferred.next_faster_way_readystatechange ||
                Deferred.next_faster_way_Image ||
                Deferred.next_tick ||
                Deferred.next_default;

Deferred.chain = function () {
	var chain = Deferred.next();
	for (var i = 0, len = arguments.length; i < len; i++) (function (obj) {
		switch (typeof obj) {
			case "function":
				var name = null;
				try {
					name = obj.toString().match(/^\s*function\s+([^\s()]+)/)[1];
				} catch (e) { }
				if (name != "error") {
					chain = chain.next(obj);
				} else {
					chain = chain.error(obj);
				}
				break;
			case "object":
				chain = chain.next(function() { return Deferred.parallel(obj) });
				break;
			default:
				throw "unknown type in process chains";
		}
	})(arguments[i]);
	return chain;
};

Deferred.wait = function (n) {
	var d = new Deferred(), t = Date.now();
	var id = setTimeout(function () {
		d.call(Date.now() - t);
	}, n * 1000);
	d.canceller = function () { clearTimeout(id) };
	return d;
};

Deferred.call = function (fun) {
	var args = Array.prototype.slice.call(arguments, 1);
	return Deferred.next(function () {
		return fun.apply(this, args);
	});
};

Deferred.parallel = function (dl) {
	if (arguments.length > 1) dl = Array.prototype.slice.call(arguments);
	var ret = new Deferred(), values = {}, num = 0;
	for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
		if (typeof d == "function") d = Deferred.next(d);
		d.next(function (v) {
			values[i] = v;
			if (--num <= 0) {
				if (dl instanceof Array) {
					values.length = dl.length;
					values = Array.prototype.slice.call(values, 0);
				}
				ret.call(values);
			}
		}).error(function (e) {
			ret.fail(e);
		});
		num++;
	})(dl[i], i);

	if (!num) Deferred.next(function () { ret.call() });
	ret.canceller = function () {
		for (var i in dl) if (dl.hasOwnProperty(i)) {
			dl[i].cancel();
		}
	};
	return ret;
};

Deferred.earlier = function (dl) {
	if (arguments.length > 1) dl = Array.prototype.slice.call(arguments);
	var ret = new Deferred(), values = {}, num = 0;
	for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
		d.next(function (v) {
			values[i] = v;
			if (dl instanceof Array) {
				values.length = dl.length;
				values = Array.prototype.slice.call(values, 0);
			}
			ret.canceller();
			ret.call(values);
		}).error(function (e) {
			ret.fail(e);
		});
		num++;
	})(dl[i], i);

	if (!num) Deferred.next(function () { ret.call() });
	ret.canceller = function () {
		for (var i in dl) if (dl.hasOwnProperty(i)) {
			dl[i].cancel();
		}
	};
	return ret;
};


Deferred.loop = function (n, fun) {
	var o = {
		begin : n.begin || 0,
		end   : (typeof n.end == "number") ? n.end : n - 1,
		step  : n.step  || 1,
		last  : false,
		prev  : null
	};
	var ret, step = o.step;
	return Deferred.next(function () {
		function _loop (i) {
			if (i <= o.end) {
				if ((i + step) > o.end) {
					o.last = true;
					o.step = o.end - i + 1;
				}
				o.prev = ret;
				ret = fun.call(this, i, o);
				if (Deferred.isDeferred(ret)) {
					return ret.next(function (r) {
						ret = r;
						return Deferred.call(_loop, i + step);
					});
				} else {
					return Deferred.call(_loop, i + step);
				}
			} else {
				return ret;
			}
		}
		return (o.begin <= o.end) ? Deferred.call(_loop, o.begin) : null;
	});
};


Deferred.repeat = function (n, fun) {
	var i = 0, end = {}, ret = null;
	return Deferred.next(function () {
		var t = Date.now();
		divide: {
			do {
				if (i >= n) break divide;
				ret = fun(i++);
			} while (Date.now() - t < 20);
			return Deferred.call(arguments.callee);
		}
		return null;
	});
};

Deferred.register = function (name, fun) {
	this.prototype[name] = function () {
		var a = arguments;
		return this.next(function () {
			return fun.apply(this, a);
		});
	};
};

Deferred.register("loop", Deferred.loop);
Deferred.register("wait", Deferred.wait);

Deferred.connect = function (funo, options) {
	var target, func, obj;
	if (typeof arguments[1] == "string") {
		target = arguments[0];
		func   = target[arguments[1]];
		obj    = arguments[2] || {};
	} else {
		func   = arguments[0];
		obj    = arguments[1] || {};
		target = obj.target;
	}

	var partialArgs       = obj.args ? Array.prototype.slice.call(obj.args, 0) : [];
	var callbackArgIndex  = isFinite(obj.ok) ? obj.ok : obj.args ? obj.args.length : undefined;
	var errorbackArgIndex = obj.ng;

	return function () {
		var d = new Deferred().next(function (args) {
			var next = this._next.callback.ok;
			this._next.callback.ok = function () {
				return next.apply(this, args.args);
			};
		});

		var args = partialArgs.concat(Array.prototype.slice.call(arguments, 0));
		if (!(isFinite(callbackArgIndex) && callbackArgIndex !== null)) {
			callbackArgIndex = args.length;
		}
		var callback = function () { d.call(new Deferred.Arguments(arguments)) };
		args.splice(callbackArgIndex, 0, callback);
		if (isFinite(errorbackArgIndex) && errorbackArgIndex !== null) {
			var errorback = function () { d.fail(arguments) };
			args.splice(errorbackArgIndex, 0, errorback);
		}
		Deferred.next(function () { func.apply(target, args) });
		return d;
	}
};
Deferred.Arguments = function (args) { this.args = Array.prototype.slice.call(args, 0) };

Deferred.retry = function (retryCount, funcDeferred, options) {
	if (!options) options = {};

	var wait = options.wait || 0;
	var d = new Deferred();
	var retry = function () {
		var m = funcDeferred(retryCount);
		m.
			next(function (mes) {
				d.call(mes);
			}).
			error(function (e) {
				if (--retryCount <= 0) {
					d.fail(['retry failed', e]);
				} else {
					setTimeout(retry, wait * 1000);
				}
			});
	};
	setTimeout(retry, 0);
	return d;
};

Deferred.methods = ["parallel", "wait", "next", "call", "loop", "repeat", "chain"];
Deferred.define = function (obj, list) {
	if (!list) list = Deferred.methods;
	if (!obj)  obj  = (function getGlobal () { return this })();
	for (var i = 0; i < list.length; i++) {
		var n = list[i];
		obj[n] = Deferred[n];
	}
	return Deferred;
};

this.Deferred = Deferred;



Deferred.postie_for_message_manager = function (manager) {
	var ret = {
			__proto__ : manager,
			__noSuchMethod__ : function (name, args) {
				return manager[name].apply(manager, args);
			}
		};
	var id  = 0;
	var cb  = {};
	var mm  = [];

	var postieId = Date.now() + ':' + parseInt(Math.random() * 65000);

	var messageListener = function (message) {
			message = message.json;
			if (message.init) {
				for (let i = 0, it; it = mm[i]; i++) {
					manager.sendAsyncMessage(postieId+':request', it);
				}
				mm = null;
			} else  {
				let c = cb[message.id];
				if (c) c(message.value, message.error);
			}
		};
	manager.addMessageListener(postieId+':response', messageListener);

	manager.loadFrameScript('data:application/javascript,'+encodeURIComponent(
		('(function(_global) {' +
		'  var [Deferred, timers] = %JSDEFERRED%();' +
		'  var _onMessage = function (message) {' +
		'      switch (message.name) {' +
		'        case "%ID%:request":' +
		'          var data = { id : message.json.id }' +
		'          Deferred' +
		'            .next(function () {' +
		'              return eval(message.json.code);' +
		'            })' +
		'            .next(function (value) {' +
		'              data.value = value;' +
		'              sendAsyncMessage("%ID%:response", data);' +
		'            })' +
		'            .error(function (error) {' +
		'              data.error = error;' +
		'              sendAsyncMessage("%ID%:response", data);' +
		'            });' +
		'          break;' +

		'        case "%ID%:destroy":' +
		'          removeMessageListener("%ID%:request", onMessage);' +
		'          removeMessageListener("%ID%:destroy", onMessage);' +
		'          timers.forEach(function(aTimer) {' +
		'            aTimer.cancel();' +
		'          });' +
		'          timers = undefined;' +
		'          _onMessage = undefined;' +
		'          _global = undefined;' +
		'          Deferred = undefined;' +
		'          break;' +
		'      }' +
		'    };' +
		'  addMessageListener("%ID%:request", _onMessage);' +
		'  addMessageListener("%ID%:destroy", _onMessage);' +
		'  sendAsyncMessage("%ID%:response", { id : -1, init : true });' +
		'})(this);')
		.replace(/%ID%/g, postieId)
		.replace(/%JSDEFERRED%/, D.toSource())
	), false);

	ret.post = function (args, code) {
		var deferred = new Deferred();
		args = Array.prototype.slice.call(arguments, 0);
		code = args.pop();

		code = (typeof code == 'function') ? code.toSource() : 'function () {' + code + '}';

		var mes = {
			id : id++,
			code : '(' + code + ').apply(_global, ' + JSON.stringify(args) + ')'
		};

		cb[mes.id] = function (v, e) { e ? deferred.fail(e) : deferred.call(v) };

		if (mm) {
			mm.push(mes);
		} else {
			manager.sendAsyncMessage(postieId+':request', mes);
		}

		return deferred;
	};

	ret.destroy = function () {
		manager.sendAsyncMessage(postieId+':destroy');
		manager.removeMessageListener(postieId+':response', messageListener);
	};

	return ret;
};

Deferred.postie = function (target) {
	if (target instanceof Components.interfaces.nsIFrameMessageManager)
		return Deferred.postie_for_message_manager(target);
	else
		throw new Error('unknown type object was given to Deferred.postie().\n'+target);
};

Deferred.Deferred = Deferred;
return [Deferred, timers];
}

var [Deferred, timers] = D();
