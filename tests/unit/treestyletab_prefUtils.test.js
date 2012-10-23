utils.import('../../modules/utils.js');
assert.isDefined(TreeStyleTabUtils);

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
	clearTestPrefs();
}

function tearDown()
{
	clearTestPrefs();
}

function test_setAndGetPref()
{
	function assertSetAndGetTreePref(aPref, aValue)
	{
		assert.isNull(utils.getPref(root+aPref));
		assert.isNull(TreeStyleTabUtils.getTreePref(aPref));

		TreeStyleTabUtils.setTreePref(aPref, aValue);

		assert.isNotNull(utils.getPref(root+aPref));
		assert.equals(aValue, utils.getPref(root+aPref));

		assert.isNotNull(TreeStyleTabUtils.getTreePref(aPref));
		assert.equals(aValue, TreeStyleTabUtils.getTreePref(aPref));
	}

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

	TreeStyleTabUtils.prefs.addPrefListener(singleDomainListener);
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
	TreeStyleTabUtils.prefs.removePrefListener(singleDomainListener);
	utils.setPref(root+random+'.domain1.pref', true);
	utils.setPref(root+random+'.domain1.pref', false);
	assert.equals([], singleDomainListener.messages);

	TreeStyleTabUtils.prefs.addPrefListener(multipleDomainsListener);
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
	TreeStyleTabUtils.prefs.removePrefListener(multipleDomainsListener);
	utils.setPref(root+random+'.domain2.pref', true);
	utils.setPref(root+random+'.domain3.pref', true);
	utils.setPref(root+random+'.domain2.pref', false);
	utils.setPref(root+random+'.domain3.pref', false);
	assert.equals([], multipleDomainsListener.messages);
}
