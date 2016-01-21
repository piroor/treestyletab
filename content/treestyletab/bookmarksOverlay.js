Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabBookmarksService', 'resource://treestyletab-modules/bookmark.js');

(function() {
let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});
let { inherit } = Components.utils.import('resource://treestyletab-modules/lib/inherit.jsm', {});


var TreeStyleTabBookmarksUIService = inherit(TreeStyleTabService, {
	preInit : function TSTBMService_preInit()
	{
		window.addEventListener('load', this, false);
		ReferenceCounter.add('window,load,TSTBMService,false');
		window.addEventListener(window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP, this, false);
		ReferenceCounter.add('window,EVENT_TYPE_TABS_DROP,TSTBMService,false');
	},

	init : function TSTBMService_init()
	{
		window.removeEventListener('load', this, false);
		ReferenceCounter.remove('window,load,TSTBMService,false');
		window.addEventListener('unload', this, false);
		ReferenceCounter.add('window,unload,TSTBMService,false');

		if ('PlacesCommandHook' in window && 'bookmarkCurrentPages' in PlacesCommandHook) {
			// Bookmark All Tabs
			PlacesCommandHook.__treestyletab__bookmarkCurrentPages = PlacesCommandHook.bookmarkCurrentPages;
			PlacesCommandHook.bookmarkCurrentPages = function(...aArgs) {
				TreeStyleTabBookmarksService.beginAddBookmarksFromTabs((function() {
					var tabs = [];
					var seen = {};
					var allTabs = gBrowser.mTabContainer.childNodes;
					for (let i = 0, maxi = allTabs.length; i < maxi; i++)
					{
						let tab = allTabs[i];
						let uri = tab.linkedBrowser.currentURI.spec;
						if (uri in seen)
							continue;
						seen[uri] = true;
						tabs.push(tab);
					}
					return tabs;
				})());
				try {
					return this.__treestyletab__bookmarkCurrentPages.apply(this, aArgs);
				}
				finally {
					TreeStyleTabBookmarksService.endAddBookmarksFromTabs();
				}
			};
		}
	},

	destroy : function TSTBMService_destroy()
	{
		window.removeEventListener('unload', this, false);
		ReferenceCounter.remove('window,unload,TSTBMService,false');
		window.removeEventListener(window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP, this, false);
		ReferenceCounter.remove('window,EVENT_TYPE_TABS_DROP,TSTBMService,false');
	},

	_onTabsDrop : function TSTBMService_onTabsDrop(aEvent)
	{
		var tabs = aEvent.detail.tabs;
		var groups = this.splitTabsToSubtrees(tabs);
		if (
			groups.length == 1 &&
			this.bookmarkDroppedTabsBehavior() != this.kBOOKMARK_DROPPED_TABS_ALL &&
			!Array.some(tabs, function(aTab) {
				return aTab.getAttribute('multiselected') == 'true';
			})
			) {
			aEvent.preventDefault();
			aEvent.stopPropagation();
		}
	},


	handleEvent : function TSTBMService_handleEvent(aEvent)
	{
		switch (aEvent.type)
		{
			case 'load':
				return this.init();

			case 'unload':
				return this.destroy();

			case window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP:
				return this._onTabsDrop(aEvent);
		}
	}

});

TreeStyleTabBookmarksUIService.preInit();

window.TreeStyleTabBookmarksUIService = TreeStyleTabBookmarksUIService;
})();
