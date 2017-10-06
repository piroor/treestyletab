.PHONY: xpi

xpi: ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js
	cd .. && git submodule update
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js common/
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	rm -f ./*.xpi
	zip -r -0 treestyletab-we.xpi *.json *.js _locales common options background sidebar resources >/dev/null 2>/dev/null

../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-configs/Configs.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-options/Options.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-l10n/l10n.js:
	cd .. && git submodule update --init

