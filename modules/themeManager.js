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
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
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
 
const EXPORTED_SYMBOLS = ['TreeStyleTabThemeManager']; 

Components.utils.import('resource://treestyletab-modules/utils.js');

var TreeStyleTabThemeManager = {
	preLoadImagesForStyle : function(aStyle)
	{
		if (!aStyle ||
			this._preLoadImagesForStyleDone.indexOf(aStyle) > -1)
			return;
		this._preLoadImagesForStyleDone.push(aStyle);

		var images = aStyle in this._preLoadImages ?
				this._preLoadImages[aStyle] :
				null ;
		if (!images) return;

		images.forEach(function(aImage) {
			if (this._preLoadImagesForStyleDoneImages.indexOf(aImage) > -1)
				return;

			(new Image()).src = aImage;
			this._preLoadImagesForStyleDoneImages.push(aImage);
		}, this);
	},
	_preLoadImagesForStyleDone : [],
	_preLoadImagesForStyleDoneImages : [],
	_preLoadImages : {
		'metal-left' : [
			'chrome://treestyletab/skin/metal/tab-active-l.png',
			'chrome://treestyletab/skin/metal/tab-inactive-l.png',
			'chrome://treestyletab/skin/metal/tab-active-selected-l.png',
			'chrome://treestyletab/skin/metal/tab-inactive-selected-l.png',
			'chrome://treestyletab/skin/metal/shadow-active-l.png',
			'chrome://treestyletab/skin/metal/shadow-inactive-l.png'
		].concat(
			TreeStyleTabUtils.Comparator.compare(TreeStyleTabUtils.XULAppInfo.version, '3.5') >= 0 ?
				[
					'chrome://treestyletab/skin/metal/tab-active-middle.png',
					'chrome://treestyletab/skin/metal/tab-active-middle-selected.png',
					'chrome://treestyletab/skin/metal/tab-inactive-middle.png',
					'chrome://treestyletab/skin/metal/tab-inactive-middle-selected.png'
				] :
				[]
		),
		'metal-right' : [
			'chrome://treestyletab/skin/metal/tab-active-r.png',
			'chrome://treestyletab/skin/metal/tab-inactive-r.png',
			'chrome://treestyletab/skin/metal/tab-active-selected-r.png',
			'chrome://treestyletab/skin/metal/tab-inactive-selected-r.png',
			'chrome://treestyletab/skin/metal/shadow-active-r.png',
			'chrome://treestyletab/skin/metal/shadow-inactive-r.png'
		].concat(
			TreeStyleTabUtils.Comparator.compare(TreeStyleTabUtils.XULAppInfo.version, '3.5') >= 0 ?
				[
					'chrome://treestyletab/skin/metal/tab-active-middle.png',
					'chrome://treestyletab/skin/metal/tab-active-middle-selected.png',
					'chrome://treestyletab/skin/metal/tab-inactive-middle.png',
					'chrome://treestyletab/skin/metal/tab-inactive-middle-selected.png'
				] :
				[]
		)
	}
};
