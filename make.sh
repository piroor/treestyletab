#!/bin/sh

cp buildscript/makexpi.sh ./
cp jar-chrome.manifest chrome.manifest
./makexpi.sh -n treestyletab
rm ./makexpi.sh

