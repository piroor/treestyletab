#!/bin/sh

if [ -z "$SZ_EXE" ]; then
  SZ_EXE=/cygdrive/C/Program\ Files/7-Zip/7z.exe
fi

rm -rf build/
mkdir build/
cp -r components/ build/
cp -r content/ build/
cp -r defaults/ build/
cp -r locale/ build/
cp -r modules/ build/
cp -r skin build/
cp chrome.manifest build/
cp icon.png build/
cp install.rdf build/
cd build/
"$SZ_EXE" a -tzip treestyletabforpm@oinkoink.xpi *