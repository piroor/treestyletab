NPM_MOD_DIR := $(CURDIR)/node_modules
NPM_BIN_DIR := $(NPM_MOD_DIR)/.bin

EXTERNAL_LIB_DIR := $(CURDIR)/extlib

.PHONY: xpi install_dependency lint format update_extlib install_extlib

all: xpi

install_dependency:
	[ -e "$(NPM_BIN_DIR)/eslint" -a -e "$(NPM_BIN_DIR)/jsonlint-cli" ] || npm install --save-dev

lint: install_dependency
	"$(NPM_BIN_DIR)/eslint" . --ext=.js --report-unused-disable-directives
	find . -type d -name node_modules -prune -o -type f -name '*.json' -print | xargs "$(NPM_BIN_DIR)/jsonlint-cli"

format: install_dependency
	"$(NPM_BIN_DIR)/eslint" . --ext=.js --report-unused-disable-directives --fix

xpi: update_extlib install_extlib lint
	rm -f ./*.xpi
	zip -r -0 treestyletab-we.xpi manifest.json _locales common options background sidebar resources extlib tests -x '*/.*' >/dev/null 2>/dev/null

update_extlib:
	cd .. && git submodule update --init

install_extlib:
	rm -f $(EXTERNAL_LIB_DIR)/*.js
	cp ../submodules/webextensions-lib-event-listener-manager/EventListenerManager.js $(EXTERNAL_LIB_DIR)/
	cp ../submodules/webextensions-lib-tab-id-fixer/TabIdFixer.js $(EXTERNAL_LIB_DIR)/; echo 'export default TabIdFixer;' >> $(EXTERNAL_LIB_DIR)/TabIdFixer.js
	cp ../submodules/webextensions-lib-tab-favicon-helper/TabFavIconHelper.js $(EXTERNAL_LIB_DIR)/; echo 'export default TabFavIconHelper;' >> $(EXTERNAL_LIB_DIR)/TabFavIconHelper.js
	cp ../submodules/webextensions-lib-rich-confirm/RichConfirm.js $(EXTERNAL_LIB_DIR)/; echo 'export default RichConfirm;' >> $(EXTERNAL_LIB_DIR)/RichConfirm.js
	cp ../submodules/webextensions-lib-menu-ui/MenuUI.js $(EXTERNAL_LIB_DIR)/; echo 'export default MenuUI;' >> $(EXTERNAL_LIB_DIR)/MenuUI.js
	cp ../submodules/webextensions-lib-configs/Configs.js $(EXTERNAL_LIB_DIR)/; echo 'export default Configs;' >> $(EXTERNAL_LIB_DIR)/Configs.js
	cp ../submodules/webextensions-lib-options/Options.js $(EXTERNAL_LIB_DIR)/; echo 'export default Options;' >> $(EXTERNAL_LIB_DIR)/Options.js
	cp ../submodules/webextensions-lib-l10n/l10n.js $(EXTERNAL_LIB_DIR)/; echo 'export default l10n;' >> $(EXTERNAL_LIB_DIR)/l10n.js
	cp ../submodules/webextensions-lib-l10n/l10n.js $(EXTERNAL_LIB_DIR)/l10n-classic.js; echo 'window.l10n = l10n;' >> $(EXTERNAL_LIB_DIR)/l10n-classic.js
	cp ../submodules/webextensions-lib-shortcut-customize-ui/ShortcutCustomizeUI.js $(EXTERNAL_LIB_DIR)/; echo 'export default ShortcutCustomizeUI;' >> $(EXTERNAL_LIB_DIR)/ShortcutCustomizeUI.js

