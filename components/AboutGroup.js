/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2009-2016
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Ohnuma <https://github.com/lv7777>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');

function AboutGroup()
{
}

AboutGroup.prototype = {
	contractID : '@mozilla.org/network/protocol/about;1?what=treestyletab-group',
	classDescription : 'about-treestyletab-group',
	classID : Components.ID('{305122d0-5bdc-11de-8a39-0800200c9a66}'),

	newChannel : function(aURI)
	{
		const version = Services.appinfo.platformVersion;
		const comp = Services.vc.compare('48.*', version);
		if (comp > 0) {
			return Services.io.newChannel('chrome://treestyletab/content/group.xul', null, null);
		}
		else {
			return Services.io.newChannel2(
				'chrome://treestyletab/content/group.xul',
				null,
				null,
				null,
				Services.scriptSecurityManager.getSystemPrincipal(),
				Services.scriptSecurityManager.getSystemPrincipal(),
				Components.interfaces.nsILoadInfo.SEC_REQUIRE_SAME_ORIGIN_DATA_IS_BLOCKED,
				Components.interfaces.nsIContentPolicy.TYPE_OTHER
			);
		}
	},

	getURIFlags : function(aURI)
	{
		return 0;
	},

	QueryInterface : XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule])
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutGroup]);
