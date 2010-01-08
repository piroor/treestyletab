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
	const currentRevision = 35;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'operationHistory' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].operationHistory.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var db;
	if (loadedRevision) {
		db = window['piro.sakura.ne.jp'].operationHistory._db ||
				window['piro.sakura.ne.jp'].operationHistory._tables; // old name
		if (!('histories' in db))
			db = { histories : db };
		window['piro.sakura.ne.jp'].operationHistory.destroy();
	}
	else {
		db = { histories : {} };
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	const PREF_PREFIX = 'extensions.UIOperationsHistoryManager@piro.sakura.ne.jp.';

	const Application = Cc['@mozilla.org/fuel/application;1']
					.getService(Ci.fuelIApplication);
	const Prefs = Cc['@mozilla.org/preferences;1']
					.getService(Ci.nsIPrefBranch);

	var DEBUG = false;
	try {
		DEBUG = Prefs.getBoolPref(PREF_PREFIX+'debug');
	}
	catch(e) {
	}

	const oneIndent = '   ';
	function log(aString, aLevel) {
		if (!DEBUG) return;
		aString = String(aString);
		if (aLevel) {
			let indent = '';
			for (let i = 0; i < aLevel; i++)
			{
				indent += oneIndent;
			}
			aString = aString.replace(/^/gm, indent);
		}
		Application
			.console
			.log(aString);
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
			var history = options.history;
			log('doUndoableTask start ('+options.name+' for '+options.windowId+')', history.inOperationCount);

			var entry = options.entry;
			if (entry &&
				!this._getUndoingState(options.key) &&
				!this._getRedoingState(options.key)) {
				let f = this._getAvailableFunction(entry.onRedo, entry.onredo, entry.redo);
				if (!f && !entry.onRedo && !entry.onredo && !entry.redo && options.task)
					entry.onRedo = options.task;
				history.addEntry(entry);
			}

			var continuationInfo = new ContinuationInfo();
			if (history.inOperation)
				continuationInfo.done = false;

			history.inOperation = true;
			var error;
			try {
				if (options.task)
					options.task.call(
						this,
						{
							level     : 0,
							history   : history,
							parent    : null,
							processed : false,
							manager   : this,
							getContinuation : function() {
								return this.manager._createContinuation(
										'undoable',
										options,
										continuationInfo
									);
							}
						}
					);
			}
			catch(e) {
				log(e, history.inOperationCount);
				error = e;
			}

			if (!continuationInfo.shouldWait) {
				history.inOperation = false;
				log('  => doUndoableTask finish / in operation : '+history.inOperation+
					'\n'+history.toString(),
					history.inOperationCount);
				// wait for all child processes
				if (history.inOperation)
					continuationInfo = {
						get done() {
							return !history.inOperation;
						}
					};
			}
			else {
				continuationInfo.allowed = true;
			}

			if (error)
				throw error;

			return continuationInfo;
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
			var undoing = this._getUndoingState(options.key);
			log('undo start ('+history.index+' / '+history.entries.length+', '+options.name+' for '+options.windowId+', '+undoing+')');
			if (!history.canUndo || undoing)
				return { done : true };

			this._setUndoingState(options.key, true);
			var processed = false;
			var error;
			var continuationInfo = new ContinuationInfo();

			do {
				let entries = history.currentEntries;
				--history.index;
				if (!entries.length) continue;
				log((history.index+1)+' '+entries[0].label, 1);
				let oneProcessed = false;
				entries.some(function(aEntry, aIndex) {
					log('level '+(aIndex)+' '+aEntry.label, 2);
					let f = this._getAvailableFunction(aEntry.onUndo, aEntry.onundo, aEntry.undo);
					if (!f) return;
					try {
						let info = {
								level     : aIndex,
								history   : history,
								parent    : (aIndex ? entries[0] : null ),
								processed : oneProcessed,
								done      : oneProcessed, // old name
								manager   : this,
								getContinuation : function() {
									return this.manager._createContinuation(
											continuationInfo.created ? 'null' : 'undo',
											options,
											continuationInfo
										);
								}
							};
						if (f.call(aEntry, info) !== false)
							oneProcessed = true;
					}
					catch(e) {
						log(e, 2);
						return error = e;
					}
				}, this);
				if (error) break;
				processed = oneProcessed;
				this._dispatchEvent('UIOperationGlobalHistoryUndo', options, entries[0], oneProcessed);
			}
			while (processed === false && history.canUndo);

			if (error || continuationInfo.done) {
				this._setUndoingState(options.key, false);
				log('  => undo finish\n'+history.toString());
			}
			else {
				continuationInfo.allowed = true;
			}

			if (error)
				throw error;

			return continuationInfo;
		},

		redo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			var max = history.entries.length;
			var redoing = this._getRedoingState(options.key);
			log('redo start ('+history.index+' / '+max+', '+options.name+' for '+options.windowId+', '+redoing+')');
			if (!history.canRedo || redoing)
				return { done : true };

			this._setRedoingState(options.key, true);
			var processed = false;
			var error;
			var continuationInfo = new ContinuationInfo();

			while (processed === false && history.canRedo)
			{
				++history.index;
				let entries = history.currentEntries;
				if (!entries.length) continue;
				log((history.index)+' '+entries[0].label, 1);
				let oneProcessed = false;
				entries.some(function(aEntry, aIndex) {
					log('level '+(aIndex)+' '+aEntry.label, 2);
					let f = this._getAvailableFunction(aEntry.onRedo, aEntry.onredo, aEntry.redo);
					if (!f) return;
					try {
						let info = {
								level     : aIndex,
								history   : history,
								parent    : (aIndex ? entries[0] : null ),
								processed : oneProcessed,
								done      : oneProcessed, // old name
								manager   : this,
								getContinuation : function() {
									return this.manager._createContinuation(
											continuationInfo.created ? 'null' : 'redo',
											options,
											continuationInfo
										);
								}
							};
						if (f.call(aEntry, info) !== false)
							oneProcessed = true;
					}
					catch(e) {
						log(e, 2);
						return error = e;
					}
				}, this);
				if (error) break;
				processed = oneProcessed;
				this._dispatchEvent('UIOperationGlobalHistoryRedo', options, entries[0], oneProcessed);
			}

			if (error || continuationInfo.done) {
				this._setRedoingState(options.key, false);
				log('  => redo finish\n'+history.toString());
			}
			else {
				continuationInfo.allowed = true;
			}

			if (error)
				throw error;

			return continuationInfo;
		},

		goToIndex : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			var index = Math.max(0, Math.min(history.entries.length-1, options.index));
			var current = history.index;

			if (index == current)
				return { done : true };

			var selfInfo = { done : false };
			var self = this;
			var iterator = (function() {
					while (true)
					{
						let info;
						if (index < current) {
							if (history.index <= index)
								break;
							info = self.undo(options.name, options.window);
						}
						else {
							if (history.index >= index)
								break;
							info = self.redo(options.name, options.window);
						}

						while (!info.done)
						{
							yield;
						}
					}
				})();

			var timer = window.setInterval(function() {
					try {
						iterator.next();
					}
					catch(e) {
						selfInfo.done = true;
						window.clearInterval(timer);
					}
				}, 10);

			return selfInfo;
		},

		syncWindowHistoryFocus : function(aOptions)
		{
			if (!aOptions.currentEntry)
				throw 'currentEntry must be specified!';
			if (!aOptions.entries)
				throw 'entries must be specified!';
			if (!aOptions.windows)
				throw 'windows must be specified!';
			if (aOptions.entries.length != aOptions.windows.length)
				throw 'numbers of entries and windows must be same!';

			var name = aOptions.name || 'window';

			log('syncWindowHistoryFocus for '+name+' ('+aOptions.currentEntry.label+')');

			aOptions.entries.forEach(function(aEntry, aIndex) {
				var history = this.getHistory(name, aOptions.windows[aIndex]);
				var currentEntries = history.currentEntries;
				if (currentEntries.indexOf(aOptions.currentEntry) > -1) {
					return;
				}
				if (currentEntries.indexOf(aEntry) > -1) {
					log(name+' is synced for '+aIndex+' ('+aEntry.label+')');
					history.index--;
				}
			}, this);
		},

		clear : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			return options.history.clear();
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

		isUndoing : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			return this._getUndoingState(options.key);
		},
		isRedoing : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			return this._getRedoingState(options.key);
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

			this._initDBAsObserver();

			this.initialized = true;
		},

		_initDBAsObserver : function()
		{
			if ('observerRegistered' in this._db)
				return;

			this._db.observerRegistered = true;
			this._db.observe = function(aSubject, aTopic, aData) {
				switch (aTopic)
				{
					case 'private-browsing':
						switch (aData)
						{
							case 'enter':
							case 'exit':
								for (let i in this.histories)
								{
									this.histories[i].clear();
								}
								this.histories = {};
								break;
						}
						break;
				}
			};
			Cc['@mozilla.org/observer-service;1']
				.getService(Ci.nsIObserverService)
				.addObserver(this._db, 'private-browsing', false);
		},

		destroy : function()
		{
			window.removeEventListener('unload', this, false);
		},

		_dispatchEvent : function(aType, aOptions, aEntry, aProcessed)
		{
			var d = aOptions.window ? aOptions.window.document : document ;
			var event = d.createEvent('Events');
			event.initEvent(aType, true, false);
			event.name  = aOptions.name;
			event.entry = aEntry;
			event.data  = aEntry; // old name
			event.processed = aProcessed || false;
			event.done      = aProcessed || false; // old name
			d.dispatchEvent(event);
		},

		_getOptionsFromArguments : function(aArguments)
		{
			var w     = null,
				name  = '',
				entry = null,
				task  = null,
				index = -1;
			Array.slice(aArguments).some(function(aArg) {
				if (aArg instanceof Ci.nsIDOMWindow)
					w = aArg;
				else if (typeof aArg == 'string')
					name = aArg;
				else if (typeof aArg == 'number')
					index = aArg;
				else if (typeof aArg == 'function')
					task = aArg;
				else if (aArg)
					entry = aArg;
			});

			var type = w ? 'window' : 'global' ;
			if (!name)
				name = type;

			var windowId = w ? this.getWindowId(w) : null ;
			var history = this._getHistoryFor(name, w);

			return {
				name     : name,
				window   : w,
				windowId : windowId,
				key      : encodeURIComponent(name)+'::'+type,
				entry    : entry,
				history  : history,
				task     : task,
				index    : index
			};
		},

		_getHistoryFor : function(aName, aWindow)
		{
			var uniqueName = encodeURIComponent(aName);

			var windowId = aWindow ? this.getWindowId(aWindow) : null ;
			if (windowId)
				uniqueName += '::'+windowId;

			if (!(uniqueName in this._db.histories)) {
				this._db.histories[uniqueName] = new UIHistory(aName, aWindow, windowId);
			}

			return this._db.histories[uniqueName];
		},

		_createContinuation : function(aType, aOptions, aInfo)
		{
			var continuation;
			var history = aOptions.history;
			var key     = aOptions.key;
			var self    = this;
			switch (aType)
			{
				case 'undoable':
					aInfo.done = false;
					continuation = function() {
						if (aInfo.allowed) {
							history.inOperation = false;
							if (!history.inOperation)
								aInfo.done = true;
						}
						aInfo.called = true;
						log('  => doUndoableTask finish (delayed) / '+
							'in operation : '+history.inOperationCount+' / '+
							'allowed : '+aInfo.allowed+
							'\n'+history.toString(),
							history.inOperationCount);
					};
					key = null;
					self = null;
					aInfo.created = true;
					break;

				case 'undo':
					continuation = function() {
						if (aInfo.allowed)
							self._setUndoingState(key, false);
						aInfo.called = true;
						log('  => undo finish (delayed)\n'+history.toString());
					};
					aInfo.created = true;
					break;

				case 'redo':
					continuation = function() {
						if (aInfo.allowed)
							self._setRedoingState(key, false);
						aInfo.called = true;
						log('  => redo finish (delayed)\n'+history.toString());
					};
					aInfo.created = true;
					break;

				case 'null':
					continuation = function() {
					};
					history = null;
					key = null;
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

		_deleteWindowHistories : function(aWindow)
		{
			var w = aWindow || window;
			if (!w) return;

			var removedTables = [];
			for (let i in this._db.histories)
			{
				if (w == this._db.histories[i].window)
					removedTables.push(i);
			}
			removedTables.forEach(function(aName) {
				var table = this._db.histories[aName];
				delete table.entries;
				delete table.window;
				delete table.windowId;
				delete this._db.histories[aName];
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

		_getUndoingState : function(aKey)
		{
			return this._db.undoing && aKey in this._db.undoing;
		},
		_getRedoingState : function(aKey)
		{
			return this._db.redoing && aKey in this._db.redoing;
		},

		_setUndoingState : function(aKey, aState)
		{
			if (!('undoing' in this._db))
				this._db.undoing = {};

			if (aState)
				this._db.undoing[aKey] = true;
			else if (aKey in this._db.undoing)
				delete this._db.undoing[aKey];
		},
		_setRedoingState : function(aKey, aState)
		{
			if (!('redoing' in this._db))
				this._db.redoing = {};

			if (aState)
				this._db.redoing[aKey] = true;
			else if (aKey in this._db.redoing)
				delete this._db.redoing[aKey];
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
					this._deleteWindowHistories(window);
					this.destroy();
					return;
			}
		}

	};

	function UIHistory(aName, aWindow, aId)
	{
		this.name     = aName;
		this.window   = aWindow;
		this.windowId = aId;

		this.key = aName+(aId ? ' ('+aId+')' : '' )

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

		get safeIndex()
		{
			return Math.max(0, Math.min(this.entries.length-1, this.index));
		},

		get inOperation()
		{
			return this.inOperationCount > 0;
		},
		set inOperation(aValue)
		{
			if (aValue)
				this.inOperationCount++;
			else if (this.inOperationCount)
				this.inOperationCount--;

			return this.inOperationCount > 0;
		},

		clear : function()
		{
			log('UIHistory::clear '+this.key);
			this.entries  = [];
			this.metaData = [];
			this.index    = -1;
			this.inOperationCount = 0;
		},

		addEntry : function(aEntry)
		{
			log('UIHistory::addEntry '+this.key+
				'\n  '+aEntry.label+
				'\n  in operation : '+this.inOperationCount,
				this.inOperationCount);
			if (this.inOperation) {
				let metaData = this.lastMetaData;
				metaData.children.push(aEntry);
				metaData.names.push(aEntry.name);
				log(' => level '+metaData.children.length+' (child)', this.inOperationCount);
			}
			else {
				this._addNewEntry(aEntry);
				log(' => level 0 (new entry at '+(this.entries.length-1)+')', this.inOperationCount);
			}

			if (aEntry.insertBefore)
				this._insertBefore(aEntry, aEntry.insertBefore);
			else if (aEntry.name)
				this._checkInsertion(aEntry);
		},
		_addNewEntry : function(aEntry)
		{
			this.entries = this.entries.slice(0, this.index+1);
			this.entries.push(aEntry);
			this.entries = this.entries.slice(-this.max);

			var metaData = new UIHistoryMetaData();
			metaData.names.push(aEntry.name);

			this.metaData = this.metaData.slice(0, this.index+1);
			this.metaData.push(metaData);
			this.metaData = this.metaData.slice(-this.max);

			this.index = this.entries.length;
		},
		_insertBefore : function(aEntry, aNames)
		{
			if (typeof aNames == 'string')
				aNames = [aNames];

			if (!aNames.length)
				return;

			var index = this.safeIndex;
			var metaData = this.metaData[index];
			var insertionPositions = aNames.map(function(aName) {
						return metaData.names.indexOf(aName);
					})
					.filter(function(aIndex) {
						return aIndex > -1;
					})
					.sort();
			if (!insertionPositions.length)
				return;

			var position = insertionPositions[0];
			var entries = this._getEntriesAt(index);
			entries.splice(entries.indexOf(aEntry), 1);
			entries.splice(position, 0, aEntry);
			this._setEntriesAt(entries, index);
			log(' => moved (inserted) to level '+position, this.inOperationCount);

			metaData.registerInsertionTarget(aEntry, aNames);
		},
		_checkInsertion : function(aEntry)
		{
			var name = aEntry.name;
			var index = this.safeIndex;
			var metaData = this.metaData[index];
			if (!(name in metaData.insertionTargets))
				return;

			var entries = this._getEntriesAt(index);
			var indexes = metaData
					.insertionTargets[name]
					.map(function(aEntry) {
						return entries.indexOf(aEntry);
					})
					.sort()
					.reverse();

			if (!indexes.length)
				return;

			var position = indexes[0]+1;
			var currentPosition = entries.indexOf(aEntry);
			if (position < currentPosition)
				return;

			entries.splice(currentPosition, 1);
			entries.splice(position, 0, aEntry);
			this._setEntriesAt(entries, index);
			log(' => moved (inserted) to level '+position, this.inOperationCount);
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
		},

		_setEntriesAt : function(aEntries, aIndex)
		{
			if (aIndex < 0 || aIndex >= this.entries.length)
				return aEntries;

			this.metaData[aIndex].names = aEntries.map(function(aEntry) {
					return aEntry.name;
				});
			var parent = aEntries[0];
			var children = aEntries.slice(1);
			this.entries[aIndex] = parent;
			this.metaData[aIndex].children = children;
			return aEntries;
		},
		set currentEntries(aEntries)
		{
			return this._setEntriesAt(aEntries, this.index);
		},
		set lastEntries(aEntries)
		{
			return this._setEntriesAt(aEntries, this.entries.length-1);
		},

		_getPromotionOptions : function(aArguments)
		{
			var entry, names = [];
			Array.slice(aArguments).forEach(function(aArg) {
				if (typeof aArg == 'string')
					names.push(aArg);
				else if (typeof aArg == 'object')
					entry = aArg;
			});
			return [entry, names];
		},

		toString : function()
		{
			var entries = this.entries;
			var metaData = this.metaData;
			var index = this.index;
			var string = entries
							.map(function(aEntry, aIndex) {
								var children = metaData[aIndex].children.length;
								children = children ? ' ('+children+')' : '' ;
								var name = aEntry.name;
								name = name ? ' ['+name+']' : '' ;
								return (aIndex == index ? '*' : ' ' )+
										' '+aIndex+': '+aEntry.label+
										name+
										children;
							}, this)
							.join('\n');
			if (index < 0)
				string = '* -1: -----\n' + string;
			else if (index >= entries.length)
				string += '\n* '+entries.length+': -----';

			return this.key+'\n'+string;
		}
	};

	function UIHistoryProxy(aHistory)
	{
		this._original = aHistory;
	}
	UIHistoryProxy.prototype = {
		__proto__ : UIHistory.prototype,

		get index()
		{
			return this._original.safeIndex;
		},
		set index(aValue)
		{
			this._original.index = aValue;
			return aValue;
		},

		get entries()
		{
			return this._original.entries;
		},
		set entries(aValue)
		{
			this._original.entries = aValue;
			return aValue;
		},

		get metaData()
		{
			return this._original.metaData;
		},
		set metaData(aValue)
		{
			this._original.metaData = aValue;
			return aValue;
		},

		get inOperationCount()
		{
			return this._original.inOperationCount;
		},
		set inOperationCount(aValue)
		{
			this._original.inOperationCount = aValue;
			return aValue;
		},

		clear : function()
		{
			return this._original.clear();
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
			this.names    = [];
			this.insertionTargets = {};
		},

		registerInsertionTarget : function(aEntry, aNames)
		{
			aNames.forEach(function(aName) {
				if (!this.insertionTargets[aName])
					this.insertionTargets[aName] = [];
				this.insertionTargets[aName].push(aEntry);
			}, this);
		}
	};

	function ContinuationInfo()
	{
		this.called  = false;
		this.allowed = false;
		this.created = false;
		this._done   = null;
	}
	ContinuationInfo.prototype = {
		get shouldWait()
		{
			return this.created && !this.called;
		},
		get done()
		{
			if (this._done !== null)
				return this._done;
			return !this.shouldWait;
		},
		set done(aValue)
		{
			this._done = aValue;
			return aValue;
		}
	};

	// export
	window['piro.sakura.ne.jp'].operationHistory.UIHistory         = UIHistory;
	window['piro.sakura.ne.jp'].operationHistory.UIHistoryProxy    = UIHistoryProxy;
	window['piro.sakura.ne.jp'].operationHistory.UIHistoryMetaData = UIHistoryMetaData;
	window['piro.sakura.ne.jp'].operationHistory.ContinuationInfo  = ContinuationInfo;

	window['piro.sakura.ne.jp'].operationHistory.init();
})();
