function getParentBrowserWindow()
{
	if (gParentBrowserWindow === void(0)) {
		try {
			gParentBrowserWindow = window
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIWebNavigation)
				.QueryInterface(Components.interfaces.nsIDocShell)
				.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
				.parent
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIWebNavigation)
				.document.defaultView;
			if (gParentBrowserWindow.location.href != 'chrome://browser/content/browser.xul')
				gParentBrowserWindow = null;
		}
		catch(e) {
			gParentBrowserWindow = null
		}
	}
	return gParentBrowserWindow;
}
var gParentBrowserWindow;

function getParentTreeStyleTabService()
{
	if (!getParentBrowserWindow()) return null;
	return getParentBrowserWindow().TreeStyleTabService;
}

function getParentBrowserViewSourceInfo()
{
	if (!getParentTreeStyleTabService()) return null;
	return getParentTreeStyleTabService().viewSource;
}

function getParentBrowserTab()
{
	if (!gOwnerTab) {
		var sv = getParentTreeStyleTabService();
		var b = sv.getTabBrowserFromFrame(window);
		gOwnerTab = sv.getTabFromFrame(window, b);
	}
	return gOwnerTab;
}
var gOwnerTab;



var gTreeStyleTabService = getParentTreeStyleTabService();
var gViewSourceInfo = getParentBrowserViewSourceInfo();
if (gViewSourceInfo && gViewSourceInfo.frame) {
	gTreeStyleTabService.setTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_URI, gViewSourceInfo.frame.location.href);
	gTreeStyleTabService.setTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_CHARSET, gViewSourceInfo.charset);
	gTreeStyleTabService.setTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_CONTEXT, gViewSourceInfo.context);
}
if (gTreeStyleTabService && !window.arguments) {
	window.arguments = [
		gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_URI),
		gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_CHARSET),
		gViewSourceInfo ? gViewSourceInfo.reference : null ,
		gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_CONTEXT)
	];
}

var gViewSourceDone = false;
if ('onLoadViewSource' in window) {
	eval('window.onLoadViewSource = '+
		window.onLoadViewSource.toSource().replace( // prevent infinity reloading
			'{',
			'{ if (gViewSourceDone) return; gViewSourceDone = true;'
		).replace(
			'}',
			'; if (gViewSourceInfo) gViewSourceInfo.clear(); }'
		)
	);
}

if ('onLoadViewPartialSource' in window) {
	eval('window.onLoadViewPartialSource = '+
		window.onLoadViewPartialSource.toSource().replace( // prevent infinity reloading
			'{',
			'{ if (gViewSourceDone) return; gViewSourceDone = true;'
		).replace(
			'window._content.focus();',
			'if (gViewSourceInfo) { gViewSourceInfo.clear(); }; window._content.focus();'
		)
	);
}
if ('viewPartialSourceForSelection' in window) {
	eval('window.viewPartialSourceForSelection = '+
		window.viewPartialSourceForSelection.toSource().replace(
			'{',
			<><![CDATA[
				{
					var selectionSource = gTreeStyleTabService ? gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE) : null ;
					if (!selectionSource) {
			]]></>
		).replace(
			/(getBrowser\(\)\.webNavigation\.[^\}]+)/,
			<><![CDATA[
				if (gTreeStyleTabService && !gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE)) {
					gTreeStyleTabService.setTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE, encodeURIComponent(tmpNode.innerHTML));
				}
				$1;
			}
			else {
				getBrowser().webNavigation.loadURI(
					'view-source:data:text/html;charset=utf-8,' + selectionSource,
					loadFlags, null, null, null);
			}]]></>
		)
	);
}
if ('viewPartialSourceForFragment' in window) {
	eval('window.viewPartialSourceForFragment = '+
		window.viewPartialSourceForFragment.toSource().replace(
			'{',
			<><![CDATA[
				{
					var fragmentSource = gTreeStyleTabService ? gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE) : null ;
					if (!fragmentSource) {
			]]></>
		).replace(
			'var doc = ',
			<><![CDATA[
					if (gTreeStyleTabService && !gTreeStyleTabService.getTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE)) {
						gTreeStyleTabService.setTabValue(getParentBrowserTab(), gTreeStyleTabService.kVIEWSOURCE_SOURCE, encodeURIComponent(source));
					}
				}
				else {
					var source = fragmentSource;
				}
				var doc = ]]></>
		)
	);
}
if ('drawSelection' in window) {
	eval('window.drawSelection = '+
		window.drawSelection.toSource().replace(
			'{',
			'{ try { window.document.getElementById("appcontent").removeEventListener("load", drawSelection, true); } catch(e) {};'
		)
	);
}
