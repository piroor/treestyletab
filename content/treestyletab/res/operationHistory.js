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
	const currentRevision = 8;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'operationHistory' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].operationHistory.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var tables = {};
	if (loadedRevision) {
		tables = window['piro.sakura.ne.jp'].operationHistory._tables;
		window['piro.sakura.ne.jp'].destroy();
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

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
			var history = options.history;
			var entries = history.entries;
			var error;
			var wasInUndoableTask = history._inUndoableTask;

			if (!wasInUndoableTask)
				history._inUndoableTask = true;

			var data = options.data;
			if (!this._doingUndo && data) {
				let f = this._getAvailableFunction(data.onRedo, data.onredo, data.redo);
				if (!f && !data.onRedo && !data.onredo && !data.redo && options.task)
					data.onRedo = options.task;

				if (wasInUndoableTask) {
					entries[entries.length-1].children.push(data);
				}
				else {
					entries = entries.slice(0, history.index+1);
					entries.push({
						__proto__ : data,
						data      : data,
						children  : []
					});
					entries = entries.slice(-this.MAX_ENTRIES);

					history.entries = entries;
					history.index = entries.length;
				}
			}

			try {
				if (options.task)
					options.task.call(this);
			}
			catch(e) {
				error = e;
			}

			if (!wasInUndoableTask)
				delete history._inUndoableTask;

			if (error)
				throw error;
		},

		getHistory : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			return {
				entries : history.entries,
				index   : Math.max(0, Math.min(history.entries.length-1, history.index))
			};
		},

		undo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			if (history.index < 0 || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			while (processed === false && history.index > -1)
			{
				let entry = history.entries[history.index--];
				if (!entry) continue;
				let done = false;
				[entry.data].concat(entry.children).forEach(function(aData) {
					let f = this._getAvailableFunction(aData.onUndo, aData.onundo, aData.undo);
					try {
						if (f) {
							processed = f.call(aData);
							done = true;
						}
						else {
							processed = true;
						}
					}
					catch(e) {
						error = e;
					}
				}, this);
				this._dispatchEvent('UIOperationGlobalHistoryUndo', options, entry.data, done);
			}
			this._doingUndo = false;

			if (error)
				throw error;

			return true;
		},

		redo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			var max = history.entries.length;
			if (history.index >= max || this._doingUndo)
				return false;

			this._doingUndo = true;
			var processed = false;
			var error;
			while (processed === false && history.index < max)
			{
				let entry = history.entries[++history.index];
				if (!entry) continue;
				let done = false;
				[entry.data].concat(entry.children).forEach(function(aData) {
					let f = this._getAvailableFunction(aData.onRedo, aData.onredo, aData.redo);
					let done = false;
					try {
						if (f) {
							processed = f.call(entry.data);
							done = true;
						}
						else {
							processed = true;
						}
					}
					catch(e) {
						error = e;
					}
				}, this);
				this._dispatchEvent('UIOperationGlobalHistoryRedo', options, entry.data, done);
			}
			this._doingUndo = false;

			if (error)
				throw error;

			return true;
		},

		getWindowId : function(aWindow)
		{
			var root = aWindow.document.documentElement;
			var id = root.getAttribute(this.WINDOW_ID);
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

			if (!id || forceNewId) {
				id = 'window-'+Date.now()+parseInt(Math.random() * 65000);
				try {
					this.SessionStore.setWindowValue(aWindow, this.WINDOW_ID, id);
				}
				catch(e) {
				}
			}
			if (root.getAttribute(this.WINDOW_ID) != id)
				root.setAttribute(this.WINDOW_ID, id);
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
		_tables : tables,

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
					this._tables = target['piro.sakura.ne.jp'].operationHistory._tables;
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

		_dispatchEvent : function(aType, aOptions, aData, aDone)
		{
			var d = aOptions.window ? aOptions.window.document : document ;
			var event = d.createEvent('Events');
			event.initEvent(aType, true, false);
			event.name = aOptions.name;
			event.data = aData;
			event.done = aDone;
			d.dispatchEvent(event);
		},

		_getOptionsFromArguments : function(aArguments)
		{
			var w = null, name, data = null, task = null;
			Array.slice(aArguments).some(function(aArg) {
				if (aArg instanceof Ci.nsIDOMWindow)
					w = aArg;
				else if (typeof aArg == 'string')
					name = aArg;
				else if (typeof aArg == 'function')
					task = aArg;
				else if (aArg)
					data = aArg;

				return (w && name && data && task);
			});

			if (!name)
				name = w ? 'window' : 'global' ;

			var windowId = w ? this.getWindowId(w) : null ;
			var table = this._getTable(name, w);

			return {
				name     : name,
				window   : w,
				windowId : windowId,
				data     : data,
				history  : table,
				task     : task
			};
		},

		_getTable : function(aName, aWindow)
		{
			aName = encodeURIComponent(aName);

			var windowId = aWindow ? this.getWindowId(aWindow) : null ;
			if (windowId)
				aName += '::'+aName;

			if (!(aName in this._tables)) {
				this._tables[aName] = {
					entries  : [],
					index    : -1,
					window   : aWindow,
					windowId : windowId
				};
			}

			return this._tables[aName];
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
			for (let i in this._tables)
			{
				if (w == this._tables[i].window)
					removedTables.push(i);
			}
			removedTables.forEach(function(aName) {
				var table = this._tables[aName];
				delete table.entries;
				delete table.window;
				delete table.windowId;
				delete this._tables[aName];
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
			return this._tables._doingUndo;
		},
		set _doingUndo(aValue)
		{
			if (aValue)
				this._tables._doingUndo = true;
			else
				delete this._tables._doingUndo;
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

	window['piro.sakura.ne.jp'].operationHistory.init();
})();
