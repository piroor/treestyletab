/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export function mixCSSColors(base, over, alpha = 1) {
  base = parseCSSColor(base);
  over = parseCSSColor(over);
  const mixed = mixColors(base, over);
  return `rgba(${mixed.red}, ${mixed.green}, ${mixed.blue}, ${alpha})`;
}

export function parseCSSColor(color, baseColor) {
  if (typeof color!= 'string')
    return color;

  let red, green, blue, alpha;

  // #RRGGBB, #RRGGBBAA
  let parts = color.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (parts) {
    red   = parseInt(parts[1], 16);
    green = parseInt(parts[2], 16);
    blue  = parseInt(parts[3], 16);
    alpha = parts[4] ? parseInt(parts[4], 16) / 255 : 1 ;
  }
  if (!parts) {
    // #RGB, #RGBA
    parts = color.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i);
    if (parts) {
      red   = Math.min(255, Math.round(255 * (parseInt(parts[1], 16) / 16)));
      green = Math.min(255, Math.round(255 * (parseInt(parts[2], 16) / 16)));
      blue  = Math.min(255, Math.round(255 * (parseInt(parts[3], 16) / 16)));
      alpha = parts[4] ? parseInt(parts[4], 16) / 16 : 1 ;
    }
  }
  if (!parts) {
    // rgb(), rgba()
    parts = color.match(/^rgba?\(\s*([0-9]+)\s*,?\s*([0-9]+)\s*,?\s*([0-9]+)(?:\s*[,/]?\s*((?:0\.)?[0-9]+)\s*)?\)$/i);
    if (parts) {
      red   = parseInt(parts[1]);
      green = parseInt(parts[2]);
      blue  = parseInt(parts[3]);
      alpha = parts[4] ? parseFloat(parts[4]) : 1 ;
    }
  }
  if (!parts) {
    // hsl(), hsla()
    parts = color.match(/^hsla?\(\s*([0-9]+)\s*,?\s*([0-9]+)%\s*,?\s*([0-9]+)%(?:\s*[,/]?\s*((?:0\.)?[0-9]+)%\s*)?\)$/i);
    if (parts) {
      const hue        = parseInt(parts[1]);
      const saturation = parseInt(parts[2]);
      const lightness  = parseInt(parts[3]);
      let min, max;
      if (lightness < 50) {
        max = 2.55 * (lightness + (lightness * (saturation / 100)));
        min = 2.55 * (lightness - (lightness * (saturation / 100)));
      }
      else {
        max = 2.55 * (lightness + ((100 - lightness) * (saturation / 100)));
        min = 2.55 * (lightness - ((100 - lightness) * (saturation / 100)));
      }
      if (hue < 60) {
        red   = max;
        green = (hue / 60) * (max - min) + min;
        blue  = min;
      }
      else if (hue < 120) {
        red   = ((120 - hue) / 60) * (max - min) + min;
        green = max;
        blue  = min;
      }
      else if (hue < 180) {
        red   = min;
        green = max;
        blue  = ((hue - 120) / 60) * (max - min) + min;
      }
      else if (hue < 240) {
        red   = min;
        green = ((240 - hue) / 60) * (max - min) + min;
        blue  = max;
      }
      else if (hue < 300) {
        red   = ((hue - 240) / 60) * (max - min) + min;
        green = min;
        blue  = max;
      }
      else {
        red   = max;
        green = min;
        blue  = ((360 - hue) / 60) * (max - min) + min;
      }
      alpha = parts[4] ? (parseFloat(parts[4]) / 100) : 1 ;
    }
  }
  if (!parts)
    return color;

  const parsed = { red, green, blue, alpha };

  if (alpha < 1 && baseColor)
    return mixColors(parseCSSColor(baseColor), parsed);

  return parsed;
}

function mixColors(base, over) {
  const alpha = over.alpha;
  const red   = Math.min(255, Math.round((base.red   * (1 - alpha)) + (over.red   * alpha)));
  const green = Math.min(255, Math.round((base.green * (1 - alpha)) + (over.green * alpha)));
  const blue  = Math.min(255, Math.round((base.blue  * (1 - alpha)) + (over.blue  * alpha)));
  return { red, green, blue, alpha: 1 };
}

export function isBrightColor(color) {
  color = parseCSSColor(color);
  // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/base/content/browser.js#8200
  const luminance = (color.red * 0.2125) + (color.green * 0.7154) + (color.blue * 0.0721);
  return luminance > 110;
}
