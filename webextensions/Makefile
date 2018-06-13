NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

EXTERNAL_LIB_DIR := $(CURDIR)/common
EXTERNAL_OPTION_LIB_DIR := $(CURDIR)/options
EXTERNAL_RESOURCES_LIB_DIR := $(CURDIR)/resources

.PHONY: xpi install_dependency lint format install_extlib

all: xpi

install_dependency:
	npm install

lint:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives

format:
	$(NPM_BIN_DIR)/eslint . --ext=.js --report-unused-disable-directives --fix

xpi: install_extlib lint ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js ../extlib/webextensions-lib-configs/Configs.js ../extlib/webextensions-lib-options/Options.js ../extlib/webextensions-lib-l10n/l10n.js ../extlib/webextensions-lib-rich-confirm/RichConfirm.js ../extlib/webextensions-lib-menu-ui/MenuUI.js ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js
	rm -f ./*.xpi
	zip -r -0 treestyletab-we.xpi manifest.json _locales common options background sidebar resources >/dev/null 2>/dev/null

install_extlib:
	cd .. && git submodule update
	cp ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js $(EXTERNAL_LIB_DIR)/; echo 'export default TabIdFixer;' >> $(EXTERNAL_LIB_DIR)/TabIdFixer.js
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js $(EXTERNAL_LIB_DIR)/; echo 'export default TabFavIconHelper;' >> $(EXTERNAL_LIB_DIR)/TabFavIconHelper.js
	cp ../extlib/webextensions-lib-rich-confirm/RichConfirm.js $(EXTERNAL_LIB_DIR)/; echo 'export default RichConfirm;' >> $(EXTERNAL_LIB_DIR)/RichConfirm.js
	cp ../extlib/webextensions-lib-menu-ui/MenuUI.js $(EXTERNAL_LIB_DIR)/; echo 'export default MenuUI;' >> $(EXTERNAL_LIB_DIR)/MenuUI.js
	cp ../extlib/webextensions-lib-configs/Configs.js $(EXTERNAL_LIB_DIR)/; echo 'export default Configs;' >> $(EXTERNAL_LIB_DIR)/Configs.js
	cp ../extlib/webextensions-lib-options/Options.js $(EXTERNAL_OPTION_LIB_DIR)/; echo 'export default Options;' >> $(EXTERNAL_OPTION_LIB_DIR)/Options.js
	cp ../extlib/webextensions-lib-l10n/l10n.js $(EXTERNAL_LIB_DIR)/; echo 'export default l10n;' >> $(EXTERNAL_LIB_DIR)/l10n.js
	cp ../extlib/webextensions-lib-l10n/l10n.js $(EXTERNAL_RESOURCES_LIB_DIR)/
	cp ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js $(EXTERNAL_OPTION_LIB_DIR)/; echo 'export default ShortcutCustomizeUI;' >> $(EXTERNAL_OPTION_LIB_DIR)/ShortcutCustomizeUI.js

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

