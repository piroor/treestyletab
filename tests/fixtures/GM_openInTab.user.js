// ==UserScript==
// @name			Google First Result in New Tab
// @namespace		google_firstresult.user.js
// @description		Open a new tab for the first search result of Google.
// @include			http*://www.google.*/search?q=*
//
// ==/UserScript==

GM_openInTab(document.querySelector('h3 a').href);
