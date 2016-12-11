/*
 Backporting "visuallyselected" for Firefox 31-40

 See also:
   http://www.hackermusings.com/2015/06/electrolysis-a-tale-of-tab-switching-and-themes/

 Usage:
   Components.utils.import(".../path/to/visuallyselectedTabs.jsm");
   visuallyselectedTabs(gBrowser);

 license: The MIT License, Copyright (c) 2015-2016 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/fxaddonlib-visuallyselected-tabs
*/

var EXPORTED_SYMBOLS = ['visuallyselectedTabs'];

Components.utils.import('resource://gre/modules/Services.jsm');

function setVisuallySelected(aNode, aSelected) {
  if (!aNode || typeof aNode.setAttribute != 'function')
    return;

  if (aSelected)
    aNode.setAttribute('visuallyselected', true);
  else
    aNode.removeAttribute('visuallyselected');

  for (let aChild of aNode.childNodes)
  {
    setVisuallySelected(aChild, aSelected);
  }

  var anonymousChildren = aNode.ownerDocument.getAnonymousNodes(aNode);
  if (anonymousChildren && anonymousChildren.length > 0) {
    for (let aAnonymousChild of anonymousChildren)
    {
      setVisuallySelected(aAnonymousChild, aSelected);
    }
  }
}

function visuallyselectedTabs(aTabBrowser) {
  if (!aTabBrowser ||
      aTabBrowser.localName != 'tabbrowser' ||
      aTabBrowser.__visuallyselectedTabsInstalled ||
      Services.vc.compare(Services.appinfo.platformVersion, '41.0a1') >= 0)
    return;

  aTabBrowser.__visuallyselectedTabsInstalled = true;

  function onTabSelect(aEvent) {
    var prevTab = aEvent.detail && aEvent.detail.previousTab;
    if (prevTab)
      setVisuallySelected(prevTab, false);

    setVisuallySelected(aEvent.originalTarget, true);
  }

  var tabsContainer = aTabBrowser.tabContainer;
  tabsContainer.addEventListener('TabSelect', onTabSelect, false);

  setVisuallySelected(aTabBrowser.selectedTab, true);

  var document = aTabBrowser.ownerDocument;
  document.addEventListener('unload', function onUnload(aEvent) {
    document.removeEventListener('unload', onUnload, false);
    tabsContainer.removeEventListener('TabSelect', onTabSelect, false);
  }, false);
}
