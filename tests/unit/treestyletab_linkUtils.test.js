var win;
var sv;

function setUp()
{
	utils.setPref('browser.tabs.warnOnClose', false);

	yield utils.setUpTestWindow();
	win = utils.getTestWindow();
	sv = win.TreeStyleTabService;

	yield Do(utils.addTab('../fixtures/links.html'));
	var tabs = gBrowser.mTabs;
	gBrowser.removeAllTabsBut(tabs[tabs.length-1]);
	assert.equals(1, tabs.length);
}

function tearDown()
{
	win = null;
	utils.tearDownTestWindow();
}

function $(aId)
{
	return content.document.getElementById(aId);
}

function test_getCurrentFrame()
{
	yield Do(utils.addTab('../fixtures/frameTest.html'));
	yield Do(utils.addTab('../fixtures/frameTestInline.html'));
	var tabs = gBrowser.mTabs;
	assert.equals(3, tabs.length);

	var frame;

	frame = gBrowser.contentWindow;
	assert.equals(frame, sv.getCurrentFrame());
	assert.equals(frame, sv.getCurrentFrame(frame));

	frame = tabs[1].linkedBrowser.contentWindow.frames[1];
	assert.equals(frame, sv.getCurrentFrame(frame));

	frame = tabs[2].linkedBrowser.contentWindow.frames[0];
	assert.equals(frame, sv.getCurrentFrame(frame));
}

function test_getLinksInRange()
{
	var range = content.document.createRange();

	range.setStartBefore($('item2'));
	range.setEndAfter($('item4'));
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);

	range.setStartBefore($('link2'));
	range.setEndAfter($('link4'));
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);

	range.setStartBefore($('em2'));
	range.setEndAfter($('em4'));
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);

	range.setStart($('em2').firstChild, 2);
	range.setEnd($('em4').firstChild, 2);
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);

	range.setStartAfter($('em1'));
	range.setEndBefore($('em5'));
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);

	range.setStartAfter($('em1').firstChild);
	range.setEndBefore($('em5').firstChild);
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getLinksInRange(range)
	);
}

function test_getSelectionLinks()
{
	var selection = content.getSelection();
	assert.equals(0, selection.rangeCount);

	var range1 = content.document.createRange();
	range1.setStartBefore($('link2'));
	range1.setEndAfter($('link4'));
	selection.addRange(range1);

	assert.equals(1, selection.rangeCount);
	assert.equals(
		[$('link2'), $('link3'), $('link4')],
		sv.getSelectionLinks(content)
	);

	var range2 = content.document.createRange();
	range2.setStartBefore($('link6'));
	range2.setEndAfter($('link8'));
	selection.addRange(range2);

	var range3 = content.document.createRange();
	range3.setStartBefore($('link12'));
	range3.setEndAfter($('link14'));
	selection.addRange(range3);

	assert.equals(3, selection.rangeCount);
	assert.equals(
		[$('link2'), $('link3'), $('link4'),
		 $('link6'), $('link7'), $('link8'),
		 $('link12'), $('link13'), $('link14')],
		sv.getSelectionLinks(content)
	);

	selection.removeAllRanges();
	range1.detach();
	range2.detach();
	range3.detach();
}

function test_openSelectionLinks()
{
	function assert_openSelectionLinksInFrame(aFrame)
	{
		function $(aId)
		{
			return aFrame.document.getElementById(aId);
		}

		gBrowser.removeAllTabsBut(gBrowser.selectedTab);
		assert.equals(1, gBrowser.mTabs.length);

		var selection = aFrame.getSelection();
		assert.equals(0, selection.rangeCount);

		var range1 = aFrame.document.createRange();
		range1.setStartBefore($('link2'));
		range1.setEndAfter($('link4'));
		selection.addRange(range1);
		assert.equals(1, selection.rangeCount);

		var tabs = gBrowser.mTabs;
		assert.equals(1, tabs.length);

		sv.openSelectionLinks(aFrame);
		assert.equals(4, tabs.length);
		assert.equals(
			[tabs[1], tabs[2], tabs[3]],
			sv.getChildTabs(tabs[0])
		);

		gBrowser.removeAllTabsBut(tabs[0]);
		assert.equals(1, tabs.length);

		var range2 = aFrame.document.createRange();
		range2.setStartBefore($('link6'));
		range2.setEndAfter($('link8'));
		selection.addRange(range2);

		var range3 = aFrame.document.createRange();
		range3.setStartBefore($('link12'));
		range3.setEndAfter($('link14'));
		selection.addRange(range3);

		sv.openSelectionLinks(aFrame);
		assert.equals(10, tabs.length);
		assert.equals(
			[tabs[1], tabs[2], tabs[3],
			 tabs[4], tabs[5], tabs[6],
			 tabs[7], tabs[8], tabs[9]],
			sv.getChildTabs(tabs[0])
		);

		selection.removeAllRanges();
		range1.detach();
		range2.detach();
		range3.detach();
	}

	assert_openSelectionLinksInFrame(content);

	yield Do(utils.addTab('../fixtures/frameTest.html', { selected : true }));
	assert_openSelectionLinksInFrame(content.frames[2]);

	yield Do(utils.addTab('../fixtures/frameTestInline.html', { selected : true }));
	assert_openSelectionLinksInFrame(content.frames[1]);
}
