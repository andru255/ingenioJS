if(!ingenioJS.engine.controllers){ ingenioJS.engine.controllers = {}; }

/**
 * @constructor Message Controller (offers simplified messaging service)
 * @param {Object} engine The owning engine instance
 * @returns {Object} controller instance
 */
ingenioJS.engine.controllers.message = function(engine){

	this.engine = engine;

	if(this.engine.settings.messages){
		this.context = this.engine.settings.messages.id ? this.engine.settings.messages : document.getElementById(this.engine.settings.messages);
	}

	return this;

}

ingenioJS.engine.controllers.message.prototype = {

	/**
	 * This function will be executed anytime the message controller is called.
	 * It will then handle the name or id of the object and show the message. Can be used for debugging, too.
	 * @param {String} object The referring object (id or name)
	 * @param {String} message The message which will be displayed
	 * @example
	 * controllers.message.execute('CSS Ninja', 'Hello, how are you doing?');
	 */
	execute: function(object, message){

		this.context.innerHTML = '<p><strong>'+object+'</strong>'+ message+ '</p>' + this.context.innerHTML;

	}

};
