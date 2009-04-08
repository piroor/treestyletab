/*
 Animation Task Manager

 Usage:
   window['piro.sakura.ne.jp'].animationManager.task(function() {
     // some animation task runned by interval
     return isFinish; // boolean
   });
   // stop all
   window['piro.sakura.ne.jp'].animationManager.stop();

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/animationManager.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'animationManager' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].animationManager.revision :
			0 ;
	var tasks = !loadedRevision ? [] : window['piro.sakura.ne.jp'].animationManager.tasks ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].animationManager = {
		revision : currentRevision,

		addTask : function(aTask, aBeginningValue, aFinalValue, aDelay) 
		{
			if (!aTask) return;
			this.tasks.push({
				task      : aTask,
				start     : Date.now(),
				beginning : aBeginningValue,
				final     : aFinalValue,
				delay     : aDelay
			});
			if (this.tasks.length > 1) return;
			this.stop();
			this.timer = window.setInterval(
				this.onAnimation,
				this.interval,
				this
			);
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
				delete task.final;
				delete task.delay;
				this.tasks.splice(i, 1);
				break;
			}
			if (!this.tasks.length)
				this.stop();
		},

		stop : function() 
		{
			if (!this.timer) return;
			window.clearInterval(this.timer);
			this.timer = null;
		},

		tasks    : tasks,
		interval : 10,
		timer    : null,

		onAnimation : function(aSelf) 
		{
			// task should return true if it finishes.
			aSelf.tasks = aSelf.tasks.filter(function(aTask) {
				try {
					return !aTask.task(
						Date.now() - aTask.start,
						aTask.beginning,
						aTask.final,
						aTask.delay
					);
				}
				catch(e) {
				}
				return true;
			});
			if (!aSelf.tasks.length)
				aSelf.stop();
		}

	};
})();
