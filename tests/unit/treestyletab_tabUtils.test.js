var win;
var sv;
var tabs;

function setUp()
{
	utils.setPref('browser.tabs.warnOnClose', false);

	yield utils.setUpTestWindow();
	win = utils.getTestWindow();
	sv = win.TreeStyleTabService;

	gBrowser.removeAllTabsBut(gBrowser.selectedTab);
	yield Do(utils.addTab('about:logo'));
	yield Do(utils.addTab('../fixtures/frameTest.html'));
	yield Do(utils.addTab('../fixtures/frameTestInline.html'));
	tabs = Array.slice(gBrowser.mTabs);
	assert.equals(4, tabs.length);
}

function tearDown()
{
	win = null;
	tabs = null;
	utils.tearDownTestWindow();
}

function test_getTabFromFrame()
{
	function assertTabFrame(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabFromFrame(aArgument));
	}

	assertTabFrame(tabs[1], tabs[1].linkedBrowser.contentWindow);
	assertTabFrame(tabs[2], tabs[2].linkedBrowser.contentWindow.frames[1]);
	assertTabFrame(tabs[3], tabs[3].linkedBrowser.contentWindow.frames[0]);
	assert.isNull(sv.getTabFromFrame(window));
}

function test_getTabFromChild()
{
	function assertTabChild(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabFromChild(aArgument));
	}

	assertTabChild(tabs[0], tabs[0]);
	assertTabChild(tabs[0], tabs[0].ownerDocument.getAnonymousNodes(tabs[0])[0]);
	assert.isNull(sv.getTabFromChild(gBrowser.parentNode));
	assert.isNull(sv.getTabFromChild(gBrowser.contentWindow.document.documentElement));
}

function test_getTabBrowserFromChild()
{
	function assertTabBrowserChild(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabBrowserFromChild(aArgument));
	}

	var node = tabs[0].ownerDocument.getAnonymousNodes(tabs[0])[0];
	assertTabBrowserChild(gBrowser, tabs[0]);
	assertTabBrowserChild(gBrowser, node);
	assert.isNull(sv.getTabBrowserFromChild(gBrowser.parentNode));
	assert.isNull(sv.getTabBrowserFromChild(gBrowser.contentWindow.document.documentElement));
}

function test_getTabBrowserFromFrame()
{
	function assertTabBrowserFrame(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabBrowserFromFrame(aArgument));
	}

	assertTabBrowserFrame(gBrowser, tabs[1].linkedBrowser.contentWindow);
	assertTabBrowserFrame(gBrowser, tabs[2].linkedBrowser.contentWindow.frames[1]);
	assertTabBrowserFrame(gBrowser, tabs[3].linkedBrowser.contentWindow.frames[0]);
	assertTabBrowserFrame(gBrowser, window);
	assertTabBrowserFrame(gBrowser, null);
}

function test_getBrowserFromTabBrowserElements()
{
	function assertBrowser(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getBrowserFromTabBrowserElements(aArgument));
	}

	var tab, browser;

	tab = gBrowser.selectedTab;
	browser = tab.linkedBrowser;
	assertBrowser(browser, browser);
	assertBrowser(browser, tab);
	assertBrowser(browser, tab.linkedBrowser);
	assertBrowser(browser, tab.ownerDocument.getAnonymousNodes(tab)[0]);

	assertBrowser(tabs[2].linkedBrowser, tabs[2]);

	assertBrowser(browser, null);
	assertBrowser(browser, gBrowser);
	assert.isNull(sv.getBrowserFromTabBrowserElements(gBrowser.parentNode));
}

function test_tabID()
{
	var id = sv.makeNewId();
	assert.match(/^tab-<\d+-\d+>$/, id);

	id = tabs[3].getAttribute(sv.kID);
	assert.equals(tabs[3], sv.getTabById(id, gBrowser));
}

function test_getTabs()
{
	var result = sv.getTabs(gBrowser);
	assert.equals(4, result.length);

	var gotTabs = [];
	for (var i = 0, maxi = result.length; i < maxi; i++)
	{
		gotTabs.push(result[i]);
	}
	assert.equals(4, gotTabs.length);
	assert.equals(tabs, gotTabs);

	assert.equals(tabs[0], sv.getFirstTab(gBrowser));
	assert.equals(tabs[3], sv.getLastTab(gBrowser));
	assert.equals(tabs[1], sv.getNextTab(tabs[0]));
	assert.isNull(sv.getNextTab(tabs[3]));
	assert.equals(tabs[1], sv.getPreviousTab(tabs[2]));
	assert.isNull(sv.getPreviousTab(tabs[0]));

	assert.equals(0, sv.getTabIndex(tabs[0]));
	assert.equals(1, sv.getTabIndex(tabs[1]));
	assert.equals(2, sv.getTabIndex(tabs[2]));
	assert.equals(3, sv.getTabIndex(tabs[3]));
}

function test_canCollapseSubtree()
{
	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.isTrue(sv.canCollapseSubtree(gBrowser));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.isFalse(sv.canCollapseSubtree(gBrowser));
}

function test_isCollapsed()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.isFalse(sv.isCollapsed(tabs[0]));
	assert.isTrue(sv.isCollapsed(tabs[1]));
	assert.isFalse(sv.isCollapsed(tabs[2]));
	assert.isTrue(sv.isCollapsed(tabs[3]));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.isFalse(sv.isCollapsed(tabs[0]));
	assert.isFalse(sv.isCollapsed(tabs[1]));
	assert.isFalse(sv.isCollapsed(tabs[2]));
	assert.isFalse(sv.isCollapsed(tabs[3]));
}

function test_getNextVisibleTab()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.equals(tabs[2], sv.getNextVisibleTab(tabs[0]));
	assert.equals(tabs[2], sv.getNextVisibleTab(tabs[1]));
	assert.isNull(sv.getNextVisibleTab(tabs[2]));
	assert.isNull(sv.getNextVisibleTab(tabs[3]));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.equals(tabs[1], sv.getNextVisibleTab(tabs[0]));
	assert.equals(tabs[2], sv.getNextVisibleTab(tabs[1]));
	assert.equals(tabs[3], sv.getNextVisibleTab(tabs[2]));
	assert.isNull(sv.getNextVisibleTab(tabs[3]));
}

function test_getPreviousVisibleTab()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.isNull(sv.getPreviousVisibleTab(tabs[0]));
	assert.equals(tabs[0], sv.getPreviousVisibleTab(tabs[1]));
	assert.equals(tabs[0], sv.getPreviousVisibleTab(tabs[2]));
	assert.equals(tabs[2], sv.getPreviousVisibleTab(tabs[3]));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.equals(tabs[1], sv.getNextVisibleTab(tabs[0]));
	assert.equals(tabs[2], sv.getNextVisibleTab(tabs[1]));
	assert.equals(tabs[3], sv.getNextVisibleTab(tabs[2]));
	assert.isNull(sv.getNextVisibleTab(tabs[3]));
}

function test_getLastVisibleTab()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.equals(tabs[2], sv.getLastVisibleTab(tabs[0]));
	assert.equals(tabs[2], sv.getLastVisibleTab(tabs[1]));
	assert.equals(tabs[2], sv.getLastVisibleTab(tabs[2]));
	assert.equals(tabs[2], sv.getLastVisibleTab(tabs[3]));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.equals(tabs[3], sv.getLastVisibleTab(tabs[0]));
	assert.equals(tabs[3], sv.getLastVisibleTab(tabs[1]));
	assert.equals(tabs[3], sv.getLastVisibleTab(tabs[2]));
	assert.equals(tabs[3], sv.getLastVisibleTab(tabs[3]));
}

function test_getVisibleTabs()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);

	var visibleResult = sv.getVisibleTabs(tabs[0]);
	assert.equals(2, visibleResult.length);

	var visibleTabs = [];
	for (let i = 0, maxi = visibleResult.length; i < maxi; i++)
	{
		visibleTabs.push(visibleResult[i]);
	}
	assert.equals(2, visibleTabs.length);
	assert.equals([tabs[0], tabs[2]], visibleTabs);

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);

	visibleResult = sv.getVisibleTabs(tabs[0]);
	assert.equals(4, visibleResult.length);
}

function test_getVisibleTabsArray()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);

	var visibleTabs = sv.getVisibleTabsArray(tabs[0]);
	assert.equals([tabs[0], tabs[2]], visibleTabs);

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);

	visibleTabs = sv.getVisibleTabsArray(tabs[0]);
	assert.equals([tabs[0], tabs[1], tabs[2], tabs[3]], visibleTabs);
}

function test_getVisibleIndex()
{
	tabs[1].setAttribute(sv.kCOLLAPSED, true);
	tabs[3].setAttribute(sv.kCOLLAPSED, true);

	gBrowser.setAttribute(sv.kALLOW_COLLAPSE, true);
	assert.equals(0, sv.getVisibleIndex(tabs[0]));
	assert.equals(-1, sv.getVisibleIndex(tabs[1]));
	assert.equals(1, sv.getVisibleIndex(tabs[2]));
	assert.equals(-1, sv.getVisibleIndex(tabs[3]));

	gBrowser.removeAttribute(sv.kALLOW_COLLAPSE);
	assert.equals(0, sv.getVisibleIndex(tabs[0]));
	assert.equals(1, sv.getVisibleIndex(tabs[1]));
	assert.equals(2, sv.getVisibleIndex(tabs[2]));
	assert.equals(3, sv.getVisibleIndex(tabs[3]));
}

var randomKey = 'key-'+parseInt(Math.random() * 65000);
var SessionStore = Cc['@mozilla.org/browser/sessionstore;1']
					.getService(Ci.nsISessionStore)
test_setAndGetTabValue.setUp = function() {
	tabs.forEach(function(aTab) {
		var value = null;
		try {
			value = SessionStore.getTabValue(aTab, randomKey);
			assert.strictlyEquals('', value);
		}
		catch(e) {
			assert.isNull(value);
		}
	});
};
test_setAndGetTabValue.tearDown = function() {
	tabs.forEach(function(aTab) {
		try {
			SessionStore.setTabValue(aTab, randomKey, '');
			SessionStore.deleteTabValue(aTab, randomKey);
		}
		catch(e) {
		}
	});
};
function assertSetAndGetTabValue(aTab, aValue)
{
	assert.strictlyEquals('', sv.getTabValue(aTab, randomKey));
	sv.setTabValue(aTab, randomKey, aValue);
	assert.strictlyEquals(aValue, SessionStore.getTabValue(aTab, randomKey));
	assert.strictlyEquals(aValue, sv.getTabValue(aTab, randomKey));
	sv.deleteTabValue(aTab, randomKey);
	var value = null;
	try {
		value = SessionStore.getTabValue(aTab, randomKey);
		assert.strictlyEquals('', value);
	}
	catch(e) {
		assert.isNull(value);
	}
	assert.strictlyEquals('', sv.getTabValue(aTab, randomKey));
}
function test_setAndGetTabValue()
{
	assertSetAndGetTabValue(tabs[0], 'tab0');
	assertSetAndGetTabValue(tabs[1], 'tab1');
	assertSetAndGetTabValue(tabs[2], 'tab2');
}

function test_cleanUpTabsArray()
{
	var array = [0, 1, 2, 1, 3, 0]
			.map(function(aIndex) {
				return tabs[aIndex]
			});
	assert.equals(tabs, Array.slice(sv.cleanUpTabsArray(array)));
}


/*
sv.registerTabFocusAllowance(func)
sv.registerExpandTwistyAreaAllowance(func)

sv.isGroupTab(tab)

*/

