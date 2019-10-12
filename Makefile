PACKAGE_NAME = treestyletab

.PHONY: all xpi

all: xpi

xpi:
	cd webextensions && $(MAKE)
	cp webextensions/$(PACKAGE_NAME)*.xpi ./

