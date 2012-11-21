PACKAGE_NAME = treestyletab

all: xpi

xpi: buildscript/makexpi.sh
	cp buildscript/makexpi.sh ./
	rm chrome.manifest
	cp jar-chrome.manifest chrome.manifest
	./makexpi.sh -n $(PACKAGE_NAME)
	rm ./makexpi.sh

omnixpi: buildscript/makexpi.sh
	cp buildscript/makexpi.sh ./
	rm chrome.manifest
	cp omnixpi-chrome.manifest chrome.manifest
	./makexpi.sh -n $(PACKAGE_NAME)
	rm ./makexpi.sh -o

buildscript/makexpi.sh:
	git submodule update --init
