/*
 UI Operations Global Undo History Manager

 Usage:
   var OH = window['piro.sakura.ne.jp'].operationHistory;

   // window specific history
   OH.doUndoableTask(
     // the task which is undo-able (optional)
     function() {
       MyService.myProp = newValue;
     },

     // name of history (optional)
     'MyAddonFeature',

     // target window for the history (optional)
     window,

     // history item
     { label  : 'Change tabbar position',
       onUndo : function() { MyService.myProp = oldValue; },
       // "onRedo" is optional. If you don't specify it,
       // the undoable task becomes onRedo automatically.
       onRedo : function() { MyService.myProp = newValue; } }
   );
   OH.undo('MyAddonFeature', window);
   OH.redo('MyAddonFeature', window);

   // global history (not associated to window)
   OH.doUndoableTask(
     function() { ... }, // task
     'MyAddonFeature',
     { ... }
   );
   OH.undo('MyAddonFeature');

   // anonymous, window specific
   OH.doUndoableTask(function() { ... }, { ... }, window);
   OH.undo(window);

   // anonymous, global
   OH.doUndoableTask(function() { ... }, { ... });
   OH.undo();

   // When you want to use "window" object in the global history,
   // you should use the ID string instead of the "window" object
   // to reduce memory leak. For example...
   OH.doUndoableTask(
     function() {
       targetWindow.MyAddonService.myProp = newValue;
     },
     {
       id : OH.getWindowId(targetWindow),
       onUndo : function() {
         var w = OH.getWindowById(this.id);
         w.MyAddonService.myProp = oldValue;
       }
     }
   );

   // enumerate history entries
   var history = OH.getHistory('MyAddonFeature', window); // options are same to undo/redo
   OH.entries.forEach(function(aEntry, aIndex) {
     var item = MyService.appendItem(aEntry.label);
     if (aIndex == history.index)
       item.setAttribute('checked', true);
   });

 lisence: The MIT License, Copyright (c) 2009-2010 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/operationHistory.js
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/operationHistory.test.js
*/
(function() {
	const currentRevision = 16;
	const DEBUG = false;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'operationHistory' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].operationHistory.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var db = {};
	if (loadedRevision) {
		db = window['piro.sakura.ne.jp'].operationHistory._db ||
				window['piro.sakura.ne.jp'].operationHistory._tables; // old name
		window['piro.sakura.ne.jp'].operationHistory.destroy();
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	function log() {
		if (!DEBUG) return;
		Cc['@mozilla.org/fuel/application;1']
			.getService(Ci.fuelIApplication)
			.console
			.log(Array.slice(arguments).join('\n'));
	}

	window['piro.sakura.ne.jp'].operationHistory = {
		revision : currentRevision,

		MAX_ENTRIES : 999,
		WINDOW_ID : 'ui-operation-global-history-window-id',

		// old name, for backward compatibility
		addEntry : function()
		{
			this.doUndoableTask.apply(this, arguments);
		},

		doUndoableTask : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			log('doUndoableTask start ('+options.name+' for '+options.windowId+')');
			var history = options.history;
			var entries = history.entries;
			var metaData = history.metaData;
			var error;
			var wasInUndoableTask = history._inUndoableTask;

			if (!wasInUndoableTask)
				history._inUndoableTask = true;

			var entry = options.entry;
			if (!this._doingUndo && entry) {
				log('register new entry to history\n  '+entry.label);
				let f = this._getAvailableFunction(entry.onRedo, entry.onredo, entry.redo);
				if (!f && !entry.onRedo && !entry.onredo && !entry.redo && options.task)
					entry.onRedo = options.task;

				if (wasInUndoableTask) {
					metaData[metaData.length-1].children.push(entry);
					log(' => child level ('+(metaData[metaData.length-1].children.length-1)+')');
				}
				else {
					entries = entries.slice(0, history.index+1);
					entries.push(entry);
					entries = entries.slice(-this.MAX_ENTRIES);

					metaData = metaData.slice(0, history.index+1);
					metaData.push(new UIHistoryMetaData());
					metaData = metaData.slice(-this.MAX_ENTRIES);

					history.entries = entries;
					history.metaData = metaData;
					history.index = entries.length;
					log(' => top level ('+(entries.length-1)+')');
				}
			}

			var firstContinuation;
			var continuationCall = { called : false, allowed : false };
			try {
				if (options.task)
					options.task.call(
						this,
						{
							level   : 0,
							parent  : null,
							done    : false,
							manager : this,
							getContinuation : function() {
								let continuation = this.manager._getContinuation(
										!firstContinuation && wasInUndoableTask ? 'null' : 'undoable',
										options,
										continuationCall
									);
								if (!firstContinuation)
									firstContinuation = continuation;
								return continuation;
							}
						}
					);
			}
			catch(e) {
				log(e);
				error = e;
			}

			continuationCall.allowed = true;
			if (!firstContinuation || continuationCall.called) {
				if (!wasInUndoableTask)
					delete history._inUndoableTask;

				log('  => doUndoableTask finish');
			}

			if (error)
				throw error;
		},

		getHistory : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			return {
				entries  : history.entries,
				metaData : history.metaData,
				index    : Math.max(0, Math.min(history.entries.length-1, history.index))
			};
		},

		undo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			log('undo start ('+history.index+' / '+history.entries.length+', '+options.name+' for '+options.windowId+', '+this._doingUndo+')');
			if (history.index < 0 || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			var firstContinuation;
			var continuationCall = { called : false, allowed : false };
			while (processed === false && history.index > -1)
			{
				let entry = history.entries[history.index];
				let metaData = history.metaData[history.index];
				--history.index;
				if (!entry) continue;
				log('  '+(history.index+1)+' '+entry.label);
				let done = false;
				[entry].concat(metaData.children).forEach(function(aEntry, aIndex) {
					log('    level '+(aIndex)+' '+aEntry.label);
					let f = this._getAvailableFunction(aEntry.onUndo, aEntry.onundo, aEntry.undo);
					try {
						if (f) {
							let info = {
									level   : aIndex,
									parent  : (aIndex ? entry.data : null ),
									done    : processed && done,
									manager : this,
									getContinuation : function() {
										continuation = this.manager._getContinuation(
												firstContinuation ? 'null' : 'undo',
												options,
												continuationCall
											);
										if (!firstContinuation)
											firstContinuation = continuation;
										return continuation;
									}
								};
							let oneProcessed = f.call(aEntry, info);
							done = true;
							if (oneProcessed !== false)
								processed = oneProcessed;
						}
						else {
							processed = true;
						}
					}
					catch(e) {
						log(e);
						error = e;
					}
				}, this);
				this._dispatchEvent('UIOperationGlobalHistoryUndo', options, entry, done);
			}
			continuationCall.allowed = true;
			if (!firstContinuation || continuationCall.called) {
				this._doingUndo = false;
				log('  => undo finish');
			}

			if (error)
				throw error;

			return true;
		},

		redo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			var max = history.entries.length;
			log('redo start ('+history.index+' / '+max+', '+options.name+' for '+options.windowId+', '+this._doingUndo+')');
			if (history.index >= max || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			var firstContinuation;
			var continuationCall = { called : false, allowed : false };
			while (processed === false && history.index < max)
			{
				++history.index;
				let entry = history.entries[history.index];
				let metaData = history.metaData[history.index];
				if (!entry) continue;
				log('  '+(history.index)+' '+entry.label);
				let done = false;
				[entry].concat(metaData.children).forEach(function(aEntry, aIndex) {
					log('    level '+(aIndex)+' '+aEntry.label);
					let f = this._getAvailableFunction(aEntry.onRedo, aEntry.onredo, aEntry.redo);
					let done = false;
					try {
						if (f) {
							let info = {
									level   : aIndex,
									parent  : (aIndex ? entry.data : null ),
									done    : processed && done,
									manager : this,
									getContinuation : function() {
										continuation = this.manager._getContinuation(
												firstContinuation ? 'null' : 'redo',
												options,
												continuationCall
											);
										if (!firstContinuation)
											firstContinuation = continuation;
										return continuation;
									}
								};
							let oneProcessed = f.call(aEntry, info);
							done = true;
							if (oneProcessed !== false)
								processed = oneProcessed;
						}
						else {
							processed = true;
						}
					}
					catch(e) {
						log(e);
						error = e;
					}
				}, this);
				this._dispatchEvent('UIOperationGlobalHistoryRedo', options, entry.data, done);
			}
			continuationCall.allowed = true;
			if (!firstContinuation || continuationCall.called) {
				this._doingUndo = false;
				log('  => redo finish');
			}

			if (error)
				throw error;

			return true;
		},

		getWindowId : function(aWindow, aDefaultId)
		{
			var root = aWindow.document.documentElement;
			var id = root.getAttribute(this.WINDOW_ID) || aDefaultId;
			try {
				if (!id)
					id = this.SessionStore.getWindowValue(aWindow, this.WINDOW_ID);
			}
			catch(e) {
			}

			// When the ID has been already used by other window,
			// we have to create new ID for this window.
			var windows = this._getWindowsById(id);
			var forceNewId = windows.length && (windows.length > 1 || windows[0] != aWindow);

			if (!id || forceNewId)
				id = 'window-'+Date.now()+parseInt(Math.random() * 65000);

			if (root.getAttribute(this.WINDOW_ID) != id) {
				root.setAttribute(this.WINDOW_ID, id);
				try {
					this.SessionStore.setWindowValue(aWindow, this.WINDOW_ID, id);
				}
				catch(e) {
				}
			}
			return id;
		},

		getWindowById : function(aId)
		{
			var targets = this.WindowMediator.getZOrderDOMWindowEnumerator(null, true);
			while (targets.hasMoreElements())
			{
				let target = targets.getNext().QueryInterface(Ci.nsIDOMWindowInternal);
				if (aId == this.getWindowId(target))
					return target;
			}
			return null;
		},


		/* PRIVATE METHODS */

		_doingUndo : false,
		_db : db,

		initialized : false,

		init : function()
		{
			// inherit history table from existing window
			var targets = this.WindowMediator.getZOrderDOMWindowEnumerator(null, true);
			while (targets.hasMoreElements())
			{
				let target = targets.getNext().QueryInterface(Ci.nsIDOMWindowInternal);
				if (
					'piro.sakura.ne.jp' in target &&
					'operationHistory' in target['piro.sakura.ne.jp'] &&
					target['piro.sakura.ne.jp'].operationHistory.initialized
					) {
					this._db = target['piro.sakura.ne.jp'].operationHistory._db;
					break;
				}
			}

			window.addEventListener('unload', this, false);

			this.initialized = true;
		},

		destroy : function()
		{
			window.removeEventListener('unload', this, false);
		},

		_dispatchEvent : function(aType, aOptions, aEntry, aDone)
		{
			var d = aOptions.window ? aOptions.window.document : document ;
			var event = d.createEvent('Events');
			event.initEvent(aType, true, false);
			event.name  = aOptions.name;
			event.entry = aEntry;
			event.data  = aEntry; // old name
			event.done  = aDone;
			d.dispatchEvent(event);
		},

		_getOptionsFromArguments : function(aArguments)
		{
			var w = null, name, entry = null, task = null;
			Array.slice(aArguments).some(function(aArg) {
				if (aArg instanceof Ci.nsIDOMWindow)
					w = aArg;
				else if (typeof aArg == 'string')
					name = aArg;
				else if (typeof aArg == 'function')
					task = aArg;
				else if (aArg)
					entry = aArg;

				return (w && name && entry && task);
			});

			if (!name)
				name = w ? 'window' : 'global' ;

			var windowId = w ? this.getWindowId(w) : null ;
			var table = this._getTable(name, w);

			return {
				name     : name,
				window   : w,
				windowId : windowId,
				entry    : entry,
				history  : table,
				task     : task
			};
		},

		_getTable : function(aName, aWindow)
		{
			aName = encodeURIComponent(aName);

			var windowId = aWindow ? this.getWindowId(aWindow) : null ;
			if (windowId)
				aName += '::'+windowId;

			if (!(aName in this._db)) {
				this._db[aName] = new UIHistory(aWindow, windowId);
			}

			return this._db[aName];
		},

		_getContinuation : function(aType, aOptions, aCall)
		{
			var continuation;
			var history = aOptions.history;
			var self = this;
			switch (aType)
			{
				case 'undoable':
					continuation = function() {
						if (aCall.allowed)
							delete history._inUndoableTask;
						aCall.called = true;
						log('  => doUndoableTask finish (delayed)');
					};
					self = null;
					break;

				case 'undo':
					continuation = function() {
						if (aCall.allowed)
							self._doingUndo = false;
						aCall.called = true;
						log('  => undo finish (delayed)');
					};
					history = null;
					break;

				case 'redo':
					continuation = function() {
						if (aCall.allowed)
							self._doingUndo = false;
						aCall.called = true;
						log('  => redo finish (delayed)');
					};
					history = null;
					break;

				case 'null':
					continuation = function() {
					};
					history = null;
					self = null;
					aCall = null;
					break;

				default:
					throw 'unknown continuation type: '+aType;
			}
			aOptions = null;
			return continuation;
		},

		_getAvailableFunction : function()
		{
			var functions = Array.slice(arguments);
			for (var i in functions)
			{
				let f = functions[i];
				if (f && typeof f == 'function')
					return f;
			}
			return null;
		},

		_deleteWindowTables : function(aWindow)
		{
			var w = aWindow || window;
			if (!w) return;

			var removedTables = [];
			for (let i in this._db)
			{
				if (w == this._db[i].window)
					removedTables.push(i);
			}
			removedTables.forEach(function(aName) {
				var table = this._db[aName];
				delete table.entries;
				delete table.window;
				delete table.windowId;
				delete this._db[aName];
			}, this);
		},

		_getWindowsById : function(aId)
		{
			var targets = this.WindowMediator.getZOrderDOMWindowEnumerator(null, true);
			var windows = [];
			while (targets.hasMoreElements())
			{
				let target = targets.getNext().QueryInterface(Ci.nsIDOMWindowInternal);
				let id = target.document.documentElement.getAttribute(this.WINDOW_ID);
				try {
					if (!id)
						id = this.SessionStore.getWindowValue(target, this.WINDOW_ID)
				}
				catch(e) {
				}
				if (id == aId)
					windows.push(target);
			}
			return windows;
		},

		get _doingUndo()
		{
			return this._db._doingUndo;
		},
		set _doingUndo(aValue)
		{
			if (aValue)
				this._db._doingUndo = true;
			else
				delete this._db._doingUndo;
			return aValue;
		},

		get WindowMediator() {
			if (!this._WindowMediator) {
				this._WindowMediator = Cc['@mozilla.org/appshell/window-mediator;1']
										.getService(Ci.nsIWindowMediator);
			}
			return this._WindowMediator;
		},
		_WindowMediator : null,

		get SessionStore() { 
			if (!this._SessionStore) {
				this._SessionStore = Cc['@mozilla.org/browser/sessionstore;1']
										.getService(Ci.nsISessionStore);
			}
			return this._SessionStore;
		},
		_SessionStore : null,

		handleEvent : function(aEvent)
		{
			switch (aEvent.type)
			{
				case 'unload':
					this._deleteWindowTables(window);
					this.destroy();
					return;
			}
		}

	};

	function UIHistory(aWindow, aId)
	{
		this.window   = aWindow;
		this.windowId = aId;
		this.clear();
	}
	UIHistory.prototype = {
		clear : function()
		{
			this.entries  = [];
			this.metaData = [];
			this.index    = -1;
		}
	};

	function UIHistoryMetaData()
	{
		this.clear();
	}
	UIHistoryMetaData.prototype = {
		clear : function()
		{
			this.children = [];
		}
	};

	window['piro.sakura.ne.jp'].operationHistory.init();
})();
