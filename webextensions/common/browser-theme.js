/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

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
          break;
      }
    }
  };
  generateCustomRule(theme);
  return rules.join('\n');
}

export function generateThemeDeclarations(theme) {
  if (!theme ||
      !theme.colors)
    return '';

  const extraColors = [];
  const themeFrameColor   = theme.colors.frame || theme.colors.accentcolor /* old name */;
  const inactiveTextColor = theme.colors.tab_background_text || theme.colors.textcolor /* old name */;
  const activeTextColor   = theme.colors.bookmark_text || theme.colors.toolbar_text /* old name */ || inactiveTextColor;
  let bgAlpha = 1;
  if (theme.images) {
    const frameImage = theme.images.theme_frame || theme.images.headerURL /* old name */;
    if (frameImage) {
      extraColors.push(`--browser-header-url: url(${JSON.stringify(frameImage)})`);
      extraColors.push('--browser-bg-for-header-image: transparent;');
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/themes/shared/tabs.inc.css#537
      extraColors.push('--browser-bg-hover-for-header-image: rgba(0, 0, 0, 0.1);');
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/browser/base/content/browser.css#20
      extraColors.push('--browser-bg-active-for-header-image: rgba(255, 255, 255, 0.4)');
      // https://searchfox.org/mozilla-central/rev/532e4b94b9e807d157ba8e55034aef05c1196dc9/toolkit/themes/windows/global/global.css#138
      if (Color.isBrightColor(inactiveTextColor))
        extraColors.push('--browser-textshadow-for-header-image: 1px 1px 1.5px black'); // for bright text
      else
        extraColors.push('--browser-textshadow-for-header-image: 0 -0.5px 1.5px white'); // for dark text
    }
    if (Array.isArray(theme.images.additional_backgrounds) &&
        theme.images.additional_backgrounds.length > 0) {
      extraColors.push(`--browser-bg-url: url(${JSON.stringify(theme.images.additional_backgrounds[0])})`);
      bgAlpha = 0.75;
    }
  }
  const themeBaseColor    = Color.mixCSSColors(themeFrameColor, 'rgba(0, 0, 0, 0)', bgAlpha);
  let toolbarColor = Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.4)', bgAlpha);
  if (theme.colors.toolbar)
    toolbarColor = Color.mixCSSColors(themeBaseColor, theme.colors.toolbar);
  if (theme.colors.tab_line)
    extraColors.push(`--browser-tab-highlighter: ${theme.colors.tab_line}`);
  if (theme.colors.tab_loading)
    extraColors.push(`--browser-loading-indicator: ${theme.colors.tab_loading}`);
  extraColors.push(generateThemeRules(theme));
  return `
    :root {
      --browser-background:      ${themeFrameColor};
      --browser-bg-base:         ${themeBaseColor};
      --browser-bg-less-lighter: ${Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.25)', bgAlpha)};
      --browser-bg-lighter:      ${toolbarColor};
      --browser-bg-more-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.6)', bgAlpha)};
      --browser-bg-lightest:     ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.85)', bgAlpha)};
      --browser-bg-less-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.1)', bgAlpha)};
      --browser-bg-darker:       ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.25)', bgAlpha)};
      --browser-bg-more-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.5)', bgAlpha)};
      --browser-fg:              ${inactiveTextColor};
      --browser-fg-active:       ${activeTextColor};
      --browser-border:          ${Color.mixCSSColors(inactiveTextColor, 'rgba(0, 0, 0, 0)', 0.4)};
      ${extraColors.join(';\n')}
    }
  `;
}
