if(!ingenioJS.engine.controllers){ ingenioJS.engine.controllers = {}; }

/**
 * @constructor Item Controller (offers simplified messaging service)
 * @param {Object} engine The owning engine instance
 * @returns {Object} controller instance
 */
ingenioJS.engine.controllers.item = function(engine){

	this.engine = engine;
	this.cache = this.engine.cache;

	return this;

}

ingenioJS.engine.controllers.item.prototype = {

	/**
	 * This function will be executed anytime the item controller is called.
	 * It will then handle the model of the item depending on the player's bag size
	 * @param {Object|String} model The item model (name or model structure)
	 * @todo Implement bonus-structure for models and invent a bonus system for upgrading the player
	 */
	execute: function(model){

		// allow calling without a model structure
		model = model.name ? model : this.cache.get('models', model);

		this.engine.controllers.message && this.engine.controllers.message.execute('ITEM', 'You successfully collected ' +(model.name)+'!');

	}

};
