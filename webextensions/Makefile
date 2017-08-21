.PHONY: xpi

xpi: ../extlib/fxaddonlib-inherit/inherit.jsm ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js
	cd .. && git submodule update
	cp ../extlib/fxaddonlib-inherit/inherit.jsm common/
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	zip -r -0 treestyletab-we.xpi *.json *.js _locales common options

../extlib/fxaddonlib-inherit/inherit.jsm:
	cd .. && git submodule update --init

../extlib/webextensions-lib-configs/Configs.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-options/Options.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-l10n/l10n.js:
	cd .. && git submodule update --init

