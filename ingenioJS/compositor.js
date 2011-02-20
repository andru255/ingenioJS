
/**
 * @constructor Compositor, which manages 2D tile- or pixel-based positioning
 * @param {Object} viewport The required viewport object managed by the engine
 * @param {Object} settings The required settings object managed by the engine
 * @returns {Object} compositor instance
 */
ingenioJS.compositor = function(viewport, settings){

	this.settings = settings;
	this.viewport = viewport;

	// initial position, will be modified by the engine in case of partial rendering
	this.viewport.position = {
		x: 0, y: 0
	};

	return this;

};

ingenioJS.compositor.prototype = {

	/**
	 * This function will simply return the viewport
	 * @returns {Object} viewport
	 */
	getViewport: function(){

		return this.viewport;

	},

	/**
	 * This function will update all layer dimensions in the actual viewport
	 */
	updateLayers: function(){

		var layers = this.viewport.layers,
			settings = this.settings;

		// (re-)calculate layer dimensions
		for(var l in layers){
			if(layers.hasOwnProperty(l)){
				var layer = layers[l];

				layer.width = (settings.squaresize * layer.size.x)+'px';
				layer.height = (settings.squaresize * layer.size.y)+'px';
			}
		}

		this.renderer.updateLayers();

	},

	/**
	 * This function will update the viewport dimensions
	 */
	updateViewport: function(){

		var settings = this.settings,
			viewport = this.viewport;

		// calculate initial viewport dimensions
		if(viewport.size){
			viewport.width = (settings.squaresize * viewport.size.x)+'px';
			viewport.height = (settings.squaresize * viewport.size.y)+'px';
		}

		if(this.renderer){
			this.renderer.updateViewport();
		}
	},

	/**
	 * This function will composite a single object or an array of objects
	 * @param {String|DOMElement} context The compositing / rendering context.
	 * @param {Array|Object} todo The object or an array of objects that will be composited.
	 */
	execute: function(context, todo){

		var executeObjects = [],
			updateObjects = [],
			removeObjects = [],
			set = this.settings;

		if(!context) return;
		if(!todo || !todo.length){
			if(typeof todo == 'object'){
				todo = [ todo ];
			}else{
				return;
			}
		}

		for(var i=0;i<todo.length;i++){
			var object = todo[i];

			// skip if engine made a mistake and our object has no attached model
			if(!object.model) continue;

			// nothing else has to be translated, dimensions are prepared by renderer via CSS
			object.left = (object.position.x * set.squaresize)+'px';
			object.top = (object.position.y * set.squaresize)+'px';


			if(!object.composite || object.composite == 'execute'){
				executeObjects.push(object);
			}else if(object.composite == 'update' || (object.node && !object.composite)){ // will update if composite was forgotten and object's node is attached
				updateObjects.push(object);
			}else if(object.composite == 'remove'){
				removeObjects.push(object);
			}

		}

		if(executeObjects.length > 0){
			this.renderer.execute(context, executeObjects);
		}
		if(updateObjects.length > 0){
			this.renderer.update(context, updateObjects);
		}
		if(removeObjects.length > 0){
			this.renderer.remove(context, removeObjects);
		}

	}

};
