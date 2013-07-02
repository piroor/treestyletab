// ==UserScript==
// @name           test
// @namespace      google_GM_openInTab.user.js
// @include        http*://www.google.*/search?q=*
// @require        http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @run-at         document-idle
// see: https://github.com/piroor/treestyletab/issues/517
// ==/UserScript==

function init()
{
    $("div#res.med").prepend('<div><img id="use_GM_openInTab" src="http://i.imgur.com/cQkJVZY.png" title="Open All Links">Use GM_openInTab<br/><br/><br/></div>');
    $('#use_GM_openInTab').click(function()
    {
        useGMopenIn();
    });

    $("div#res.med").prepend('<div><img id="use_windowOpen" src="http://i.imgur.com/cQkJVZY.png" title="Open All Links">Use window.open<br/></div>');
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