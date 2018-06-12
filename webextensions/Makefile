NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

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
	cp ../extlib/webextensions-lib-tab-id-fixer/TabIdFixer.js common/; echo 'export default TabIdFixer;' >> common/TabIdFixer.js
	cp ../extlib/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js common/; echo 'export default TabFavIconHelper;' >> common/TabFavIconHelper.js
	cp ../extlib/webextensions-lib-rich-confirm/RichConfirm.js common/; echo 'export default RichConfirm;' >> common/RichConfirm.js
	cp ../extlib/webextensions-lib-menu-ui/MenuUI.js common/; echo 'export default MenuUI;' >> common/MenuUI.js
	cp ../extlib/webextensions-lib-configs/Configs.js common/; echo 'export default Configs;' >> common/Configs.js
	cp ../extlib/webextensions-lib-options/Options.js options/; echo 'export default Options;' >> options/Options.js
	cp ../extlib/webextensions-lib-l10n/l10n.js common/; echo 'export default l10n;' >> common/l10n.js
	cp ../extlib/webextensions-lib-l10n/l10n.js resources/
	cp ../extlib/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js options/; echo 'export default ShortcutCustomizeUI;' >> options/ShortcutCustomizeUI.js

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

