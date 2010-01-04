/*
 UI Operations Global Undo History Manager

 Usage:
   // window specific history
   window['piro.sakura.ne.jp'].operationHistory.addEntry(
     'MyAddonFeature',
     { onUndo : function() { ... },
       onRedo : function() { ... } },
     window
   );
   window['piro.sakura.ne.jp'].operationHistory.undo('MyAddonFeature', window);
   window['piro.sakura.ne.jp'].operationHistory.redo('MyAddonFeature', window);

   // global history (not associated to window)
   window['piro.sakura.ne.jp'].operationHistory.addEntry(
     'MyAddonFeature',
     { ... }
   );
   window['piro.sakura.ne.jp'].operationHistory.undo('MyAddonFeature');

   // anonymous, window specific
   window['piro.sakura.ne.jp'].operationHistory.addEntry({ ... }, window);
   window['piro.sakura.ne.jp'].operationHistory.undo(window);

   // anonymous, global
   window['piro.sakura.ne.jp'].operationHistory.addEntry({ ... });
   window['piro.sakura.ne.jp'].operationHistory.undo();

   // When you want to use "window" object in the global history,
   // you should use the ID string instead of the "window" object
   // to reduce memory leak. For example...
   var id = window['piro.sakura.ne.jp'].operationHistory.getWindowId(targetWindow);
   window['piro.sakura.ne.jp'].operationHistory.addEntry({
     onUndo : function() {
       // "this" in undo/redo functions refers the operationHistory service itself.
       var w = window['piro.sakura.ne.jp'].operationHistory.getWindowById(id);
       w.MyAddonService.undoSomething();
     },
     onRedo : ...
   });

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/operationHistory.js
*/
(function() {
	const currentRevision = 2;

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

		kMAX_ENTRIES : 999,
		kWINDOW_ID : 'ui-operation-global-history-window-id',

		addEntry : function()
		{
			if (this._doingUndo)
				return;

			var options = this._getOptionsFromArguments(arguments);

			var history = options.history;
			var entries = history.entries;

			entries = entries.slice(0, history.index+1);
			entries.push(options.data);
			entries = entries.slice(-this.kMAX_ENTRIES);

			history.entries = entries;
			history.index = entries.length-1;
		},

		undo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			if (history.index < 0)
				return false;

			var error;

			this._doingUndo = true;
			var data = history.entries[history.index--];
			try {
				(data.onUndo || data.onundo)();
			}
			catch(e) {
				error = e;
			}
			this._dispatchEvent(options);
			this._doingUndo = false;

			if (error) throw error;
			return true;
		},

		redo : function()
		{
			var options = this._getOptionsFromArguments(arguments);
			var history = options.history;
			if (history.index > history.entries.length-1)
				return false;

			var error;

			this._doingUndo = true;
			var data = history.entries[history.index++];
			try {
				(data.onRedo || data.onredo)(this);
			}
			catch(e) {
				error = e;
			}
			this._dispatchEvent(options);
			this._doingUndo = false;

			if (error) throw error;
			return true;
		},

		getWindowId : function(aWindow)
		{
			var windowId;
			try {
				windowId = aWindow.document.documentElement.getAttribute(this.kWINDOW_ID) ||
							this.SessionStore.getWindowValue(aWindow, this.kWINDOW_ID);
			}
			catch(e) {
			}
			if (!windowId) {
				windowId = 'window-'+Date.now()+parseInt(Math.random() * 65000);
				aWindow.document.documentElement.setAttribute(this.kWINDOW_ID, windowId);
				try {
					this.SessionStore.setWindowValue(aWindow, this.kWINDOW_ID, windowId);
				}
				catch(e) {
				}
			}
			return windowId;
		},

		getWindowById : function(aId)
		{
			var targets = this.WindowMediator.getZOrderDOMWindowEnumerator('*', true);
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
			var targets = this.WindowMediator.getZOrderDOMWindowEnumerator('navigator:browser', true);
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

		_dispatchEvent : function(aOptions)
		{
			var d = aOptions.window ? aOptions.window.document : document ;
			var event = d.createEvent('Events');
			event.initEvent('UIOperationGlobalHistoryUndo', true, false);
			event.name = aOptions.name;
			d.dispatchEvent(event);
		},

		_getOptionsFromArguments : function(aArguments)
		{
			var w, name, data;
			Array.slice(aArguments).some(function(aArg) {
				if (aArg instanceof Ci.nsIDOMWindow)
					w = aArg;
				else if (typeof aArg == 'string')
					name = aArg;
				else if (aArg)
					data = aArg;

				return (w && name && data);
			});

			if (!name)
				name = w ? 'window' : 'global' ;

			var windowId = this.getWindowId(window);

			var tableName = w ? encodeURIComponent(name)+'::'+windowId : encodeURIComponent(name) ;
			if (!(tableName in this._tables)) {
				this._tables[tableName] = {
					entries  : [],
					index    : -1,
					windowId : windowId
				};
			}

			return {
				name     : name,
				window   : w,
				windowId : windowId,
				data     : data,
				history  : this._tables[tableName]
			};
		},

		_deleteWindowTables : function()
		{
			var id = this.getWindowId(window);
			if (!id) return;

			var removedTables = [];
			for (let i in this._tables)
			{
				if (id == this._tables[i].windowId)
					removedTables.push(i);
			}
			removedTables.forEach(function(aName) {
				delete this._tables[aName];
			}, this);
		},

		get WindowMediator() {
			if (!this._WindowMediator) {
				this._WindowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
			}
			return this._WindowMediator;
		},
		_WindowMediator : null,

		get SessionStore() { 
			if (!this._SessionStore) {
				this._SessionStore = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);
			}
			return this._SessionStore;
		},
		_SessionStore : null,

		handleEvent : function(aEvent)
		{
			switch (aEvent.type)
			{
				case 'unload':
					this._deleteWindowTables();
					this.destroy();
					return;
			}
		}

	};

	window['piro.sakura.ne.jp'].operationHistory.init();
})();
