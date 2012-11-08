PACKAGE_NAME = treestyletab

all: xpi

xpi:
	cp buildscript/makexpi.sh ./
	rm chrome.manifest
	cp jar-chrome.manifest chrome.manifest
	./makexpi.sh -n $(PACKAGE_NAME)
	rm ./makexpi.sh

omnixpi:
	cp buildscript/makexpi.sh ./
	rm chrome.manifest
	cp omnixpi-chrome.manifest chrome.manifest
	./makexpi.sh -n $(PACKAGE_NAME)
	rm ./makexpi.sh -o
