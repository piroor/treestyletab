TreeStyleTabService.preLoadImagesForStyle = function(aStyle) {
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
};

TreeStyleTabService._preLoadImagesForStyleDone = [];
TreeStyleTabService._preLoadImagesForStyleDoneImages = [];

TreeStyleTabService._preLoadImages = {
	'metal-left' : [
		'chrome://treestyletab/skin/metal/tab-active-l.png',
		'chrome://treestyletab/skin/metal/tab-inactive-l.png',
		'chrome://treestyletab/skin/metal/tab-active-selected-l.png',
		'chrome://treestyletab/skin/metal/tab-inactive-selected-l.png',
		'chrome://treestyletab/skin/metal/shadow-active-l.png',
		'chrome://treestyletab/skin/metal/shadow-inactive-l.png',
		'chrome://treestyletab/skin/metal/icon-bg.png'
	].concat(
		'MozBorderImage' in document.documentElement.style ?
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
		'chrome://treestyletab/skin/metal/shadow-inactive-r.png',
		'chrome://treestyletab/skin/metal/icon-bg.png'
	].concat(
		'MozBorderImage' in document.documentElement.style ?
			[
				'chrome://treestyletab/skin/metal/tab-active-middle.png',
				'chrome://treestyletab/skin/metal/tab-active-middle-selected.png',
				'chrome://treestyletab/skin/metal/tab-inactive-middle.png',
				'chrome://treestyletab/skin/metal/tab-inactive-middle-selected.png'
			] :
			[]
	)
};
