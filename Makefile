PACKAGE_NAME = treestyletab

.PHONY: all xpi install_hook lint format fix_locale_errors

all: xpi

xpi:
	cd webextensions && $(MAKE)
	cp webextensions/$(PACKAGE_NAME)*.xpi ./

install_hook:
	echo '#!/bin/sh\nmake lint' > "$(CURDIR)/.git/hooks/pre-commit" && chmod +x "$(CURDIR)/.git/hooks/pre-commit"

lint:
	cd webextensions && $(MAKE) $@

format:
	cd webextensions && $(MAKE) $@

fix_locale_errors:
	cd webextensions && $(MAKE) $@
