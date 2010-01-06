/*
 UI Operations History Manager

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
	const currentRevision = 19;
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

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	function log() {
		if (!DEBUG) return;
		Cc['@mozilla.org/fuel/application;1']
			.getService(Ci.fuelIApplication)
			.console
			.log(Array.slice(arguments).join('\n'));
	}

	window['piro.sakura.ne.jp'].operationHistory = {
		revision : currentRevision,

		WINDOW_ID : 'ui-operation-global-history-window-id',

		addEntry : function()
		{
			this.doUndoableTask.apply(this, arguments);
		},

		doUndoableTask : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			log('doUndoableTask start ('+options.name+' for '+options.windowId+')');
			var history = options.history;

			var entry = options.entry;
			if (!this._doingUndo && entry) {
				let f = this._getAvailableFunction(entry.onRedo, entry.onredo, entry.redo);
				if (!f && !entry.onRedo && !entry.onredo && !entry.redo && options.task)
					entry.onRedo = options.task;
				history.addEntry(entry);
			}

			var currentLevel = history.addingEntryLevel;
			history.addingEntryLevel++;

			var continuationInfo = new ContinuationInfo();
			var error;
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
								return this.manager._createContinuation(
										!continuationInfo.created && (currentLevel > 0) ? 'null' : 'undoable',
										options,
										continuationInfo
									);
							}
						}
					);
			}
			catch(e) {
				log(e);
				error = e;
			}

			continuationInfo.allowed = true;
			if (continuationInfo.done) {
				history.addingEntryLevel--;
				log('  => doUndoableTask finish');
			}

			if (error)
				throw error;
		},

		getHistory : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			return new UIHistoryProxy(options.history);
		},

		undo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			log('undo start ('+history.index+' / '+history.entries.length+', '+options.name+' for '+options.windowId+', '+this._doingUndo+')');
			if (!history.canUndo || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			var continuationInfo = new ContinuationInfo();

			do {
				let entries = history.currentEntries;
				--history.index;
				if (!entries.length) continue;
				log('  '+(history.index+1)+' '+entries[0].label);
				let done = false;
				entries.forEach(function(aEntry, aIndex) {
					log('    level '+(aIndex)+' '+aEntry.label);
					let f = this._getAvailableFunction(aEntry.onUndo, aEntry.onundo, aEntry.undo);
					try {
						if (f) {
							let info = {
									level   : aIndex,
									parent  : (aIndex ? entries[0] : null ),
									done    : processed && done,
									manager : this,
									getContinuation : function() {
										return this.manager._createContinuation(
												continuationInfo.created ? 'null' : 'undo',
												options,
												continuationInfo
											);
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
				this._dispatchEvent('UIOperationGlobalHistoryUndo', options, entries[0], done);
			}
			while (processed === false && history.canUndo);

			continuationInfo.allowed = true;
			if (continuationInfo.done) {
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
			if (!history.canRedo || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			var continuationInfo = new ContinuationInfo();

			while (processed === false && history.canRedo)
			{
				++history.index;
				let entries = history.currentEntries;
				if (!entries.length) continue;
				log('  '+(history.index)+' '+entries[0].label);
				let done = false;
				entries.forEach(function(aEntry, aIndex) {
					log('    level '+(aIndex)+' '+aEntry.label);
					let f = this._getAvailableFunction(aEntry.onRedo, aEntry.onredo, aEntry.redo);
					let done = false;
					try {
						if (f) {
							let info = {
									level   : aIndex,
									parent  : (aIndex ? entries[0] : null ),
									done    : processed && done,
									manager : this,
									getContinuation : function() {
										return this.manager._createContinuation(
												continuationInfo.created ? 'null' : 'redo',
												options,
												continuationInfo
											);
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
				this._dispatchEvent('UIOperationGlobalHistoryRedo', options, entries[0], done);
			}

			continuationInfo.allowed = true;
			if (continuationInfo.done) {
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
			var history = this._getHistoryFor(name, w);

			return {
				name     : name,
				window   : w,
				windowId : windowId,
				entry    : entry,
				history  : history,
				task     : task
			};
		},

		_getHistoryFor : function(aName, aWindow)
		{
			var uniqueName = encodeURIComponent(aName);

			var windowId = aWindow ? this.getWindowId(aWindow) : null ;
			if (windowId)
				uniqueName += '::'+windowId;

			if (!(uniqueName in this._db)) {
				this._db[uniqueName] = new UIHistory(aName, aWindow, windowId);
			}

			return this._db[uniqueName];
		},

		_createContinuation : function(aType, aOptions, aInfo)
		{
			var continuation;
			var history = aOptions.history;
			var self = this;
			switch (aType)
			{
				case 'undoable':
					continuation = function() {
						if (aInfo.allowed)
							history.addingEntryLevel--;
						aInfo.called = true;
						log('  => doUndoableTask finish (delayed)');
					};
					self = null;
					aInfo.created = true;
					break;

				case 'undo':
					continuation = function() {
						if (aInfo.allowed)
							self._doingUndo = false;
						aInfo.called = true;
						log('  => undo finish (delayed)');
					};
					history = null;
					aInfo.created = true;
					break;

				case 'redo':
					continuation = function() {
						if (aInfo.allowed)
							self._doingUndo = false;
						aInfo.called = true;
						log('  => redo finish (delayed)');
					};
					history = null;
					aInfo.created = true;
					break;

				case 'null':
					continuation = function() {
					};
					history = null;
					self = null;
					aInfo.created = true;
					aInfo = null;
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

	const Prefs = Cc['@mozilla.org/preferences;1']
					.getService(Ci.nsIPrefBranch);
	const PREF_PREFIX = 'extensions.UIOperationsHistoryManager@piro.sakura.ne.jp.';

	function UIHistory(aName, aWindow, aId)
	{
		this.name     = aName;
		this.window   = aWindow;
		this.windowId = aId;

		try {
			var max = Prefs.getIntPref(this.maxPref);
			this._max = Math.max(0, Math.min(this.MAX_ENTRIES, max));
		}
		catch(e) {
			this._max = this.MAX_ENTRIES;
		}

		this.clear();
	}
	UIHistory.prototype = {

		MAX_ENTRIES : 999,
		get maxPref()
		{
			return PREF_PREFIX+escape(this.name)+'.max.'+(this.window ? 'window' : 'global');
		},
		get max()
		{
			return this._max;
		},
		set max(aValue)
		{
			var max = parseInt(aValue);
			if (!isNaN(max)) {
				max = Math.max(0, Math.min(this.MAX_ENTRIES, max));
				try {
					if (max != this._max)
						Prefs.setIntPref(this.maxPref, max);
				}
				catch(e) {
				}
				this._max = max;
			}
			return aValue;
		},

		clear : function()
		{
			this.entries  = [];
			this.metaData = [];
			this.index    = -1;
			this.addingEntryLevel = 0;
		},

		addEntry : function(aEntry)
		{
			log('UIHistory::addEntry / register new entry to history\n  '+aEntry.label);
			if (this.addingEntryLevel > 0) {
				this.lastMetaData.children.push(aEntry);
				log(' => child level ('+(this.lastMetaData.children.length-1)+')');
			}
			else {
				this._addNewEntry(aEntry);
				log(' => top level ('+(this.entries.length-1)+')');
			}
		},
		_addNewEntry : function(aEntry)
		{
			this.entries = this.entries.slice(0, this.index+1);
			this.entries.push(aEntry);
			this.entries = this.entries.slice(-this.max);

			this.metaData = this.metaData.slice(0, this.index+1);
			this.metaData.push(new UIHistoryMetaData());
			this.metaData = this.metaData.slice(-this.max);

			this.index = this.entries.length;
		},

		get canUndo()
		{
			return this.index >= 0;
		},
		get canRedo()
		{
			return this.index < this.entries.length;
		},

		get currentEntry()
		{
			return this.entries[this.index] || null ;
		},
		get lastEntry()
		{
			return this.entries[this.entries.length-1];
		},

		get currentMetaData()
		{
			return this.metaData[this.index] || null ;
		},
		get lastMetaData()
		{
			return this.metaData[this.metaData.length-1];
		},

		_getEntriesAt : function(aIndex)
		{
			let entry = this.entries[aIndex];
			if (!entry) return [];
			let metaData = this.metaData[aIndex];
			return [entry].concat(metaData.children);
		},
		get currentEntries()
		{
			return this._getEntriesAt(this.index);
		},
		get lastEntries()
		{
			return this._getEntriesAt(this.entries.length-1);
		}
	};

	function UIHistoryProxy(aHistory)
	{
		this.__proto__ = aHistory;
		this.index = Math.max(0, Math.min(aHistory.entries.length-1, aHistory.index));
	}

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

	function ContinuationInfo()
	{
		this.called  = false;
		this.allowed = false;
		this.created = false;
	}
	ContinuationInfo.prototype = {
		get done()
		{
			return !this.created || this.called;
		}
	};

	// export
	window['piro.sakura.ne.jp'].operationHistory.UIHistory         = UIHistory;
	window['piro.sakura.ne.jp'].operationHistory.UIHistoryProxy    = UIHistoryProxy;
	window['piro.sakura.ne.jp'].operationHistory.UIHistoryMetaData = UIHistoryMetaData;
	window['piro.sakura.ne.jp'].operationHistory.ContinuationInfo  = ContinuationInfo;

	window['piro.sakura.ne.jp'].operationHistory.init();
})();
