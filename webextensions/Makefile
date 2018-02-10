NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

.PHONY: xpi install_dependency lint format

all: xpi

install_dependency:
	npm install

lint:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives

format:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives --fix

xpi: lint ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js ../extlib/webextensions-lib-rich-confirm/RichConfirm.js ../extlib/webextensions-lib-menu-ui/MenuUI.js ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js
	cd .. && git submodule update
	cp ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js common/
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js common/
	cp ../extlib/webextensions-lib-rich-confirm/RichConfirm.js common/
	cp ../extlib/webextensions-lib-menu-ui/MenuUI.js common/
	cp ../extlib/webextensions-lib-configs/Configs.js common/
	cp ../extlib/webextensions-lib-options/Options.js options/
	cp ../extlib/webextensions-lib-l10n/l10n.js common/
	cp ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js options/
	rm -f ./*.xpi
	zip -r -0 treestyletab-we.xpi manifest.json _locales common options background sidebar resources >/dev/null 2>/dev/null

../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-configs/Configs.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-options/Options.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-l10n/l10n.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-rich-confirm/RichConfirm.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-menu-ui/MenuUI.js:
	cd .. && git submodule update --init

../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js:
	cd .. && git submodule update --init

