if(!ingenioJS.engine.controllers){ ingenioJS.engine.controllers = {}; }

/**
 * @constructor Quest Controller (offers quest interaction and centralized questmap structure)
 * @param {Object} engine The owning engine instance
 * @returns {Object} controller instance
 */
ingenioJS.engine.controllers.quest = function(engine){

	this.engine = engine;
	this.cache = this.engine.cache;

	// local cache for all quests
	this._inactiveQuests = {};
	this._activeQuests = {};

	// we will currify the player controller
	this._currify();

	// it will be initialized when the event is fired first.
	// why? because otherwise our object is not yet rendered =D
	this.initialized = false;

	return this;

}

ingenioJS.engine.controllers.quest.prototype = {

	/**
	 * This internal function activates the next quest (in _inactiveQuests).
	 * @returns {Boolean} True if inactive quest was found. False is returned if there are no more inactive quests.
	 */
	_activateNextQuest: function(){

		// search for inactive quests
		for(var q in this._inactiveQuests){
			if(this._inactiveQuests[q]){
				return !!this.activate(this._inactiveQuests[q].name);
			}
		}

		// No inactive quest found, so give player a hint that he did all quests
		this.engine.controllers.message && this.engine.controllers.message.execute('QUEST', 'Gratulations! You completed all Quests.');

		return false;
	},

	/**
	 * This internal function currifies the player controller. We will listen then on it's fired events
	 * instead of listening on all objects in the world...because that's a huge performance difference.
	 */
	_currify: function(){

		var self = this,
			player = this.playerController = this.engine.controllers.player;

		// HAHA! We initialize our quest controller when the player is ready.
		// Simplier than penetrating the DOM all the time =)

		player.init = (function(old){
			return function(){
				// call the original player's attack function
				if(old){ old.apply(player, arguments); }

				self.init.apply(self, []);
			}
		})(player.init);

		player.attack = (function(old){
			return function(){
				self.update.call(self, 'attack', arguments[0]);
				// call the original player's attack function
				if(old){ old.apply(player, arguments); }
			}
		})(player.attack);

		player.interact = (function(old){
			return function(){
				self.update.call(self, 'interact', arguments[0]);
				// call the original player's attack function
				if(old){ old.apply(player, arguments); }
			}
		})(player.interact);

	},

	/**
	 * This internal function checks the quest status. It is triggered each time a quest or its questparts have changed.
	 * If a quest was successfully done, a gratulation message will be shown and the quest will be deactivated.
	 * @todo Instead of simply deactivating the quest, try to implement a bonus system. Structure and architecture for that is undone yet.
	 */
	_checkQuestStatus: function(){

		var activateNext = false; // flag for activating the next quest

		for(var name in this._activeQuests){
			if(this._activeQuests.hasOwnProperty(name)){
				var quest = this._activeQuests[name];
				if(quest.success && quest.success.length === 0){
					this.engine.controllers.message && this.engine.controllers.message.execute('QUEST', 'Gratulations! You completed "' +quest.name+ '"');

					// TODO: Get some level-ups out of the quest
					this.deactivate(name);
					this._activateNextQuest();

					return true;

				}
			}
		}

		return false;

	},

	/**
	 * This function activates a quest by a given name
	 * @param {String} name The quest's name
	 * @returns {Boolean} True if matching quest was successfully activated and removed from inactive quests. Otherwise false is returned.
	 */
	activate: function(name){

		if(this._inactiveQuests[name]){
			this._activeQuests[name] = this._inactiveQuests[name];
			this.engine.controllers.message && this.engine.controllers.message.execute('QUEST', this._activeQuests[name].description);

			delete this._inactiveQuests[name];
			return true;
		}

		return false;

	},

	/**
	 * This function deactivates a quest by a given name
	 * @param {String} name The quest's name
	 * @returns {Boolean} True if matching quest was successfully deactivated and removed from active quests. Otherwise false is returned.
	 */
	deactivate: function(name){

		if(this._activeQuests[name]){
			// oh dude, that fucking line took me 2 hours of debugging until I figured it out.
			// will result in an endless-loop of all quests
			// this._inactiveQuests[name] = this._activeQuests[name];
			delete this._activeQuests[name];
			return true;
		}

		return false;

	},

	/**
	 * This function is called when the player controller was initialized - due to currifying.
	 * It simply caches the player's object locally for later position tracing.
	 */
	init: function(){

		if(!this.initialized){
			this.player = this.engine.cache.get('characters', 'player');
			this.initialized = true;
		}

	},

	/**
	 * This function will be executed anytime the quest controller is called.
	 * It will then handle the quests array that will be added to the questmap. If a quest's status is updated, the update() function will be called instead.
	 * @param {Array|Object} quests Either an array of quests or a signle quest object
	 */
	execute: function(quests){

		if(!quests.length){
			// create an array, the execute function was called with a single quest
			quests = [ quests ];
		}

		for(var q=0; q<quests.length; q++){
			var quest = quests[q];

			if(quest.activated){
				this._activeQuests[quest.name] = quest;
			}else{
				this._inactiveQuests[quest.name] = quest;
			}
		}

	},

	/**
	 * This function is called everytime the player controller fired an action.
	 * It will then walk through all quests and find matching quests (and their focussed objects), depending on the direction and the player's position
	 * @param {String} action The player controller's fired action, e.g. talk or attack
	 * @param {String} direction The targeted direction, which is top, right, bottom or left.
	 * @returns {Boolean} True if a matching quest was successfully completed. Otherwise false is returned.
	 */
	update: function(action, direction){

		var player = this.player;
		function removeQuestPart (array, id){
			var part1 = array.slice(0, id),
				part2 = array.slice(id + 1, array.length);

			array = [];
			array.push.apply(array, part1);
			array.push.apply(array, part2);

			return array;
		};

		for(var q in this._activeQuests){
			if(this._activeQuests.hasOwnProperty(q)){
				var quest = this._activeQuests[q];

				// first check if we've succeeded a quest part
				if(quest.success){
					for(var s=0; s<quest.success.length; s++){
						var questpart = quest.success[s];
						if(questpart.focus && questpart.type == 'action' && questpart.action == action){
							var object = this.cache.get('objects', questpart.focus) || this.cache.get('characters', questpart.focus),
								position = this.playerController._getPositionFromDirection(direction);

							if(object){
								for(var x=object.position.x; x<(object.position.x + object.model.size.x); x++){
									for(var y=object.position.y; y<(object.position.y + object.model.size.y); y++){
										if(x == position.x && y == position.y){
											this._activeQuests[q].success = removeQuestPart(this._activeQuests[q].success, s);

											// now check the updated quest status and return. So we avoid having multiple quests done via single action
											return !!this._checkQuestStatus();
										}
									}
								}
							}
						}
					}
				}
			}
		}

		// no matching quest found =(
		return false;

	}

};
