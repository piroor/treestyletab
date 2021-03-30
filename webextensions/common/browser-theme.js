/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';
import * as Color from './color.js';

export function generateThemeRules(theme) {
  const rules = [];
  const generateCustomRule = (theme, prefix = '') => {
    for (const key of Object.keys(theme)) {
      if (!theme[key])
        continue;
      const propertyKey = prefix ? `${prefix}-${key}` : key;
      let value = theme[key];
      switch (typeof theme[key]) {
        case 'object':
          generateCustomRule(value, propertyKey);
          break;
        case 'string':
          if (/^[^:]+:\/\//.test(value))
            value = `url(${JSON.stringify(value)})`;
          rules.push(`--theme-${propertyKey}: ${value};`);
          for (let alpha = 10; alpha < 100; alpha += 10) {
            rules.push(`--theme-${propertyKey}-${alpha}: ${Color.overrideCSSAlpha(value, alpha / 100)};`);
          }
          break;
      }
    }
  };
  generateCustomRule(theme);
  return rules.join('\n');
}

export async function generateThemeDeclarations(theme) {
  if (!theme ||
      !theme.colors)
    return '';

  const extraColors = [];
  const themeFrameColor   = theme.colors.frame || theme.colors.accentcolor /* old name */;
  const inactiveTextColor = theme.colors.tab_background_text || theme.colors.textcolor /* old name */;
  const activeTextColor   = theme.colors.bookmark_text || theme.colors.toolbar_text /* old name */ || inactiveTextColor;
  let bgAlpha = 1;
  let hasImage = false;
  if (theme.images) {
    const frameImage = theme.images.theme_frame || theme.images.headerURL /* old name */;
    if (frameImage) {
      hasImage = true;
      extraColors.push(`--browser-header-url: url(${JSON.stringify(frameImage)})`);
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/themes/shared/tabs.inc.css#537
      extraColors.push('--browser-bg-hover-for-header-image: rgba(0, 0, 0, 0.1);');
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/base/content/browser.css#20
      extraColors.push('--browser-bg-active-for-header-image: rgba(255, 255, 255, 0.4)');
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/toolkit/themes/windows/global/global.css#138
      if (Color.isBrightColor(inactiveTextColor)) {
        // for bright text
        extraColors.push('--browser-textshadow-for-header-image: 1px 1px 1.5px black');
        // https://searchfox.org/mozilla-central/rev/0e3d2eb698a51006943f3b4fb74c035da80aa2ff/browser/themes/shared/tabs.inc.css#840
        extraColors.push('--browser-bg-hover-for-header-image-proton: rgba(255, 255, 255, 0.2);');
      }
      else {
        // for dark text
        extraColors.push('--browser-textshadow-for-header-image: 0 -0.5px 1.5px white');
        // https://searchfox.org/mozilla-central/rev/0e3d2eb698a51006943f3b4fb74c035da80aa2ff/browser/themes/shared/tabs.inc.css#834
        extraColors.push('--browser-bg-hover-for-header-image-proton: rgba(0, 0, 0, 0.2);');
      }
    }
    let imageUrl = frameImage;
    if (Array.isArray(theme.images.additional_backgrounds) &&
        theme.images.additional_backgrounds.length > 0) {
      imageUrl = theme.images.additional_backgrounds[0];
      extraColors.push(`--browser-bg-url: url(${JSON.stringify(imageUrl)})`);
      bgAlpha = 0.75;
      hasImage = true;
    }
    const loader = new Image();
    try {
      const shouldRepeat = (
        theme.properties &&
        Array.isArray(theme.properties.additional_backgrounds_tiling) &&
        theme.properties.additional_backgrounds_tiling.some(value => value == 'repeat' || value == 'repeat-y')
      );
      const shouldNoRepeat = (
        !theme.properties ||
        !Array.isArray(theme.properties.additional_backgrounds_tiling) ||
        theme.properties.additional_backgrounds_tiling.some(value => value == 'no-repeat')
      );
      let maybeRepeatable = false;
      if (!shouldRepeat && !shouldNoRepeat) {
        await new Promise((resolve, reject) => {
          loader.addEventListener('load', resolve);
          loader.addEventListener('error', reject);
          loader.src = imageUrl;
        });
        maybeRepeatable = (loader.width / Math.max(1, loader.height)) <= configs.unrepeatableBGImageAspectRatio;
      }
      if (shouldNoRepeat)
        extraColors.push('--browser-background-image-size: cover;');
      else if (shouldRepeat || maybeRepeatable)
        extraColors.push('--browser-background-image-size: auto;');
    }
    catch(error) {
      console.error(error);
    }
  }
  const themeBaseColor    = Color.overrideCSSAlpha(themeFrameColor, bgAlpha);
  let toolbarColor = Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.4)', bgAlpha);
  if (theme.colors.toolbar) {
    toolbarColor = Color.mixCSSColors(themeBaseColor, theme.colors.toolbar);
    if (hasImage)
      extraColors.push(`--browser-bg-for-header-image: ${theme.colors.toolbar};`);
  }
  else if (hasImage) {
    extraColors.push('--browser-bg-for-header-image: rgba(255, 255, 255, 0.25);');
  }
  if (theme.colors.tab_line)
    extraColors.push(`--browser-tab-highlighter: ${theme.colors.tab_line}`);
  if (theme.colors.tab_loading)
    extraColors.push(`--browser-loading-indicator: ${theme.colors.tab_loading}`);
  extraColors.push(generateThemeRules(theme));
  return `
    :root {
      --browser-background:      ${themeFrameColor};
      --browser-bg-base:         ${toolbarColor};
      --browser-bg-less-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.05)', bgAlpha)};
      --browser-bg-lighter:      ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.1)', bgAlpha)};
      --browser-bg-more-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.25)', bgAlpha)};
      --browser-bg-lightest:     ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.4)', bgAlpha)};
      --browser-bg-less-darker:  ${Color.mixCSSColors(toolbarColor, 'rgba(0, 0, 0, 0.1)', bgAlpha)};
      --browser-bg-darker:       ${Color.mixCSSColors(toolbarColor, 'rgba(0, 0, 0, 0.25)', bgAlpha)};
      --browser-bg-more-darker:  ${Color.mixCSSColors(toolbarColor, 'rgba(0, 0, 0, 0.5)', bgAlpha)};
      --browser-fg:              ${inactiveTextColor};
      --browser-fg-active:       ${activeTextColor};
      --browser-border:          ${Color.overrideCSSAlpha(inactiveTextColor, 0.4)};
      ${extraColors.join(';\n')}
    }
  `;
}
