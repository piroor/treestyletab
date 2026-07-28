#!/bin/bash

mkdir -p "$(dirname "$0")"/resources/icons
cd "$(dirname "$0")"/resources/icons

mkdir -p contextual-identities
cd contextual-identities

BASE='https://hg-edge.mozilla.org/mozilla-central/raw-file/tip/browser/components/contextualidentity/content/'

echo 'Fetching SVG icons...'
rm -f *.svg
curl "$BASE" |
  cut -d ' ' -f 3 |
  egrep -o '[^/]+\.svg' |
  while read name; do
    wget "${BASE}${name}"
  done


TEMPLATE="$(cat << END
<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->
<svg xmlns="http://www.w3.org/2000/svg" width="%WIDTH%" height="%HEIGHT%" viewBox="%VIEWBOX%">
<style>
  g:not(:target) {
    display: none;
  }
</style>
<symbol id="icon-nova">
%SOURCE_NOVA%
</symbol>
<symbol id="icon-proton">
%SOURCE_PROTON%
</symbol>
%COLORS%
</svg>
END
)"

COLORS="$(cat << END
blue       #37adff
cyan       #00c79a
gray-dark  #F9F9FA
gray-light #0C0C0D
green      #51cd00
orange     #ff9f00
pink       #ff4bda
purple     #af51f5
red        #ff613d
yellow     #ffcb00
END
)"

colors() {
  echo "$COLORS" |
    while read set
    do
      name="$(echo "$set" | sed -E 's/ +.*$//')"
      color="$(echo "$set" | sed -E 's/^[^ ]* *//')"
      echo -n "<g id=\"${name}-nova\" fill=\"${color}\"><use href=\"#icon-nova\"/></g><g id=\"${name}-proton\" fill=\"${color}\"><use href=\"#icon-proton\"/></g>"
    done
}

for file in *.svg; do
  echo "Updating ${file}..."
  svg="$(cat "${file}" | tr -d '\n')"
  echo "  source: $svg"
  mv "${file}" "/tmp/${file}"
  width="$(echo "$svg" | sed -E 's/^.*width="([^"]+)".*$/\1/')"
  height="$(echo "$svg" | sed -E 's/^.*height="([^"]+)".*$/\1/')"
  view_box="$(echo "$svg" | sed -E 's/^.*viewBox="([^"]+)".*$/\1/')"
  echo "  width: $width"
  echo "  height: $height"
  echo "  view_box: $view_box"
  echo "$TEMPLATE" |
    sed -e "s;%SOURCE_NOVA%;$(echo "$svg" | sed -E -e 's;<!--.*-->|</?svg[^>]*>|<style[^>]*>.*</style>|fill="context-fill";;g' -e 's;^.*<g class="nova">;;' -e 's;</g>.*$;;');" \
        -e "s;%SOURCE_PROTON%;$(echo "$svg" | sed -E -e 's;<!--.*-->|</?svg[^>]*>|<style[^>]*>.*</style>|fill="context-fill";;g' -e 's;^.*<g class="proton">;;' -e 's;</g>.*$;;');" \
        -e "s;%COLORS%;$(colors);" \
        -e "s;%WIDTH%;${width};g" \
        -e "s;%HEIGHT%;${height};g" \
        -e "s;%VIEWBOX%;${view_box};g" \
    > "${file}"
done
