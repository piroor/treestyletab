#!/bin/bash

mkdir -p "$(dirname "$0")"/resources/icons
cd "$(dirname "$0")"/resources/icons

mkdir -p contextual-identities
cd contextual-identities

BASE='https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/components/contextualidentity/content/'

echo 'Fetching SVG icons...'
curl 'https://hg.mozilla.org/mozilla-central/file/tip/browser/components/contextualidentity/content/' |
  grep '>file<' |
  egrep -o '[^/]+\.svg' |
  while read name; do
    wget "${BASE}${name}"
  done


TEMPLATE="$(cat << END
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
<svg xmlns="http://www.w3.org/2000/svg" width="%WIDTH%" height="%HEIGHT%" viewBox="0 0 %WIDTH% %HEIGHT%">
<style>
  g:not(:target) {
    display: none;
  }
</style>
<symbol id="icon">
%SOURCE%
</symbol>
%COLORS%
</svg>
END
)"

COLORS="$(cat << END
blue      #37adff
turquoise #00c79a
green     #51cd00
yellow    #ffcb00
orange    #ff9f00
red       #ff613d
pink      #ff4bda
purple    #af51f5
END
)"

case $(uname) in
  Darwin|*BSD|CYGWIN*)
    esed="sed -E"
    ;;
  *)
    esed="sed -r"
    ;;
esac

colors() {
  echo "$COLORS" |
    while read set
    do
      name="$(echo "$set" | $esed 's/ +.*$//')"
      color="$(echo "$set" | $esed 's/^[^ ]* *//')"
      echo -n "<g id=\"${name}\" fill=\"${color}\"><use href=\"#icon\"/></g>"
    done
}

for file in *.svg; do
  echo "Updating ${file}..."
  svg="$(cat "${file}" | tr -d '\n')"
  mv "${file}" "/tmp/${file}"
  width="$(echo "$svg" | $esed 's/^.*width="([^"]+)".*$/\1/')"
  height="$(echo "$svg" | $esed 's/^.*height="([^"]+)".*$/\1/')"
  echo "$TEMPLATE" |
    sed -e "s;%SOURCE%;$(echo "$svg" | $esed 's;<!--.*-->|</?svg[^>]*>|fill="context-fill";;g');" \
        -e "s;%COLORS%;$(colors);" \
        -e "s;%WIDTH%;${width};g" \
        -e "s;%HEIGHT%;${height};g" \
    > "${file}"
done
