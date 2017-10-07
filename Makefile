PACKAGE_NAME = treestyletab

.PHONY: all xpi signed clean webextensions

all: xpi

xpi: makexpi/makexpi.sh webextensions
	makexpi/makexpi.sh -n $(PACKAGE_NAME) -o

makexpi/makexpi.sh:
	git submodule update --init

signed: xpi
	makexpi/sign_xpi.sh -k $(JWT_KEY) -s $(JWT_SECRET) -p ./$(PACKAGE_NAME)_noupdate.xpi

webextensions:
	$(MAKE) xpi -C $(CURDIR)/webextensions
	cp webextensions/$(PACKAGE_NAME)*.xpi ./

clean:
	rm $(PACKAGE_NAME).xpi $(PACKAGE_NAME)_noupdate.xpi sha1hash.txt
