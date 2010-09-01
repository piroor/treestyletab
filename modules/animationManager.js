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

 license: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/animationManager.js
*/

/* To work as a JS Code Module (*require jstimer.jsm)
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/jstimer.jsm */
if (typeof window == 'undefined' ||
	(window && typeof window.constructor == 'function')) {
	this.EXPORTED_SYMBOLS = ['animationManager'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/namespace.jsm
	let ns = {};
	try {
		Components.utils.import('resource://treestyletab-modules/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
	if (!('setInterval' in window))
		Components.utils.import('resource://treestyletab-modules/jstimer.jsm', window);
}

(function() {
	const currentRevision = 7;

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
				start     : aRelatedWindow ? aRelatedWindow.mozAnimationStartTime : (new Date()).getTime(),
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
			var task;
			for (var i in this.tasks)
			{
				task = this.tasks[i];
				if (task.task != aTask) continue;
				delete task.task;
				delete task.start;
				delete task.beginning;
				delete task.change;
				delete task.duration;
				delete task.window;
				this.tasks.splice(i, 1);
				this._cleanUpWindows();
				break;
			}
			if (!this.tasks.length)
				this.stop();
		},

		start : function()
		{
			this.stop();
			if (this.tasks.some(function(aTask) {
					return !aTask.window;
				})) {
				this.timer = window.setInterval(
					this.onAnimation,
					this.interval,
					this
				);
			}
			if (this._windows.length) { // Firefox 4-
				this._windows.forEach(function(aWindow) {
					if (this._listeningWindows.indexOf(aWindow) < 0) {
						aWindow.addEventListener('MozBeforePaint', this, false);
						this._listeningWindows.push(aWindow);
					}
					aWindow.mozRequestAnimationFrame();
				}, this);
			}
		},

		stop : function() 
		{
			if (this.timer) {
				window.clearInterval(this.timer);
				this.timer = null;
			}
			if (this._listeningWindows.length) { // Firefox 4-
				this._listeningWindows.forEach(function(aWindow) {
					aWindow.removeEventListener('MozBeforePaint', this, false);
				}, this);
				this._listeningWindows = [];
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
		_listeningWindows : [],

		_isAnimationFrameAvailable : function(aWindow)
		{
			return aWindow && 'mozRequestAnimationFrame' in aWindow;
		},

		_cleanUpWindows : function()
		{
			this._windows = this._windows.filter(function(aWindow) {
				if (this.tasks.some(function(aTask) {
						return aTask.window && this._windows.indexOf(aTask.window) > -1;
					}, this))
					return true;
				let index = this._listeningWindows.indexOf(aWindow);
				if (index > -1) {
					this._listeningWindows.splice(index, 1);
					aWindow.removeEventListener('MozBeforePaint', this, false);
				}
				return false;
			}, this);
		},

		handleEvent : function(aEvent)
		{
			this.onAnimation(this, aEvent);
			this._cleanUpWindows();
			if (this._listeningWindows.indexOf(aEvent.target.defaultView) > -1)
				aEvent.target.defaultView.mozRequestAnimationFrame();
		},

		onAnimation : function(aSelf, aEvent) 
		{
			// task should return true if it finishes.
			var now = aEvent ? aEvent.timeStamp : (new Date()).getTime() ;
			var tasks = aSelf.tasks;
			aSelf.tasks = [null];
			tasks = tasks.filter(function(aTask) {
				if (!aTask)
					return false;
				if (aEvent && aTask.window != aEvent.target.defaultView)
					return true;
				try {
					var time = Math.min(aTask.duration, now - aTask.start);
					var finished = aTask.task(
							time,
							aTask.beginning,
							aTask.change,
							aTask.duration
						);
					return !finished && (time < aTask.duration);
				}
				catch(e) {
				}
				return false;
			});
			aSelf.tasks = aSelf.tasks.slice(1).concat(tasks);
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
