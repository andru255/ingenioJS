if(!me){ var me = {}; }

me.editor = function(viewport, settings){

	settings.viewport = { overflow: 'auto' };
	settings.editable = true;

	this.engine = new ingenioJS.engine(viewport, settings);

	// share everything we need betweeen editor and engine
	this.cache = this.engine.cache;
	this.hitmap = this.engine.hitmap;

	this.context = this.engine.context;
	this.viewport = this.engine.viewport;
	this.settings = this.engine.settings;

	this._inspectedObject = false;

	// initialize everything
	this.init();
	this.loadModels();
}

me.editor.prototype = {

	init: function(){

		// setup object where to post information to
		this.info = {
			mousehelperPosition: document.getElementById('ui-debug-mousehelper-position'),
			mousehelperSize: document.getElementById('ui-debug-mousehelper-size'),
			model: document.getElementById('ui-debug-model'),
			mode: document.getElementById('ui-debug-mode')
		};

		// init editor functionality, helpers and stuff
		this.mousehelper = {
			context: document.getElementById(this.settings.mousehelper),
			position: { x:0, y:0 }
		};

		var self = this;

		if(this.context){
			this.context.addEventListener('mousemove',function(event){
				self.moveMousehelper(event);
			},true);

			this.context.addEventListener('click',function(event){
				self.clickMousehelper(event);
			},true);
		}

		this.setModel('debugger');

	},

	clickMousehelper: function(event){

		var settings = this.settings,
			mhPosition = this.mousehelper.position,
			mhSize = this.mousehelper.size;

		// first check if delete action was triggered
		for(var i=0; i<this.engine.levelmap.length; i++){
			var object = this.engine.levelmap[i];

			for(var x=mhPosition.x; x<(mhPosition.x + mhSize.x); x++){
				for(var y=mhPosition.y; y<(mhPosition.y + mhSize.y); y++){
					var position = { x: x, y: y };

					if(position.x >= object.position.x && position.x < (object.position.x + object.model.size.x)){
						if(position.y >= object.position.y && position.y < (object.position.y + object.model.size.y)){

							if(this._inspectMode){
								// object is within range, so inspect it
								this.inspectObject(object);
							}else{
								// object is within range, so remove it.
								this.engine.removeObject(object);
							}

							return false;
						}
					}
				}
			}
		}

		if(window.location.hash == '#ui-inspect'){
			window.location.hash = '!';
		}

		if(!this._inspectMode){
			this.engine.loadObjects([{
				model: this._currentModel,
				position: {
					x: mhPosition.x,
					y: mhPosition.y
				}
			}]);
		}
	},


	moveMousehelper: function(event){

		var settings = this.settings,
			context = this.mousehelper.context,
			size = this.mousehelper.size || { x:1, y:1 },
			mapsize = this.engine.currentLevel.size;

		function getOffset(node,offsetDirection){
			if(arguments[2]!==undefined){
				var offset = arguments[2];
			}else{
				var offset = 0;
			}

			if(node[offsetDirection]!=0){
				offset += node[offsetDirection];
			}

			if(node.parentNode && node.parentNode.tagName != 'BODY'){
				offset += (getOffset(node.parentNode, offsetDirection, offset) || 0);
			}

			return (offset || 0);
		}

		// update the mousehelper's position in tile-grid
		var position = {
			x: Math.round((event.clientX - getOffset(context.parentNode,'offsetLeft') + getOffset(context.parentNode,'scrollLeft')) / settings.squaresize),
			y: Math.round((event.clientY - getOffset(context.parentNode,'offsetTop') + getOffset(context.parentNode,'scrollTop')) / settings.squaresize)
		};

		// update the position, depending on the size
		position.x = position.x - Math.round(size.x/2);
		position.y = position.y - Math.round(size.y/2);

		// return if the mousehelper position is identical
		if(position.x == this.mousehelper.position.x && position.y == this.mousehelper.position.y){
			return false;
		}
		// return if mouse position is out of map range
		if((position.x + size.x > mapsize.x || position.x < 0) || (position.y + size.y > mapsize.y || position.y < 0)){
			return false;
		}

		// update the size if mousehelper was flagged as dirty
		if(this.mousehelper.dirty){
			context.style.width = (size.x * settings.squaresize)+'px';
			context.style.height = (size.y * settings.squaresize)+'px';

			// update the mousehelper's size in user interface
			if(this.info && this.info.mousehelperSize){
				this.info.mousehelperSize.innerHTML = size.x+' x '+size.y;
			}

			// reset the dirty flag
			this.mousehelper.dirty = false;
		}


		if(!this._inspectMode){
			if(size.x > 1 || size.y > 1){
				context.className = 'okay';
				for(var x=position.x; x<(position.x + size.x); x++){
					for(var y=position.y; y<(position.y + size.y); y++){
						if(this.hitmap.get(x, y)){
							context.className = 'fail';
						}
					}
				}
			}else{
				if(this.hitmap.get(position.x, position.y)){
					context.className = 'fail';
				}else{
					context.className = 'okay';
				}
			}
		}else{
			context.className = '';
		}

		// update the mousehelper's position in user interface
		if(this.info && this.info.mousehelperPosition){
			this.info.mousehelperPosition.innerHTML = position.x+' x '+position.y;
		}

		// update the position
		context.style.left = (position.x * settings.squaresize)+'px';
		context.style.top = (position.y * settings.squaresize)+'px';
		this.mousehelper.position = position;

	},

	loadModels: function(){

		var modelContainer = this.settings.modelContainer,
			models = this.cache.get('models'),
			cachedObjects = [],
			html = '';

		for(var i in models){
			var object = {
				id: 'ui-model-'+models[i].name,
				model: models[i]
			};

			// the html for the inspect ui
			html += "<option value=\"" +models[i].name+ "\">" +models[i].name+ "</option>";

			if(modelContainer && modelContainer[models[i].type]){
				this.engine.renderer.execute(modelContainer[models[i].type], [ object ]);
			}
		}

		// update the created elements with onclick functionality
		for(var c in modelContainer){
			var context = modelContainer[c];
			context = context.id ? context : document.getElementById(context);

			if(context){
				var elements = context.getElementsByTagName('*');
				for(var i=0; i<elements.length; i++){
					var element = elements[i];
					element.onclick = function(){ editor.setModel(this.id.replace('ui-model-','')); };
				}
			}
		}

		if(html != ''){
			html = '<option value="-">-</option>' +html;
			document.getElementById('ui-inspect-model').innerHTML = html;
		}

	},

	setModel: function(modelId){

		// cache the current model id
		this._currentModel = modelId;

		if(this.mousehelper){
			var model = this.cache.get('models', this._currentModel);
			if(this.info && this.info.model){
				this.info.model.innerHTML = model.name;
			}

			this.mousehelper.size = {
				x: model.size.x,
				y: model.size.y
			}

			// set dirty flag for moveMousehelper function
			this.mousehelper.dirty = true;
		}

	},

	exportLevel: function(){

		var levelmap = this.engine.levelmap,
			cache = [];

		for(var i=0; i<levelmap.length; i++){
			var object = levelmap[i];

			// required information for JSON
			var _levelentry = {
				model: object.model.name,
				position: {
					x: object.position.x,
					y: object.position.y
				}
			};

			// optional information for JSON
			if(object.id){
				_levelentry.id = object.id;
			}
			if(object.animation){
				_levelentry.animation = object.animation;
			}

			cache.push(_levelentry);
		}

		// export the level objects
		var target = document.getElementById('ui-level-export-json');
		if(target){
			target.value = JSON.stringify(cache, null, '\t');
		}


		cache = ''; // reset the cache
		cache = this.getSettings(); // will retrieve all level settings

		// export the level index entry
		var target = document.getElementById('ui-level-export-levelindex');
		if(target){
			target.value = JSON.stringify(cache, null, '\t');
		}

	},

	inspectObject: function(object){

		// only use the inspected object link
		this._inspectedObject = object;

		if(!this._inspectedObjectUI){
			this._inspectedObjectUI = {
				id: document.getElementById('ui-inspect-id') || false,
				model: document.getElementById('ui-inspect-model') || false,
				animation: document.getElementById('ui-inspect-animation') || false,
				events: document.getElementById('ui-inspect-events') || false,
				addEvent: {
					type: document.getElementById('ui-inspect-events-add-type') || false,
					message: document.getElementById('ui-inspect-events-add-message') || false,
					trigger: document.getElementById('ui-inspect-events-add-trigger') || false,
					require: document.getElementById('ui-inspect-events-add-require') || false
				}
			}
		}



		if(this._inspectedObjectUI.id){
			this._inspectedObjectUI.id.value = this._inspectedObject.id || '';
		}

		if(this._inspectedObjectUI.animation){
			this._inspectedObjectUI.animation.value = this._inspectedObject.animation || '';
		}

		if(this._inspectedObjectUI.model && this._inspectedObjectUI.model.children){
			for(var c=0; c<this._inspectedObjectUI.model.children.length; c++){
				var option = this._inspectedObjectUI.model.children[c];

				if(option.value == this._inspectedObject.model.name){
					option.setAttribute('selected', true);
					this._inspectedObjectUI.model.selectedIndex = c;
				}else if(option.getAttribute('selected')){
					option.removeAttribute('selected');
				}
			}
		}


		if(this._inspectedObject.events && this._inspectedObjectUI.events){
			var html = '';
			for(e=0; e<this._inspectedObject.events.length; e++){
				var evt = this._inspectedObject.events[e];
				html += "<li data-type=\"" +(evt.type || '-')+ "\" data-message=\"" +(evt.message || '')+ "\" data-trigger=\"" +(evt.trigger || '')+ "\" data-require=\"" +(evt.require || '')+ "\">";
				html += (evt.type || '-') + " / \"" +(evt.message || '')+"\"";
				html += "</li>";
			}
			// array could be in an unsupported structure defect...
			this._inspectedObjectUI.events.innerHTML = (html != '') ? html : 'No attached events';
		}else{
			this._inspectedObjectUI.events.innerHTML = 'No attached events';
		}

		// show ui
		window.location.hash = '#ui-inspect';

	},

	updateObject: function(){

		if(this._inspectedObject && this._inspectedObjectUI){

			if(this._inspectedObjectUI.id.value != ''){
				this._inspectedObject.id = this._inspectedObjectUI.id.value;
			}

			if(typeof this._inspectedObjectUI.model.selectedIndex == 'number'){
				var model = this._inspectedObjectUI.model.childNodes[this._inspectedObjectUI.model.selectedIndex].value || false;

				// remove object if no model was selected
				if(!model || model == '-'){
					this._inspectedObject.composite = 'remove';
				}else{
					this._inspectedObject.composite = 'update';
					this._inspectedObject.model = model;
				}

			}

			if(this._inspectedObjectUI.animation.value){
				this._inspectedObject.animation = this._inspectedObjectUI.animation.value;
			}

			if(this._inspectedObject.composite == 'remove'){
				this.engine.removeObject(this._inspectedObject);
			}else{
				this.engine.updateObject(this._inspectedObject);
			}

		}

		// hide the inspect frame now
		if(window.location.hash == '#ui-inspect'){
			window.location.hash = '!';
		}
	},

	switchMode: function(){

		var context = this.mousehelper.context || false,
			squaresize = this.settings.squaresize;

		this._inspectMode = !this._inspectMode;

		if(this.info && this.info.mode){
			this.info.mode.innerHTML = !!this._inspectMode ? 'Inspect' : 'Build';
		}

		if(this._inspectMode && context){
			this.mousehelper.size = {x:1, y:1 };
			this.mousehelper.dirty = true;

			this.moveMousehelper({clientX:window.innerWidth/2, clientY:window.innerHeight/2});
		}else{
			this.setModel(this._currentModel);
		}

	},

	getSettings: function(){

		var elements = document.getElementsByClassName('editor-settings'),
			cache = {};

		for(var i=0; i<elements.length; i++){
			var sKey = elements[i].getAttribute('name'),
				sVal = elements[i].value ? elements[i].value : elements[i].innerHTML;

			cache[sKey] = sVal;
		}

		var levelSettings = {
			name: cache['level.name'] || "level1",
			description: cache['level.description'] || "No description",
			size: {
				x: cache['level.size.x'] || 30,
				y: cache['level.size.y'] || 30
			}
		};

		return levelSettings;

	},

	updateSettings: function(){

	}

}
