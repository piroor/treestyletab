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
  *[id$="-nova"] {
    fill: var(--identity-fill-color);
    /* https://searchfox.org/firefox-main/rev/d5c0bb96ad84524b445ee72323a4c91176d20b4c/browser/components/contextualidentity/content/usercontext.css#118 */
    --background-fill-tint: color-mix(in srgb, var(--identity-fill-color) 15%, transparent);
  }
  /* colros are: nova-fill(60%,20%), nova-stroke(40%)
     See https://searchfox.org/firefox-main/rev/d5c0bb96ad84524b445ee72323a4c91176d20b4c/browser/components/contextualidentity/content/usercontext.css */
  #blue-nova     { --identity-fill-color: light-dark(#3246B0,#A2D3FF); --identity-stroke-color: #5A87FD; }
  #blue-proton   { fill: #37adff; }
  #cyan-nova     { --identity-fill-color: light-dark(#066077,#8FDDF0); --identity-stroke-color: #10A4CA; }
  #cyan-proton   { fill: #00c79a; }
  #gray-nova     { --identity-fill-color: light-dark(#3F3E42,#D6D5DA); --identity-stroke-color: #949297; }
  #gray-proton   { fill: light-dark(#0C0C0D,#F9F9FA); }
  #green-nova    { --identity-fill-color: light-dark(#06674B,#90E3C6); --identity-stroke-color: #11AE84; }
  #green-proton  { fill: #51cd00; }
  #orange-nova   { --identity-fill-color: light-dark(#9C2C05,#FEBD99); --identity-stroke-color: #F4682C; }
  #orange-proton { fill: #ff9f00; }
  #pink-nova     { --identity-fill-color: light-dark(#882078,#FFB0E2); --identity-stroke-color: #DB54BF; }
  #pink-proton   { fill: #ff4bda; }
  #purple-nova   { --identity-fill-color: light-dark(#702E98,#E8B7FF); --identity-stroke-color: #B864EE; }
  #purple-proton { fill: #af51f5; }
  #red-nova      { --identity-fill-color: light-dark(#961E3D,#FFB6BF); --identity-stroke-color: #ED566E; }
  #red-proton    { fill: #ff613d; }
  #violet-nova   { --identity-fill-color: light-dark(#5939A8,#D4C1FF); --identity-stroke-color: #9871FF; }
  #violet-proton { fill: #764edd; }
  #yellow-nova   { --identity-fill-color: light-dark(#854800,#FBCC77); --identity-stroke-color: #DB820E; }
  #yellow-proton { fill: #ffcb00; }
</style>
<symbol id="icon-nova">
  <circle fill="var(--background-fill-tint)" cx="8" cy="8" r="10"/>
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
blue
cyan
gray
green
orange
pink
purple
red
violet
yellow
END
)"

colors() {
  echo "$COLORS" |
    while read name
    do
      echo -n "<g id=\"${name}-nova\"><use href=\"#icon-nova\"/></g><g id=\"${name}-proton\"><use href=\"#icon-proton\"/></g>"
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
