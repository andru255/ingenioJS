
/**
 * @constructor Renderer (HTML), which manages all graphics and the viewport
 * @param {Object} viewport The required viewport object managed by the engine
 * @param {Object} settings The required settings object managed by the engine
 * @param {Object} cache The cache instance managed by the engine
 * @returns {Object} renderer instance
 */
ingenioJS.renderer = function(viewport, settings, cache){

	function generateName(viewport){

		var rand = viewport.context.id + Math.round(Math.random() * 10000);

		if(!!(document.getElementsByClassName(rand))){
			return rand;
		}else{
			return generateName(viewport);
		}

	}

	// feature detection of css properties
	this._cssCache = {
		transform: this._getCSS('transform'),
		transition: this._getCSS('transition'),
		perspective: this._getCSS('perspective'),
		animation: this._getCSS('animation'),
		fontSize: this._getCSS('font-size')
	};

	// renderer not allowed to calculate viewport dimensions, because of dumbness
	this.viewport = viewport;
	this.settings = settings;
	this.cache = cache;

	this.classNameSpace = generateName(viewport);

	// setup the required rendering stylesheets
	var doc = window.document,
		head = doc.getElementsByTagName('head')[0],
		style = doc.createElement('style'),
		styleId = this.viewport.context.id+'-stylesheet';

	style.id = styleId;
	style.innerHTML = '/* automatically generated stylesheet for #'+this.viewport.context.id+' */';
	head.appendChild(style);

	var self = this;
	window.setInterval(function(){
		self.update();
	}, (1000/this.settings.frames));

	if(!!(this.stylesheet = doc.getElementById(styleId))){

		this.updateViewport();
		this.prepareModels();

		if(ingenioJS.renderer.plugins){
			for(var plugin in ingenioJS.renderer.plugins){
				if(ingenioJS.renderer.plugins.hasOwnProperty(plugin)){
					this[plugin] = new ingenioJS.renderer.plugins[plugin](this);
				}
			}
		}

		return this;
	}

	return false;

};

ingenioJS.renderer.prototype = {

	/**
	 * This function tests different CSS properties for their support
	 * @param {String} The tested CSS(3)-Property, e.g. 'animation'
	 * @returns {String} The final CSS-ready property (may include vendors), e.g. '-webkit-animation'
	 * @example
	 * renderer._getCSS('transform');
	 * -> will return '-moz-transform' in Firefox3.6/4.0
	 * -> will return '-webkit-transform' in Chromium
	 * -> will return false in Firefox <3.0 or IE6/7/8
	 */
	_getCSS: function(prop){

		if(!this.csstester){
			this.csstester = document.createElement('csstester');
		}

		var vendors = 'Webkit Moz O ms Khtml'.split(' '),
			v_prop = '', t_prop = '';

		if(prop.match(/-/)){
			// font-size -> fontSize
			var x = prop.split(/-/);
			for(var i in x){
				v_prop += x[i].charAt(0).toUpperCase() + x[i].substr(1);
			}

			// update native property
			t_prop = v_prop.charAt(0).toLowerCase() + v_prop.substr(1);
		}else{
			// transition -> Transition
			v_prop = prop.charAt(0).toUpperCase() + prop.substr(1);
			t_prop = prop;
		}

		// test native support
		if(this.csstester.style[t_prop] !== undefined){
			return prop.toLowerCase();
		}else{
			// test vendor support
			for(var v in vendors){
				if(this.csstester.style[vendors[v]+v_prop] !== undefined){
					return '-'+vendors[v].toLowerCase()+'-'+prop;
				}
			}
		}

		return false;

	},

	/**
	 * This function will render a single object or an array of objects
	 * @param {String|DOMElement} context The rendering context.
	 * @param {Array|Object} todo The object or an array of objects that will be rendered.
	 * @returns {Boolean} True if everything went fine.
	 */
	execute: function(context, todo){

		// allows dynamic calling with elementIds instead
		context = (context.id) ? context : document.getElementById(context);

		var doc = window.document,
			element = false,
			isNewElement = true, // default for initial rendering
			classNameSpace = this.classNameSpace;

		for(var i=0;i<todo.length;i++){
			var object = todo[i];

			// nothing found, so it should be a new element
			if( !(element = (object.node || doc.getElementById(object.id))) ){
				element = doc.createElement('div');
				if(object.id){
					element.id = object.id;
				}
				isNewElement = true;

			// update this flag here, because we now know that targeted object wasn't found
			}else{
				isNewElement = false;
			}

			element.style.top = (object.top || 'auto');
			element.style.left = (object.left || 'auto');

			if(isNewElement && context){
				element.className = classNameSpace+' '+((object.model.type) ? object.model.type : '')+((object.model.name) ? ' '+object.model.name : '');
				context.appendChild(element);
			}

			// well, cache the object node for later manipulation (e.g. for renderer plugins)
			if(!object.node){
				object.node = element;
			}

			// cleanup composite
			if(object.composite){
				object.composite = false;
			}

		}

		return true;

	},

	/**
	 * This function updates the objects that are rendered in intervals (render cycle).
	 * By default it does nothing, only plugins may use this function.
	 * @param {String|DOMElement} context The rendering context
	 * @param {Array|Object} todo The object or an array of objects that will be removed.
	 */
	update: function(context, todo){

		// context is not used, updates are only possible if object has already an attached node
		var classNameSpace = this.classNameSpace;

		if(!todo) return;
		if(!todo.length){
			todo = [ todo ];
		}

		for(var i=0; i<todo.length; i++){
			var object = todo[i];

			if(object.node){
				// update position
				object.node.style.top = (object.top || 'auto');
				object.node.style.left = (object.left || 'auto');

				if(typeof object.model == 'string'){
					object.model = this.cache.get('models' , object.model) || false;
				}

				// update presentation
				if(object.model && object.composite == 'update'){
					object.node.className = classNameSpace+' '+((object.model.type) ? object.model.type : '')+((object.model.name) ? ' '+object.model.name : '');
				}
			}

			// cleanup composite
			if(object.composite){
				delete object.composite;
			}
		}

	},

	/**
	 * This function removes objects from the viewport.
	 * @param {String|DOMElement} context The rendering context
	 * @param {Array|Object} todo The object or an array of objects that will be removed.
	 */
	remove: function(context, todo){

		if(!todo) return;
		if(!todo.length){
			todo = [ todo ];
		}

		for(var i=0; i<todo.length; i++){
			var object = todo[i];
			if(object.node && object.node.parentNode == context){
				context.removeChild(object.node);
				object.node = undefined; // object's node is linked.
				// Note: object itself is not linked.
			}
		}

	},

	/**
	 * This function updates the background of a given layer.
	 * @param {String|DOMElement} context The layer / rendering context
	 * @param {String} url The background image resource. Texture required, because it will be repeated.
	*/
	updateBackground: function(context, url){

		// allows dynamic calling with elementIds instead
		context = (context.id) ? context : document.getElementById(context);

		return !!(context.style.cssText='background-image:url('+url+'); background-repeat:repeat;');

	},

	/**
	 * This function updates the layers. It updates the stylesheet with layer dimensions and its z-index
	*/
	updateLayers: function(){

		var stylesheet = this.stylesheet,
			viewport = this.viewport,
			layers = viewport.layers,
			sheet = "\n\n"+'/* layers for viewport #'+viewport.context.id+' */',
			zIndex = 0;

		// first layer has a higher zIndex than last layer
		for (var p in layers){
			if(layers.hasOwnProperty(p)) zIndex++;
		}

		for(var i in layers){
			if(layers.hasOwnProperty(i)){
				var layer = layers[i];

				if(layer && layer.context && layer.context.id){
					sheet += "\n"+'#'+viewport.context.id+' #'+layer.context.id+'{ position:absolute; width:'+(layer.width || 'auto')+'; height:'+(layer.height || 'auto')+'; z-index:'+(zIndex || 'auto')+'; }';
					zIndex--; // next layer has a lower zIndex - e.g. terrain is behind objects
				}
			}
		}

		// update the stylesheet
		stylesheet.innerHTML += sheet;

	},

	/**
	 * This function updates the viewport. It updates at initial call the stylesheet.
	 * If called after initial render cycle, it will update the viewport DOMElements' style properties for overwriting the styles.
	 * If called with X and Y arguments, it will call updateViewportPosition() instead.
	 * @param {Number} [x] Viewport-Position-X
	 * @param {Number} [y] Viewport-Position-Y
	 * @returns {Boolean} True if viewport properties were updated successfully
	 */
	updateViewport: function(){

		// well, allows constantly calling with x and y position
		if(arguments[0]!==undefined || arguments[1]!==undefined){
			return this.updateViewportPosition(arguments[0], arguments[1]);
		}

		var stylesheet = this.stylesheet,
			viewport = this.viewport;

		if(!stylesheet.innerHTML.match('#'+viewport.context.id+' {')){
			// preferred: update the stylesheet
			var sheet = "\n"+'#'+viewport.context.id+' { width:'+(viewport.width || 'auto')+'; height:'+(viewport.height || 'auto')+'; overflow:'+(viewport.overflow || 'hidden')+'; }';
			stylesheet.innerHTML += sheet;
		}else{
			// alternative: update the style attribute
			var context = viewport.context;
			context.style.width = (viewport.width || 'auto');
			context.style.height = (viewport.height || 'auto');

			// NOT required: context.style.overflow = 'hidden';
		}

		return true;

	},

	/**
	 * This function updates the viewport position. It is called by updateViewport(x, y)
	 * @param {Number} x Viewport-Position-X (Tile-Grid-Coordinate)
	 * @param {Number} y Viewport-Position-Y (Tile-Grid-Coordinate)
	 * @returns {Boolean} True if viewport position was updated successfully. Otherwise false is returned.
	 */
	updateViewportPosition: function(x, y){

		var viewport = this.viewport,
			viewportSize = viewport.size,
			layers = this.viewport.layers,
			settings = this.settings,
			css = this._cssCache,
			sheet = '';

		var layerHolder, layerSize, shiftX, shiftY;

		if(!this.layerHolder || !this.layerSize){
			// find the layer holder
			for(var l in layers){
				if(layers.hasOwnProperty(l) && layers[l].context){
					layerHolder = this.layerHolder = layers[l].context.parentNode;
					layerSize = this.layerSize = layers[l].size;
					break;
				}
			}
		}else{
			layerHolder = this.layerHolder;
			layerSize = this.layerSize;
		}

		// translate shift positions
		shiftX = parseInt(x,10);
		shiftY = parseInt(y,10);

		// layer holder should have been found
		// well, otherwise a stupid guy made <html> to first rendering layer =D
		if(layerHolder){
			if(css.perspective){
				sheet += css.transform+":translate3d(-"+(shiftX * settings.squaresize)+"px,-"+(shiftY * settings.squaresize)+"px,0)";
			}else{
				sheet += css.transform+":translate(-"+(shiftX * settings.squaresize)+"px,-"+(shiftY * settings.squaresize)+"px)";
			}

			// update the viewport position
			viewport.position.x = shiftX;
			viewport.position.y = shiftY;

			layerHolder.style.cssText = sheet;
			return true;
		}

		return false;

	},

	/**
	 * This function prepares the models, it adds classes for further rendering functionality and sets model-dimensions for each CSS-class. It will update the stylesheet.
	 * @returns {Boolean} True if stylesheet was successfully updated. Otherwise false is returned.
	 */
	prepareModels: function(){

		var stylesheet = this.stylesheet,
			viewport = this.viewport,
			s = this.settings,
			namespace = '.'+(this.classNameSpace || viewport.context.id),
			models = this.cache.get('models'),
			sheet = "\n\n"+'/* models for namespace '+namespace+' */';

		// absolute positioning for models in our namespace
		sheet += "\n"+namespace+'{ display:block; position:absolute; top:auto; right:auto; bottom:auto; left:auto; margin:0; padding:0; }';

		for(var m in models){
			if(models.hasOwnProperty(m)){
				var model = models[m],
					modelWidth = (model.size.x * s.squaresize)+'px',
					modelHeight = (model.size.y * s.squaresize)+'px';

				// model.type was also included, but it doesn't make sense. each model has to be unique
				sheet += "\n"+namespace+'.'+model.name+'{ width:'+modelWidth+'; height:'+modelHeight+'; background-image:url('+model.image+'); background-repeat:no-repeat; }';
			}
		}

		return !!(stylesheet.innerHTML += sheet);

	}
};
