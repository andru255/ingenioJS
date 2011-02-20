
/**
 * @constructor Cache, which manages all data stacks and their entries
 * @returns {Object} cache instance
 */
ingenioJS.cache = function(){
	return this;
};

ingenioJS.cache.prototype = {

	/**
	 * This function gets the contents of a stack or a given entry in the given stack
	 * @param {String} stack The requested cache stack
	 * @param {String} [id] The requested entry's id in the cache stack
	 * @returns {Array|Boolean|Number|Object|String} The stack entry's data. Otherwise false is returned.
	 * @example
	 * cache.get('objects'); will return the complete stack
	 * cache.get('objects', 'myObject'); will return a single entry in the stack.
	 */
	get: function(stack){

		var id = arguments[1] || false;

		if(this[stack]){
			if(this[stack][id]){
				return this[stack][id];
			}else if(!id){
				return this[stack];
			}
		}

		return false;

	},

	/**
	 * This function sets the contents of a stack entry and fills it with contents
	 * @param {String} stack The requested cache stack
	 * @param {String} id The requested entry's id in the cache stack
	 * @param {Array|Boolean|Number|Object|String} data The data that will fill the cache stack entry
	 * @param {Boolean} [mergeMode] This will put the function in merge mode and will not replace previous (data) properties of the cache stack entry
	 * @returns {Boolean} True if cache stack entry data was successfully set / merged. Otherwise false is returned.
	 * @example
	 * cache.set('objects', 'myObject' , {key:'value'}); will fill the cache stack entry with given data
	 * cache.set('objects', 'myObject', {key2:'value2'}); will add the data to the cache stack entry
	 */
	set: function(stack,id,data){

		var mergeMode = arguments[3] || false;
	
		if(!this[stack]){
			this[stack]={};
		}

		// overwrite data
		if(!mergeMode){
			return !!(this[stack][id]=data);
		}else if(typeof this[stack][id] == 'object'){
			for(var p in data){
				this[stack][id][p] = data[p];
			}
			return true;
		}

		return false;

	},

	/**
	 * This function deletes a stack entry
	 * @param {String} stack The requested cache stack
	 * @param {String} id The requested entry's id in the cache stack
	 * @returns {Boolean} True if stack entry was deleted successfully. Otherwise false is returned.
	 */
	del: function(stack,id){

		if(this[stack][id]){
			return !!(delete this[stack][id]);
		}

		return true;

	},

	/**
	 * This function returns the size of a given cache stack
	 * @param {String} stack The requested cache stack
	 * @returns {Number} The length of the requested cache stack
	 */
	getSize: function(stack){

		var length = 0;

		stack = this[stack] || {};
		for(var i in stack){
			length++;
		}

		return length;

	}

};