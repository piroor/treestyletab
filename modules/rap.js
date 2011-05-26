const EXPORTED_SYMBOLS = ['rap']; 

var last = -1;
var start = Date.now();

function rap(aMessage) {
	var now = Date.now();
	var time = last < 0 ? 0 : (now - last);
	dump(time+' (total '+(now - start)+') : '+(aMessage || Components.stack.caller)+'\n');
	last = now;
}
