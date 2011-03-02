
/**
 * @constructor Engine, which manages all game logic
 * @param {String|DOMElement} viewport The required viewport DOM Element Id
 * @param {Object} settings The required settings object that will be merged with defaults
 * @returns {Object} engine instance
 */
ingenioJS.engine = function(viewport, settings){

	// Well, should I implement this? I mean, anyone who is 2 dumb to use new shouldn't use my engine.
	//if(!(this instanceof arguments.callee)){
	//	return new arguments.callee(viewport, settings);
	//}

	// optional callback argument triggered when engine was initialized
	var callback = arguments[2] || false;

	// set default settings
	this.settings = {
		context: 'ninja-game',
		layers: {}, // fill layers later
		size: {
			x: 20,
			y: 10
		},
		squaresize: 30, // pixel-related size
		editable: false // false = added objects are not cached in this.levelmap[]
	};

	for(var s in settings){
		if(settings.hasOwnProperty(s)){
			// enhance properties if they aren't set yet
			this.settings[s] = settings[s];
		}
	}

	settings = this.settings;
	if(!this.context){
		this.context = document.getElementById(settings.context);
	}

	// set viewport first
	if(!this.viewport){
		this.viewport = {
			context: document.getElementById( (viewport || this.context.parentNode.id) ),
			layers: {}
		};

		if(settings.viewport){
			if(settings.viewport.overflow){
				this.viewport.overflow = settings.viewport.overflow;
			}

			if(settings.viewport.x && settings.viewport.y){
				this.viewport.size = {
					x: settings.viewport.x,
					y: settings.viewport.y
				};
			}
		}

		for(var l in settings.layers){
			if(settings.layers.hasOwnProperty(l)){
				this.viewport.layers[l] = { context: document.getElementById(settings.layers[l]) };
			}
		}
	}

	// init editor functionality
	if(settings.editable){
		this.levelmap = [];
	}

	this.init();

	if(ingenioJS.engine.controllers){
		this.controllers = {}; // namespace for engine's controllers
		for(var controller in ingenioJS.engine.controllers){
			if(ingenioJS.engine.controllers.hasOwnProperty(controller)){
				this.controllers[controller] = new ingenioJS.engine.controllers[controller](this);
			}
		}
	}

	// init level data
	this.loadLevel(this.cache.get('levels', (settings.level || 'level1')));

	callback && callback(this);

};

ingenioJS.engine.prototype = {

	/**
	 * This function initializes the engine, fetches model index and level index and links instances of other objects.
	 */
	init: function(){

		// init cache
		this.cache = new ingenioJS.cache();

		var self = this,
			settings = this.settings;

		// fetch model index
		if(settings.models && settings.models.base && settings.models.index){
			iJS.ajax(settings.models.index,function(data){
				var models = JSON.parse(data) || false;
				if(models && models.length){
					for(var m=0;m<models.length;m++){
						models[m].image = (settings.models.base ? settings.models.base+'/' : '') + models[m].image;
						self.cache.set('models', models[m].name, models[m]);
					}
				}
			});
		}

		// fetch level index
		if(settings.levels && settings.levels.base && settings.levels.index){
			iJS.ajax(settings.levels.index,function(data){
				var levels = JSON.parse(data) || false;
				if(levels && levels.length){
					for(var l=0;l<levels.length;l++){
						self.cache.set('levels', levels[l].name, levels[l]);
					}
				}
			});
		}

		// init compositor
		this.compositor = new ingenioJS.compositor(this.viewport, settings);

		// update the viewport (calculated by compositor)
		// I wanted to let the compositor call the renderer, but renderer requires calculated viewport. *sigh*
		this.compositor.updateViewport();
		this.viewport = this.compositor.getViewport();

		// init renderer
		this.renderer = this.compositor.renderer = new ingenioJS.renderer(this.viewport, settings, this.cache);

	},

	/**
	 * This function will load the level's json data and then load its contained objects and other environment details.
	 * @param {Object|String} level Either the actual level instance of the cache or the level's name.
	 * @example
	 * engine.loadLevel(game.cache.get('levels', 'level2'));
	 * engine.loadLevel('level3');
	 */
	loadLevel: function(level){

		// easier handling
		if(typeof level == 'string'){
			level = this.cache.get('levels', level);
		}

		// skip if level could not be fetched
		if(typeof level != 'object'){
			return false;
		}

		var self = this,
			layers = this.viewport.layers,
			settings = this.settings;

		// update layer sizes
		for(var l in layers){
			if(layers.hasOwnProperty(l) && layers[l].size != level.size){
				layers[l].size = level.size;
			}
		}
		this.compositor.updateLayers();

		// no errors until now, so cache the level-link
		this.currentLevel = level;

		if(level.objects){
			// load level's objects
			iJS.ajax((settings.levels.base ? settings.levels.base+'/' : '') + level.objects,function(data){
				var json = JSON.parse(data || '[]');
				if(json.length > 0){
					self.currentLevel.objects = json;
				}
			});
		}

		if(level.quests){
			// load level's quests
			iJS.ajax((settings.levels.base ? settings.levels.base+'/' : '') + level.quests,function(data){
				var json = JSON.parse(data || '[]');
				if(json.length > 0){
					self.currentLevel.quests = json;
				}
			});
		}

		// load level's music environment
		if(this.currentLevel.music){
			this.loadMusic(this.currentLevel.music);
		}

		// load level's terrain (repeated) background
		this.loadTerrain();

		// load level's objects after the environment was setup
		this.loadObjects(this.currentLevel.objects);

		// load level's quests AFTER objects were loaded (quests can be hooked or triggered on object events)
		this.loadQuests(this.currentLevel.quests);

	},

	/**
	 * This function will load the music environment, depending on the level-based settings.
	 * @param {Object} settings The music settings passed through the audio engine
	 * @returns {Boolean} Returns true, if engine.music could be initialized. Otherwise false is returned.
	 */
	loadMusic: function(settings){

		if(ingenioJS.engine.audio){
			this.music = new ingenioJS.engine.audio(settings);
			return true;
		}

		return false;
	},

	/**
	 * This function will load objects, sort them into the layers and execute the compositor with the filtered data. The hitmap will be updated afterwards.
	 * @param {Array} objects The objects array, usually the same as engine.currentLevel.objects
	 * @example
	 * engine.loadObjects([{
	 * 	id: 'myObjectId',
	 * 	model:'flower-red',
	 * 	position: {
	 * 		x: 5, y: 10
	 * 	}
	 * }]);
	 */
	loadObjects: function(objects){

		var layers = this.viewport.layers,
			sorted = {
				objects: [], characters: [], terrain: []
			};

		for(var i=0;i<objects.length;i++){

			// attach model to objects
			objects[i].model = this.cache.get('models', objects[i].model);

			// editing functionality
			if(this.settings.editable){
				this.levelmap.push(objects[i]);
			}

			// sorting the objects into targeted layers (in game world)
			switch(objects[i].model.type){
				case 'character':
					this.cache.set('characters', objects[i].id || 'character-'+(sorted.characters.length + 1), objects[i]);
					sorted.characters.push(objects[i]);
					break;
				case 'item':
				case 'object':
					this.cache.set('objects', objects[i].id || 'object-'+(sorted.objects.length + 1), objects[i]);
					sorted.objects.push(objects[i]);
					break;
				case 'terrain':
					// terrain won't be cached. Is not necessary for interaction purposes
					sorted.terrain.push(objects[i]);
					break;
				default:
					break;
			}
		}

		for(var s in sorted){
			if(sorted.hasOwnProperty(s)){
				if(layers[s] && sorted[s].length){
					this.compositor.execute(layers[s].context, sorted[s]);
				}else{
					// default rendering layer is the objects layer
					this.compositor.execute(layers.objects.context, sorted[s]);
				}
			}
		}

		// finally init hitmap
		if(!this.hitmap){
			this.hitmap = new ingenioJS.engine.hitmap(this, objects);
		}else{
			this.hitmap.execute(sorted.objects);
		}

	},

	/**
	 * This function will load quests, sort them into the questmap and execute the questmap controller afterwards.
	 * @param {Array} quests The quests array, usually the same as engine.currentLevel.quests
	 */
	loadQuests: function(quests){

		if(this.controllers && this.controllers.quest){
			this.controllers.quest.execute(quests);

			// activate the first quest
			this.controllers.quest.activate(quests[0].name || false);
		}

	},

	/**
	 * This function simply loads the terrain background. The background is behind the terrain-layered tiles (or objects)
	 * @param {String} url The URL of the Image Resource
	 * @returns {Boolean} Returns true if background was successfully set by the renderer. Otherwise false is returned.
	 */
	loadTerrain: function(){

		if(!this.settings.models.base) return;

		var context = this.viewport.layers.terrain.context,
			url = this.settings.models.base+'/terrain.png';

		return this.renderer.updateBackground(context, url);

	},

	/**
	 * This function will flag the object to be updated and call the compositor.
	 */
	updateObject: function(object){

		if(!object) return;

		object.composite = 'update';
		this.compositor.execute(this.viewport.layers.objects.context, object);

	},

	/**
	 * This function will flag the object to be removed and call the compositor. Also the hitmap will be cleaned up afterwards.
	 * @todo move the function removeLevelmapEntry to a namespace or so...
	 */
	removeObject: function(object){

		if(!object) return;

		if(this.settings.editable){

			var removeId = false;
			for(var i=0; i<this.levelmap.length; i++){
				if(this.levelmap[i] == object){
					removeId = i;
					break;
				}
			}

			if(removeId !== false){
				this.levelmap = iJS.removeArrayEntry(this.levelmap, removeId);
			}
		}

		object.composite = 'remove';
		this.compositor.execute(this.viewport.layers.objects.context, object);
		this.hitmap.remove(object);

	}

};
