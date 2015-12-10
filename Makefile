PACKAGE_NAME = treestyletab

.PHONY: all xpi signed clean

all: xpi

xpi: makexpi/makexpi.sh
	makexpi/makexpi.sh -n $(PACKAGE_NAME) -o

makexpi/makexpi.sh:
	git submodule update --init

signed: xpi
	makexpi/sign_xpi.sh -k $(JWT_KEY) -s $(JWT_SECRET) -p ./$(PACKAGE_NAME)_noupdate.xpi

clean:
	rm $(PACKAGE_NAME).xpi $(PACKAGE_NAME)_noupdate.xpi sha1hash.txt
