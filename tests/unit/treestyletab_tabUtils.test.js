var win;
var sv;

function setUp()
{
	yield utils.setUpTestWindow();
	win = utils.getTestWindow();
	sv = win.TreeStyleTabService;

	utils.setPref('browser.tabs.warnOnClose', false);
	gBrowser.removeAllTabsBut(gBrowser.selectedTab);
	yield Do(utils.addTab('about:logo'));
	yield Do(utils.addTab('../fixtures/frameTest.html'));
	yield Do(utils.addTab('../fixtures/frameTestInline.html'));
	assert.equals(4, gBrowser.mTabs.length);
}

function tearDown()
{
	utils.tearDownTestWindow();
}

function test_getTabFromFrame()
{
	function assertTabFrame(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabFromFrame(aArgument));
	}

	var tabs = gBrowser.mTabs;
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

	var tab = gBrowser.selectedTab;
	assertTabChild(tab, tab);
	assertTabChild(tab, tab.ownerDocument.getAnonymousNodes(tab)[0]);
	assert.isNull(sv.getTabFromChild(gBrowser.parentNode));
	assert.isNull(sv.getTabFromChild(gBrowser.contentWindow.document.documentElement));
}

function test_getTabBrowserFromChild()
{
	function assertTabBrowserChild(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getTabBrowserFromChild(aArgument));
	}

	var tab = gBrowser.selectedTab;
	var node = tab.ownerDocument.getAnonymousNodes(tab)[0];
	assertTabBrowserChild(gBrowser, tab);
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

	var tabs = gBrowser.mTabs;
	assertTabBrowserFrame(gBrowser, tabs[1].linkedBrowser.contentWindow);
	assertTabBrowserFrame(gBrowser, tabs[2].linkedBrowser.contentWindow.frames[1]);
	assertTabBrowserFrame(gBrowser, tabs[3].linkedBrowser.contentWindow.frames[0]);
	assertTabBrowserFrame(gBrowser, window);
	assertTabBrowserFrame(gBrowser, null);
}

function test_getFrameFromTabBrowserElements()
{
	function assertFrameTabBrowser(aExpected, aArgument)
	{
		assert.equals(aExpected, sv.getFrameFromTabBrowserElements(aArgument));
	}

	var tabs = gBrowser.mTabs;
	var tab, frame;

	tab = gBrowser.selectedTab;
	frame = gBrowser.contentWindow;
	assertFrameTabBrowser(frame, frame);
	assertFrameTabBrowser(frame, tab);
	assertFrameTabBrowser(frame, tab.linkedBrowser);
	assertFrameTabBrowser(frame, tab.ownerDocument.getAnonymousNodes(tab)[0]);

	assertFrameTabBrowser(tabs[2].linkedBrowser.contentWindow, tabs[2]);
	frame = tabs[2].linkedBrowser.contentWindow.frames[1];
	assertFrameTabBrowser(frame, frame);

	assertFrameTabBrowser(tabs[3].linkedBrowser.contentWindow, tabs[3]);
	frame = tabs[3].linkedBrowser.contentWindow.frames[0];
	assertFrameTabBrowser(frame, frame);

	assertFrameTabBrowser(gBrowser.contentWindow, null);
	assertFrameTabBrowser(gBrowser.contentWindow, gBrowser);
	assert.isNull(sv.getFrameFromTabBrowserElements(gBrowser.parentNode));
}
