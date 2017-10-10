NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

.PHONY: xpi install_dependency eslint

all: xpi

install_dependency:
	npm install

eslint:
	$(NPM_BIN_DIR)/eslint . --ext=.js –report-unused-disable-directives

xpi: ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js
	cd .. && git submodule update
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js common/
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	rm -f ./*.xpi
	$(MAKE) eslint -C $(CURDIR)
	zip -r -0 treestyletab-we.xpi manifest.json _locales common options background sidebar resources >/dev/null 2>/dev/null

../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-configs/Configs.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-options/Options.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-l10n/l10n.js:
	cd .. && git submodule update --init

