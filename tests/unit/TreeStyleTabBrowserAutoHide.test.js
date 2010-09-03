utils.include(baseURL+'../../content/treestyletab/treestyletab.js');
utils.include(baseURL+'../../content/treestyletab/treestyletabbrowser_autoHide.js');

var autoHide;
var owner;

function setUp()
{
	owner = new Mock('owner mock');
	Mock.expect(TreeStyleTabBrowserAutoHide.prototype, 'init', []);
	autoHide = new TreeStyleTabBrowserAutoHide(owner);
}

function tearDown()
{
}


function test_fireStateChangingEvent()
{
	var expanded = Math.random() + Date.now() + 'expanded';
	var state    = Math.random() + Date.now() + 'state';

	owner.browser = new Mock('browser');
	owner.browser.expect('dispatchEvent', TypeOf(Ci.nsIDOMEvent))
				.then(function(aEvent) {
					assert.equals(expanded, aEvent.shown);
					assert.equals(state, aEvent.state);
				});
	Mock.expectGet(autoHide, 'expanded', expanded);
	Mock.expectGet(autoHide, 'state', state);

	autoHide.fireStateChangingEvent();
}


