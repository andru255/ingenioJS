if(!ingenioJS.renderer.plugins){ ingenioJS.renderer.plugins = {}; }

/**
 * @constructor Renderer (HTML) / Animation Plugin (allows CSS3 or JavaScript animated objects)
 * @param {Object} owner The owning renderer instance
 * @returns {Object} renderer plugin instance
 */
ingenioJS.renderer.plugins.animation = function(owner){

	this.owner = owner;
	this.cache = owner.cache;
	this._cssCache = owner._cssCache;
	this.stylesheet = owner.stylesheet;

	// required for keyframe's size calculation
	this.squaresize = owner.settings.squaresize;

	this.viewport = owner.viewport;
	this.classNameSpace = owner.classNameSpace;

	// currify the owner, dude
	this._currify();

	return this;
};

ingenioJS.renderer.plugins.animation.prototype = {
	/**
	 * This function curryfies the renderer. The animation plugin will listen on execute, update and remove
	 */
	_currify: function(){

		var self = this,
			owner = self.owner;

		// execute is initial rendering
		owner.execute = (function(old){
			return function(){
				// call the original renderer's execute function
				if(old){ old.apply(owner, arguments); }

				// plugins requires generated node
				self.execute.apply(self, arguments);

			}
		})(owner.execute);

		// update is partial rendering
		owner.update = (function(old){
			return function(){
				// call the original renderer's update function
				if(old){ old.apply(owner, arguments); }

				// plugins requires generated node
				self.update.apply(self, arguments);
			}
		})(owner.update);

	},

	/**
	 * This function will render a single object or an array of objects. It is executed within the same-named renderer function call.
	 * The plugin prepares the animations (if css3 support is given) and starts their animation (if given)
	 * @param {String|DOMElement} context The rendering context.
	 * @param {Array|Object} todo The object or an array of objects that will be rendered.
	 * @config {String} [todo.animation] The object's attached animation name.
	 * @config {String} [todo.defaultAnimation] The object's attached default animation name.
	 */
	execute: function(context, todo){

		for(var i=0; i<todo.length; i++){

			if(todo[i].model && todo[i].model.animations && !this.cache.get('prepared-model-animations', todo[i].model.name)){
				this.prepareAnimations(todo[i]);
				this.cache.set('prepared-model-animations', todo[i].model.name, true);
			}

			if(todo[i].model && (todo[i].animation || todo[i].model.defaultAnimation)){
				this.startAnimation(todo[i], todo[i].animation || todo[i].model.defaultAnimation);
			}
		}

	},

	/**
	 * This function updates the objects that are rendered in intervals (render cycle).
	 * This function will only be used for animation if the browser doesn't support css3 animations.
	 * @param {String|DOMElement} context The rendering context
	 * @param {Array|Object} todo The object or an array of objects that will be removed.
	 * @config {String} [todo.animation] The object's attached animation name.
	 */
	update: function(context, todo){

		if(this._cssCache.animation){

			return;

		}else if(this._weirdJavaScript){

			var animatedObjects = this._animatedObjects,
				squaresize = this.squaresize,
				cleanupIds = [];

			for(var i=0; i<animatedObjects.length; i++){
				var object = animatedObjects[i],
					node = object.node,
					model = object.model,
					animations = object.model.animations,
					animation = false;

				if(object.animation && object.node){
					for(var a=0; a<animations.length; a++){
						if(animations[a].name === object.animation){
							animation = animations[a];
						}
					}

					if(animation){
						var currentFrame = false;

						// set up the local clock
						if(!this._animatedObjects[i].clock){
							this._animatedObjects[i].clock = {};
						}

						// no clock was set for timing, so we have an initial render
						if(!this._animatedObjects[i].clock.animation){
							this._animatedObjects[i].clock.animation = (new Date()).getTime();
							currentFrame = 1;

						// clock was found, so we have a render update on the object's animation
						}else if(this._animatedObjects[i].clock.animation){
							var timespan = ((new Date()).getTime() - this._animatedObjects[i].clock.animation) % animation.duration,
								framespan = Math.round(animation.duration / animation.frames); // 1000 / 5 = 250ms per frame

							// only Crockford knows how this Math works.
							// why is there a 10000000000000? because of rounding, idiot!
							currentFrame = Math.round(Math.round(timespan / framespan * 10000000000000) / 10000000000000) + 1;

							if(currentFrame > animation.frames){
								this._animatedObjects[i].clock.animation = (new Date()).getTime();
							}
						}

						// only update if frame has changed since last update cycle
						if(this._animatedObjects[i].clock.currentFrame != currentFrame){
							// update the node's background-position
							node.style.backgroundPosition = '-' +((currentFrame - 1) * model.size.x * squaresize)+ 'px -' +((animation.spritemap - 1) * model.size.y * squaresize)+ 'px';
							this._animatedObjects[i].clock.currentFrame = currentFrame;
						}
					}
				}else{
					// cache it, because we currently walk for in here =)
					cleanupIds.push(i);
				}
			}

			if(cleanupIds && cleanupIds.length){
				this._cleanup(cleanupIds);
			}
		}

	},

	/**
	 * This internal function is called after an animation was stopped or an object was removed.
	 * It is called by the update cycle.
	 * @param {Array} todo The array of Ids (the stack id in _animatedObjects)
	 */
	_cleanup: function(todo){

		if(!todo || !this._weirdJavaScript) return;
		if(!todo.length){
			todo = [ todo ];
		}

		function removeAnimationPart (array, id){
			var part1 = array.slice(0, id),
				part2 = array.slice(id + 1, array.length);

			array = [];
			array.push.apply(array, part1);
			array.push.apply(array, part2);

			return array;
		};

		for(var i=0; i<todo.length; i++){
			var removeId = todo[i];
			this._animatedObjects = removeAnimationPart(this._animatedObjects, removeId);
		}

	},

	/**
	 * This function prepares the animations. If css3 animation support is given, it will update the stylesheet
	 * based on the model attached to the object. Otherwise it will push the object to the animation queue.
	 * @param {Object} object The object whose animation is prepared. It requires an attached model.
	 */
	prepareAnimations: function(object){

		var css = this._cssCache,
			model = object.model,
			animations = model.animations,
			sheet = "\n\n"+'/* model animation set for ' + model.name+ ' */',
			namespace = '.'+(this.classNameSpace || this.viewport.context.id),
			squaresize = this.squaresize;

		if(css.animation){
			//css.animation = '-webkit-animation';

			for(var a=0; a<animations.length; a++){
				var animation = animations[a];

				// linking the css animation to model with data-ani attribute
				sheet += "\n" +namespace+ '.'+model.name+ '[data-ani=\'' +animation.name+ '\']{ ' +css.animation+ ': \'' +model.name+ '-' +animation.name+ '\' ' +animation.duration+ 'ms step-start ' +(animation.repeat ? 'infinite' : '1')+ '; }';

				// generating the keyframes for animation
				css.keyframes = '@'+css.animation.replace('animation','keyframes'); // should be the same vendor

				sheet += "\n" + css.keyframes + ' \'' +model.name+ '-' +animation.name+ '\' {';

				for(var i=0; i<animation.frames; i++){
					var percentage = Math.round(100/animation.frames * i)+'%',
						positionX = '-' + (i * model.size.x * squaresize)+'px',
						positionY = '-' + ((animation.spritemap - 1) * model.size.y * squaresize)+'px';
						// -> spritemap position 1 results in -0px in y-direction!

					sheet += "\n\t" + percentage + ' { background-position:' + positionX + ' ' + positionY + '; } ';

				}
				sheet += "\n}";


			}

			this.stylesheet.innerHTML += sheet;

		}else{
			// set the flag for plugin.update() (curry for renderer.update())
			this._weirdJavaScript = true;

			// setup a cache array wherein the animated objects will be stored; meanwhile the renderer updates
			if(!this._animatedObjects){
				this._animatedObjects = [];
			}
		}

	},

	/**
	 * This function starts an animation on the given object. The animation will start depending on css3 animation support
	 * (changing its attributes) or on a javascript based animation (pushing the object to animation queue).
	 * @param {Object} object The object which will be animated.
	 * @param {String} animation The animation name that will be started.
	 */
	startAnimation: function(object, animation){

		if(this._cssCache.animation){
			object.node.setAttribute('data-ani', animation);
		}else if(this._weirdJavaScript){
			object.animation = animation;
			this._animatedObjects.push(object);
		}

	},

	/**
	 * This function stops an animation on the given object.
	 * @param {Object} object The object whose animation will be stopped.
	 */
	stopAnimation: function(object){

		if(this._cssCache.animation){
			object.node.removeAttribute('data-ani');
		}else if(this._weirdJavaScript){
			// will automatically be removed in next update cycle
			object.animation = false;
		}

	}
};
