// ==UserScript==
// @name           Open Google's search results in tabs
// @namespace      google_GM_openInTab.user.js
// @include        http*://www.google.*/search?q=*
// @require        http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @run-at         document-idle
// see: https://github.com/piroor/treestyletab/issues/517
// ==/UserScript==

function init()
{
    $("div#res.med").prepend('<div><a id="use_GM_openInTab"><img src="http://i.imgur.com/cQkJVZY.png" alt="">Open All Links with GM_openInTab</a></div>');
    $('#use_GM_openInTab').click(function()
    {
        useGMopenIn();
    });

    $("div#res.med").prepend('<div><a id="use_windowOpen"><img src="http://i.imgur.com/cQkJVZY.png" alt="">Open All Links window.open</a></div>');
    $('#use_windowOpen').click(function()
    {
        useWinOpen();
    });
}

function useGMopenIn()
{
    $('.r a').each(function (i, e) 
    {       
        var linkURI = $(e).attr('href');
        GM_openInTab(linkURI, true);
    }); return false;
}

function useWinOpen()
{
    $('.r a').each(function (i, e) 
    {       
        var linkURI = $(e).attr('href');
        window.open(linkURI, "_blank");
    }); return false;
}

init();