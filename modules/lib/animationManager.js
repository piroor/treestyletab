/*
 Animation Task Manager

 Usage:
   window['piro.sakura.ne.jp'].animationManager.addTask(
     function(aTime, aBeginningValue, aTotalChange, aDuration) {
       // some animation task runned by interval
       var current = someEasingFunction(aTime, aBeginningValue, aTotalChange, aDuration);
       target.style.left = current+'px';
       return aTime > aDuration; // return true if the animation finished.
     },
     100, // beginning
     200, // total change (so, the final value will be 100+200=300)
     250, // msec, duration
     window // the window (used by Firefox 4 animation frame API)
   );
   // stop all
   window['piro.sakura.ne.jp'].animationManager.stop();
   // restart after doing something
   window['piro.sakura.ne.jp'].animationManager.start();

 license: The MIT License, Copyright (c) 2009-2012 YUKI "Piro" Hiroshi
   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 original:
   http://github.com/piroor/fxaddonlibs/blob/master/animationManager.js
*/

/* To work as a JS Code Module (*require jstimer.jsm)
   http://github.com/piroor/fxaddonlibs/blob/master/jstimer.jsm */
if (typeof window == 'undefined' ||
	(window && typeof window.constructor == 'function')) {
	this.EXPORTED_SYMBOLS = ['animationManager'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://github.com/piroor/fxaddonlibs/blob/master/namespace.jsm
	let ns = {};
	try {
		Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
	if (!('setInterval' in window))
		Components.utils.import('resource://treestyletab-modules/lib/jstimer.jsm', window);
}

(function() {
	const currentRevision = 14;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'animationManager' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].animationManager.revision :
			0 ;
	var tasks = !loadedRevision ? [] : window['piro.sakura.ne.jp'].animationManager.tasks ;
	var windows = !loadedRevision ? [] : window['piro.sakura.ne.jp'].animationManager._windows || [] ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	if (tasks.length)
		window['piro.sakura.ne.jp'].animationManager.stop();

	window['piro.sakura.ne.jp'].animationManager = {
		revision : currentRevision,

		addTask : function(aTask, aBeginningValue, aTotalChange, aDuration, aRelatedWindow) 
		{
			if (!aTask) return;

			if (this._isAnimationFrameAvailable(aRelatedWindow)) {
				if (this._windows.indexOf(aRelatedWindow) < 0)
					this._windows.push(aRelatedWindow);
			}
			else {
				aRelatedWindow = null;
			}

			this.tasks.push({
				task      : aTask,
				start     : aRelatedWindow ? aRelatedWindow.mozAnimationStartTime : Date.now(),
				beginning : aBeginningValue,
				change    : aTotalChange,
				duration  : aDuration,
				window    : aRelatedWindow
			});

			if (this.tasks.length == 1)
				this.start();
		},

		removeTask : function(aTask) 
		{
			if (!aTask) return;
			for (let i = this.tasks.length - 1; i > -1; i--)
			{
				let registeredTask = this.tasks[i];
				if (registeredTask) {
					if (registeredTask.task != aTask)
						continue;
					delete registeredTask.task;
					delete registeredTask.start;
					delete registeredTask.beginning;
					delete registeredTask.change;
					delete registeredTask.duration;
					delete registeredTask.window;
				}
				this.tasks.splice(i, 1);
			}
			this._cleanUpWindows();
			if (!this.tasks.length)
				this.stop();
		},

		start : function()
		{
			this.stop();
			if (this.tasks.some(function(aTask) {
					return aTask && !aTask.window;
				})) {
				this.timer = window.setInterval(
					this.onAnimation,
					this.interval,
					this
				);
			}
			if (this._windows.length) { // Firefox 4-
				this._windows.forEach(function(aWindow) {
					var index = this._animatingWindows.indexOf(aWindow);
					var callback;
					if (index < 0) {
						let self = this;
						callback = function() {
							self.processAnimationFrame(aWindow);
						};
						this._animatingWindowCallbacks.push(callback);
						this._animatingWindows.push(aWindow);

						this._animatingWindowSafetyTimers.push(window.setTimeout(function(aSelf) {
							aSelf.processAnimationFrame(aWindow);
						}, 1000, this));
					}
					else {
						callback = this._animatingWindowCallbacks[index];
					}
					aWindow.mozRequestAnimationFrame(callback);
				}, this);
			}
		},

		stop : function() 
		{
			if (this.timer) {
				window.clearInterval(this.timer);
				this.timer = null;
			}
			if (this._animatingWindows.length) { // Firefox 4-
				this._animatingWindows.forEach(function(aWindow, aIndex) {
					window.clearTimeout(this._animatingWindowSafetyTimers[aIndex]);
				}, this);
				this._animatingWindows = [];
				this._animatingWindowSafetyTimers = [];
				this._animatingWindowCallbacks = [];
			}
		},

		removeAllTasks : function()
		{
			this.stop();
			this.tasks = [];
			this._windows = [];
		},

		tasks    : tasks,
		interval : 10,
		timer    : null,

		// Firefox 4 animation frame API
		_windows : windows,
		_animatingWindows : [],
		_animatingWindowSafetyTimers : [],
		_animatingWindowCallbacks : [],

		_isAnimationFrameAvailable : function(aWindow)
		{
			return aWindow && 'mozRequestAnimationFrame' in aWindow;
		},

		_cleanUpWindows : function()
		{
			this._windows = this._windows.filter(function(aWindow) {
				if (this.tasks.some(function(aTask) {
						return aTask && aTask.window && this._windows.indexOf(aTask.window) > -1;
					}, this))
					return true;
				let index = this._animatingWindows.indexOf(aWindow);
				if (index > -1) {
					let timer = this._animatingWindowSafetyTimers[index];
					if (timer)
						window.clearTimeout(timer);
					this._animatingWindows.splice(index, 1);
					this._animatingWindowSafetyTimers.splice(index, 1);
					this._animatingWindowCallbacks.splice(index, 1);
				}
				return false;
			}, this);
		},

		processAnimationFrame : function(aWindow)
		{
			var index = this._animatingWindows.indexOf(aWindow);
			if (index > -1) {
				let timer = this._animatingWindowSafetyTimers[index];
				if (timer) window.clearTimeout(timer);
				this._animatingWindowSafetyTimers[index] = null;
			}
			this.onAnimation(this, aWindow);
			this._cleanUpWindows();
			if (index > -1 && this._animatingWindowCallbacks[index])
				aWindow.mozRequestAnimationFrame(this._animatingWindowCallbacks[index]);
		},

		onAnimation : function(aSelf, aWindow) 
		{
			// task should return true if it finishes.
			var now = Date.now();
			for (let i = aSelf.tasks.length - 1; i > -1; i--)
			{
				let task = aSelf.tasks[i];
				try {
					if (task) {
						if (aWindow && task.window != aWindow)
							continue;
						let time = Math.min(task.duration, now - task.start);
						let finished = task.task(
								time,
								task.beginning,
								task.change,
								task.duration
							);
						if (!finished && (time < task.duration))
							continue;
					}
				}
				catch(e) {
					dump(e+'\n'+e.stack+'\n');
				}
				aSelf.tasks.splice(i, 1);
			}
			if (!aSelf.tasks.length)
				aSelf.stop();
		}

	};

	if (tasks.length)
		window['piro.sakura.ne.jp'].animationManager.start();
})();

if (window != this) { // work as a JS Code Module
	this.animationManager = window['piro.sakura.ne.jp'].animationManager;
}
