var autoHideFile = baseURL+'../../content/treestyletab/treestyletabbrowser_autoHide.js';

utils.include(baseURL+'../../content/treestyletab/treestyletab.js');
utils.include(autoHideFile);
var TSTBAutoHide = TreeStyleTabBrowserAutoHide;

var autoHide;
var owner;

function setUp()
{
	utils.include(autoHideFile);

	utils.setUpTestWindow();

	var w = utils.getTestWindow();
	owner = { browser : w.gBrowser };
	TreeStyleTabBrowserAutoHide.prototype.init = function() {};
	autoHide = new TreeStyleTabBrowserAutoHide(owner);
}

function tearDown()
{
	utils.tearDownTestWindow();
	owner = null;
}

test_fireStateChangingEvent.parameters = {
	expanded : {
		state : TSTBAutoHide.prototype.kSTATE_EXPANDED,
		shown : true
	},
	shrunken : {
		state : TSTBAutoHide.prototype.kSTATE_SHRUNKEN,
		shown : false
	},
	hidden : {
		state : TSTBAutoHide.prototype.kSTATE_HIDDEN,
		shown : false
	}
};
test_fireStateChangingEvent.assertions = 2;
function test_fireStateChangingEvent(aParamter)
{
	var w = utils.getTestWindow();

	w.gBrowser.setAttribute(TSTBAutoHide.prototype.kSTATE, aParamter.state);

	w.addEventListener('TreeStyleTabAutoHideStateChanging', function(aEvent) {
		w.removeEventListener('TreeStyleTabAutoHideStateChanging', arguments.callee, false);
		assert.equals(aParamter.shown, aEvent.shown);
		assert.equals(aParamter.state, aEvent.state);
	}, false);

	autoHide.fireStateChangingEvent();
}
