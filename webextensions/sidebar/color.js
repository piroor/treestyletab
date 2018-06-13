/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export function mixCSSColors(aBase, aOver, aAlpha = 1) {
  const base = parseCSSColor(aBase);
  const over = parseCSSColor(aOver);
  const mixed = mixColors(base, over);
  return `rgba(${mixed.red}, ${mixed.green}, ${mixed.blue}, ${aAlpha})`;
}

export function parseCSSColor(aColor, aBaseColor) {
  if (typeof aColor!= 'string')
    return aColor;

  let red, green, blue, alpha;

  // RRGGBB, RRGGBBAA
  let parts = aColor.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (parts) {
    red   = parseInt(parts[1], 16);
    green = parseInt(parts[2], 16);
    blue  = parseInt(parts[3], 16);
    alpha = parts[4] ? parseInt(parts[4], 16) / 255 : 1 ;
  }
  if (!parts) {
    // RGB, RGBA
    parts = aColor.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i);
    if (parts) {
      red   = Math.min(255, Math.round(255 * (parseInt(parts[1], 16) / 16)));
      green = Math.min(255, Math.round(255 * (parseInt(parts[2], 16) / 16)));
      blue  = Math.min(255, Math.round(255 * (parseInt(parts[3], 16) / 16)));
      alpha = parts[4] ? parseInt(parts[4], 16) / 16 : 1 ;
    }
  }
  if (!parts) {
    // rgb(), rgba()
    parts = aColor.match(/^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*((?:0\.)?[0-9]+)\s*)?\)$/i);
    if (!parts)
      return aColor;
    red   = parseInt(parts[1]);
    green = parseInt(parts[2]);
    blue  = parseInt(parts[3]);
    alpha = parts[4] ? parseFloat(parts[4]) : 1 ;
  }

  const parsed = { red, green, blue, alpha };

  if (alpha < 1 && aBaseColor)
    return mixColors(parseCSSColor(aBaseColor), parsed);

  return parsed;
}

function mixColors(aBase, aOver) {
  const alpha = aOver.alpha;
  const red   = Math.min(255, Math.round((aBase.red   * (1 - alpha)) + (aOver.red   * alpha)));
  const green = Math.min(255, Math.round((aBase.green * (1 - alpha)) + (aOver.green * alpha)));
  const blue  = Math.min(255, Math.round((aBase.blue  * (1 - alpha)) + (aOver.blue  * alpha)));
  return { red, green, blue, alpha: 1 };
}

