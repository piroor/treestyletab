var EXPORTED_SYMBOLS = ['Deferred'];
var window = {};
var location = { protocol: 'resource:' };
var document = { addEventListener : function() {} };

Components.utils.import('resource://treestyletab-modules/jstimer.jsm', window);
var setTimeout    = window.setTimeout;
var clearTimeout  = window.clearTimeout;
var setInterval   = window.setInterval;
var clearInterval = window.clearInterval;


/* Header::
 * JSDeferred
 * Copyright (c) 2007 cho45 ( www.lowreal.net )
 *
 * http://coderepos.org/share/wiki/JSDeferred
 *
 * Version:: 0.3.0
 * License:: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/* Usage (with jQuery)::
 *
 *     $.deferred.define();
 *
 *     $.get("/hoge").next(function (data) {
 *         alert(data);
 *     }).
 *
 *     parallel([$.get("foo.html"), $.get("bar.html")]).next(function (values) {
 *         log($.map(values, function (v) { return v.length }));
 *         if (values[1].match(/nextUrl:\s*(\S+)/)) {
 *             return $.get(RegExp.$1).next(function (d) {
 *                 return d;
 *             });
 *         }
 *     }).
 *     next(function (d) {
 *         log(d.length);
 *     });
 *
 */


/* function Deferred () //=> constructor
 *
 * `Deferred` function is constructor of Deferred.
 *
 * Sample:
 *     var d = new Deferred();
 *     // or this is shothand of above.
 *     var d = Deferred();
 */
/* function Deferred.prototype.next   (fun) //=> Deferred
 *
 * Create new Deferred and sets `fun` as its callback.
 */
/* function Deferred.prototype.error  (fun) //=> Deferred
 *
 * Create new Deferred and sets `fun` as its errorback.
 *
 * If `fun` not throws error but returns normal value, Deferred treats
 * the given error is recovery and continue callback chain.
 */
/* function Deferred.prototype.call   (val) //=> this
 *
 * Invokes self callback chain.
 */
/* function Deferred.prototype.fail   (err) //=> this
 *
 * Invokes self errorback chain.
 */
/* function Deferred.prototype.cancel (err) //=> this
 *
 * Cancels self callback chain.
 */
function Deferred () { return (this instanceof Deferred) ? this.init() : new Deferred() }
Deferred.ok = function (x) { return x };
Deferred.ng = function (x) { throw  x };
Deferred.prototype = {
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
		if (value instanceof Deferred) {
			value._next = this._next;
		} else {
			if (this._next) this._next._fire(next, value);
		}
		return this;
	}
};

/* function next (fun) //=> Deferred
 *
 * `next` is shorthand for creating new deferred which
 * is called after current queue.
 */
Deferred.next_default = function (fun) {
	var d = new Deferred();
	var id = setTimeout(function () { d.call() }, 0);
	d.canceller = function () { clearTimeout(id) };
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next_faster_way_readystatechange = ((location.protocol == "http:") && !window.opera && /\bMSIE\b/.test(navigator.userAgent)) && function (fun) {
	// MSIE
	var d = new Deferred();
	var t = new Date().getTime();
	if (t - arguments.callee._prev_timeout_called < 150) {
		var cancel = false;
		var script = document.createElement("script");
		script.type = "text/javascript";
		script.src  = "javascript:";
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
Deferred.next_faster_way_Image = ((typeof(Image) != "undefined") && document.addEventListener) && function (fun) {
	// Modern Browsers
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
	img.src = "data:,/ _ / X";
	if (fun) d.callback.ok = fun;
	return d;
};
Deferred.next = Deferred.next_faster_way_readystatechange ||
                Deferred.next_faster_way_Image ||
                Deferred.next_default;

/* function wait (sec) //=> Deferred
 *
 * `wait` returns deferred that will be called after `sec` elapsed
 * with real elapsed time (msec)
 *
 * Sample:
 *     wait(1).next(function (elapsed) {
 *         log(elapsed); //=> may be 990-1100
 *     });
 */
Deferred.wait = function (n) {
	var d = new Deferred(), t = new Date();
	var id = setTimeout(function () {
		d.call((new Date).getTime() - t.getTime());
	}, n * 1000);
	d.canceller = function () { clearTimeout(id) };
	return d;
};

/* function call (fun [, args...]) //=> Deferred
 *
 * `call` function is for calling function asynchronous.
 *
 * Sample:
 *     // like tail recursion
 *     next(function () {
 *         function pow (x, n) {
 *             function _pow (n, r) {
 *                 print([n, r]);
 *                 if (n == 0) return r;
 *                 return call(_pow, n - 1, x * r);
 *             }
 *             return call(_pow, n, 1);
 *         }
 *         return call(pow, 2, 10);
 *     }).
 *     next(function (r) {
 *         print([r, "end"]);
 *     });
 *
 */
Deferred.call = function (f /* , args... */) {
	var args = Array.prototype.slice.call(arguments, 1);
	return Deferred.next(function () {
		return f.apply(this, args);
	});
};

/* function parallel (deferredlist) //=> Deferred
 *
 * `parallel` wraps up `deferredlist` to one deferred.
 * This is useful when some asynchronous resources required.
 *
 * `deferredlist` can be Array or Object (Hash).
 *
 * Sample:
 *     parallel([
 *         $.get("foo.html"),
 *         $.get("bar.html")
 *     ]).next(function (values) {
 *         values[0] //=> foo.html data
 *         values[1] //=> bar.html data
 *     });
 *
 *     parallel({
 *         foo: $.get("foo.html"),
 *         bar: $.get("bar.html")
 *     }).next(function (values) {
 *         values.foo //=> foo.html data
 *         values.bar //=> bar.html data
 *     });
 */
Deferred.parallel = function (dl) {
	if (arguments.length > 1) dl = Array.prototype.slice.call(arguments);
	var ret = new Deferred(), values = {}, num = 0;
	for (var i in dl) if (dl.hasOwnProperty(i)) (function (d, i) {
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

/* function earlier (deferredlist) //=> Deferred
 *
 * Continue process when one deferred in `deferredlist` has completed. Others will cancel.
 * parallel ('and' processing) <=> earlier ('or' processing)
 */
Deferred.earlier = function (dl) {
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


/* function loop (n, fun) //=> Deferred
 *
 * `loop` function provides browser-non-blocking loop.
 * This loop is slow but not stop browser's appearance.
 *
 * Sample:
 *     //=> loop 1 to 100
 *     loop({begin:1, end:100, step:10}, function (n, o) {
 *         for (var i = 0; i < o.step; i++) {
 *             log(n+i);
 *         }
 *     });
 *
 *     //=> loop 10 times
 *     loop(10, function (n) {
 *         log(n);
 *     });
 */
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
				if (ret instanceof Deferred) {
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


/* function repeat (n, fun) //=> Deferred
 *
 * Loop `n` tiems with `fun`.
 * This function automatically return control to browser, if loop time over 20msec.
 * This is useful for huge loop  not to block browser UI.
 *
 * Sample::
 *     repeat(10, function (i) {
 *         i //=> 0,1,2,3,4,5,6,7,8,9
 *     });
 */
Deferred.repeat = function (n, f) {
	var i = 0, end = {}, ret = null;
	return Deferred.next(function () {
		var t = (new Date()).getTime();
		divide: {
			do {
				if (i >= n) break divide;
				ret = f(i++);
			} while ((new Date()).getTime() - t < 20);
			return Deferred.call(arguments.callee);
		}
	});
};

/* function Deferred.register (name, fun) //=> void 0
 *
 * Register `fun` to Deferred prototype for method chain.
 *
 * Sample::
 *     // Deferred.register("loop", loop);
 *
 *     // Global Deferred function
 *     loop(10, function (n) {
 *         print(n);
 *     }).
 *     // Registered Deferred.prototype.loop
 *     loop(10, function (n) {
 *         print(n);
 *     });
 */
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

/* Deferred.connect (func [, opts: { ok : 0, ng : null, target: null} ]) //=> Function //=> Deferred
 *
 * Connect a function with Deferred.  That is, transform a function
 * that takes a callback into one that returns a Deferred object.
 *
 * Sample::
 *     var timeout = Deferred.connect(setTimeout, { target: window, ok: 0 });
 *     timeout(1).next(function () {
 *         alert('after 1 sec');
 *     });
 */
// Allow to pass multiple values to next.
Deferred.Arguments = function (args) { this.args = Array.prototype.slice.call(args, 0) }
Deferred.connect = function (func, obj) {
	if (!obj) obj = {};
	var callbackArgIndex  = obj.ok;
	var errorbackArgIndex = obj.ng;
	var target            = obj.target;

	return function () {
		var d = new Deferred();

		d.next = function (fun) { return this._post("ok", function () {
			fun.apply(this, (arguments[0] instanceof Deferred.Arguments) ? arguments[0].args : arguments);
		}) };

		var args = Array.prototype.slice.call(arguments, 0);
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
}

/* Deferred.retry(retryCount, func [, options = { wait : 0 } ])
 *
 * Try func (returns Deferred) max `retryCount`.
 *
 * Sample::
 *     Deferred.retry(3, function () {
 *         return http.get(...);
 *     }).
 *     next(function (res) {
 *         res //=> response if succeeded
 *     }).
 *     error(function (e) {
 *         e //=> error if all try failed
 *     });
 */
Deferred.retry = function (retryCount, funcDeferred/* funcDeferred() return Deferred */, options) {
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
}

Deferred.define = function (obj, list) {
	if (!list) list = ["parallel", "wait", "next", "call", "loop", "repeat"];
	if (!obj)  obj  = (function getGlobal () { return this })();
	for (var i = 0; i < list.length; i++) {
		var n = list[i];
		obj[n] = Deferred[n];
	}
	return Deferred;
};

