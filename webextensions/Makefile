.PHONY: xpi

xpi: ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js
	cd .. && git submodule update
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	rm -f ./*.xpi
	zip -r -0 treestyletab-we.xpi *.json *.js _locales common options background sidebar resources

../extlib/webextensions-lib-configs/Configs.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-options/Options.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-l10n/l10n.js:
	cd .. && git submodule update --init

