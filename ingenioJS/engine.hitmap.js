
/**
 * @constructor Engine / Hitmap Extension (allows blocking objects)
 * @param {Array} objects The objects that will be merged in hitmap entries
 * @param {Object} engine The owning engine instance
 * @returns {Object} hitmap instance
 * @example
 * var hitmap = new ingenioJS.engine.hitmap([{
 * 	model: cache.get('models', 'myModel'),
 * 	position: { x: 10, y: 5}
 * }], this);
 */
ingenioJS.engine.hitmap = function(engine){

	var objects = arguments[1] || false;

	// link the cache instance
	this.cache = engine.cache;

	if(objects){
		// constructor calls automatically update()
		this.execute(objects);
	}

	return this;

};

ingenioJS.engine.hitmap.prototype = {

	/**
	 * This function inserts hitmap entries.
	 * @param {Array|Object} todo The object or an array of objects whose hitmap entries will be added.
	 * @example
	 * hitmap.update([{
	 * 	model: cache.get('models', 'myModel'),
	 * 	position: { x: 10, y: 5}
	 * }]);
	 */
	execute: function(todo){

		if(!todo) return;
		if(!todo.length && typeof todo == 'object'){
			todo = [ todo ];
		}

		for(var i=0; i<todo.length; i++){
			var object = todo[i];
			if(typeof object.model == 'object' && object.model.blocking){
				// skip for player characters. Just because he won't be blocked by his own starting position
				if(object.model.type == 'character' && object.id == 'player'){
					continue;
				}
				if(object.model.size.x > 1 || object.model.size.y > 1){
					for(var x = (object.position.x); x < (object.position.x + object.model.size.x); x++){
						for(var y = (object.position.y); y < (object.position.y + object.model.size.y); y++){
							this.set(x, y, true);
						}
					}
				}else if(object.model.size.x == 1 && object.model.size.y == 1){
					this.set(object.position.x, object.position.y, true);
				}
			}
		}

	},

	/**
	 * This function removes hitmap entries.
	 * @param {Array|Object} todo The object or an array of objects whose hitmap entries will be removed.
	 * @example
	 * hitmap.update([{
	 * 	model: cache.get('models', 'myModel'),
	 * 	position: { x: 10, y: 5}
	 * }]);
	 */
	remove: function(todo){

		if(!todo) return;
		if(!todo.length && typeof todo == 'object'){
			todo = [ todo ];
		}

		for(var i=0; i<todo.length; i++){
			var object = todo[i];

			if(typeof object.model == 'object' && object.model.blocking){
				// skip for player characters. Just because he won't be blocked by his own starting position
				if(object.model.type == 'character' && object.id == 'player'){
					continue;
				}
				if(object.model.size.x > 1 || object.model.size.y > 1){
					for(var x = (object.position.x); x < (object.position.x + object.model.size.x); x++){
						for(var y = (object.position.y); y < (object.position.y + object.model.size.y); y++){
							this.set(x, y, false);
						}
					}
				}else if(object.model.size.x == 1 && object.model.size.y == 1){
					this.set(object.position.x, object.position.y, false);
				}
			}
		}


	},

	/**
	 * This function gets a hitmap entry of a given x and y coordinate.
	 * @param {Number} x The X-coordinate
	 * @param {Number} y The Y-coordinate
	 * @returns {Boolean} True if a (blocking) hitmap entry exists. Otherwise false is returned.
	 */
	get: function(x, y){
		return !!(this.cache.get('hitmap', x+'x'+y));
	},

	/**
	 * This function sets / updates a hitmap entry of a given x and y coordinate to a value.
	 * @param {Number} x The X-coordinate
	 * @param {Number} y The Y-coordinate
	 * @param {Boolean} value The value, true for blocking, false for non-blocking
	 * @returns {Boolean} True if hitmap entry was updated successfully. Otherwise false is returned.
	 */
	set: function(x, y, value){
		return !!(this.cache.set('hitmap', x+'x'+y, value));
	}

};
