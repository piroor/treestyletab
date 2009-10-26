var namespace = { window : { addEventListener : function() {} } };
utils.include('../../content/treestyletab/res/prefs.js', namespace, 'Shift_JIS');
utils.include('../../content/treestyletab/treestyletab.js', namespace, 'Shift_JIS');

var sv;
var random = parseInt(Math.random() * 65000);
var root = 'extensions.treestyletab.';

function clearTestPrefs()
{
	utils.clearPref(random+'.bool');
	utils.clearPref(random+'.int');
	utils.clearPref(random+'.string');
	utils.clearPref('extensions.treestyletab.'+random+'.bool');
	utils.clearPref('extensions.treestyletab.'+random+'.int');
	utils.clearPref('extensions.treestyletab.'+random+'.string');
	utils.clearPref('extensions.treestyletab.'+random+'.domain1.pref');
	utils.clearPref('extensions.treestyletab.'+random+'.domain2.pref');
	utils.clearPref('extensions.treestyletab.'+random+'.domain3.pref');
}

function setUp()
{
	sv = {};
	sv.__proto__ = namespace.TreeStyleTabService;
	clearTestPrefs();
}

function tearDown()
{
	clearTestPrefs();
}

function test_setAndGetPref()
{
	function assertSetAndGetPref(aPref, aValue)
	{
		assert.isNull(utils.getPref(aPref));
		assert.isNull(sv.getPref(aPref));

		sv.setPref(aPref, aValue);

		assert.isNotNull(utils.getPref(aPref));
		assert.equals(aValue, utils.getPref(aPref));

		assert.isNotNull(sv.getPref(aPref));
		assert.equals(aValue, sv.getPref(aPref));

		sv.clearPref(aPref);
		assert.isNull(utils.getPref(aPref));
		assert.isNull(sv.getPref(aPref));
	}

	function assertSetAndGetTreePref(aPref, aValue)
	{
		assert.isNull(utils.getPref(root+aPref));
		assert.isNull(sv.getTreePref(aPref));

		sv.setTreePref(aPref, aValue);

		assert.isNotNull(utils.getPref(root+aPref));
		assert.equals(aValue, utils.getPref(root+aPref));

		assert.isNotNull(sv.getTreePref(aPref));
		assert.equals(aValue, sv.getTreePref(aPref));
	}

	assertSetAndGetPref(random+'.bool', true);
	assertSetAndGetPref(random+'.int', 29);
	assertSetAndGetPref(random+'.string', 'string');

	assertSetAndGetTreePref(random+'.bool', true);
	assertSetAndGetTreePref(random+'.int', 29);
	assertSetAndGetTreePref(random+'.string', 'string');
}

function test_listeners()
{
	var singleDomainListener = {
			domain  : root+random+'.domain1',
			observe : function(aSubject, aTopic, aData)
			{
				this.messages.push([aTopic, aData]);
			},
			messages : []
		};

	var multipleDomainsListener = {
			domains : [
				root+random+'.domain2',
				root+random+'.domain3'
			],
			observe : function(aSubject, aTopic, aData)
			{
				this.messages.push([aTopic, aData]);
			},
			messages : []
		};

	sv.addPrefListener(singleDomainListener);
	utils.setPref(root+random+'.domain1.pref', true);
	utils.setPref(root+random+'.domain1.pref', false);
	assert.equals(
		[
			['nsPref:changed', root+random+'.domain1.pref'],
			['nsPref:changed', root+random+'.domain1.pref']
		],
		singleDomainListener.messages
	);
	singleDomainListener.messages = [];
	sv.removePrefListener(singleDomainListener);
	utils.setPref(root+random+'.domain1.pref', true);
	utils.setPref(root+random+'.domain1.pref', false);
	assert.equals([], singleDomainListener.messages);

	sv.addPrefListener(multipleDomainsListener);
	utils.setPref(root+random+'.domain2.pref', true);
	utils.setPref(root+random+'.domain3.pref', true);
	utils.setPref(root+random+'.domain2.pref', false);
	utils.setPref(root+random+'.domain3.pref', false);
	assert.equals(
		[
			['nsPref:changed', root+random+'.domain2.pref'],
			['nsPref:changed', root+random+'.domain3.pref'],
			['nsPref:changed', root+random+'.domain2.pref'],
			['nsPref:changed', root+random+'.domain3.pref']
		],
		multipleDomainsListener.messages
	);
	multipleDomainsListener.messages = [];
	sv.removePrefListener(multipleDomainsListener);
	utils.setPref(root+random+'.domain2.pref', true);
	utils.setPref(root+random+'.domain3.pref', true);
	utils.setPref(root+random+'.domain2.pref', false);
	utils.setPref(root+random+'.domain3.pref', false);
	assert.equals([], multipleDomainsListener.messages);
}
