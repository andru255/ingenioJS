/* @namespace for IngenioJS' toolkit */
if(!iJS){ var iJS = {}; }

/**
 * This function is a simple wrapper for GET request (loading external data from given URLs)
 * @function This function will create an XMLHttpRequest and return the data.
 * @param {String} url The actual URL to be requested (via GET)
 * @param {Function} [callback] The callback function that will be called with callback(data)
 * @param {Boolean} [binaryMode] This will override the MIME Type, allows binary transfers
 * @returns {Boolean|Data} Data returned if request was successfully done. Otherwise false is returned (e.g. on 404 status)
 */
iJS.ajax = function(url){

	if(!url) return this;

	var self = this,
		callback = arguments[1] || false;

	var req=new XMLHttpRequest();
	req.open('GET',url,false);
	req.send(null);

	if(req.status == (200 || 304)){		
		var data = req.responseText || req.responseXML;
		callback && callback(data);

		return data;
	}else{
		callback && callback(false);
	}

	return false;

};

iJS.removeArrayEntry = function(array, id){

	var part1 = array.slice(0, id),
		part2 = array.slice(id + 1, array.length);

	array = [];
	array.push.apply(array, part1);
	array.push.apply(array, part2);

	return array;

}