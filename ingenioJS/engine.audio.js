
/**
 * @constructor Engine / Audio Controller (allows playback and controls of audio and music)
 * @param {Object} controller The owning controller instance
 * @returns {Object} controller plugin instance
 * @todo Improve audio engine with multi-channel and multi-stream functionalities; Improve also a flash-using fallback
 */
ingenioJS.engine.audio = function(settings){

	// defaults
	this.settings = {
		resource: false,
		autoplay: true,
		jumpmarks: {},
		frequency: 10, // 40 will result in 40Hz, 22500 in 22.5kHz
		loop: false
	};

	if(settings.length){
		this.defaults = this.settings;
		this.settings = {};
		// overwrite defaults
		for(var i=0; i<settings.length; i++){
			for(var d in settings[i]){
				if(settings[i].hasOwnProperty(d)){
					this.settings[i] = this.defaults;
					this.settings[i][d] = settings[d];
				}
			}
		}
	}else{
		// overwrite defaults
		for(var s in settings){
			if(settings.hasOwnProperty(s)){
				this.settings[s] = settings[s];
			}
		}
	}

	// initialize the audio
	this.init(this.settings);

	// called for multiple streams
	if(this.settings.length){
		return this.streams;
	// called for single stream
	}else{
		return this.stream;
	}

};

ingenioJS.engine.audio.prototype = {

	/**
	 * This function initializes the stream instance or multiple instances.
	 * @param {Array|Object} settings
	 * @todo Allow multiple settings for checking on being an array - and then walking through it (otherwise settings = [settings])
	 */
	init: function(settings){

		if(!this.streams){
			this.streams = [];
		}

// TODO: BEGIN WALKTHROUGH all settings-streams
		var set = settings;
		var stream = {};

		var ext = set.resource.split('.');
			ext = ext[ext.length - 1];

		// find out which method we use for playing the stream. embed or html5 audio?
		switch(ext){
			case "mid":
			case "midi":
				set.type = 'embed';
			break;
			case "mp3":
			case "ogg":
				set.type = 'html5';
			break;
			default: // default is using a plugin!
				set.type = 'embed';
			break;
		}


		if(set.type == 'html5'){
			stream.type = set.type; // cache the type for later usage

			stream.context = document.createElement('audio');
			stream.context.id = 'controller-audio-'+(this.streams.length + 1);
			stream.context.src = set.resource;
			stream.context.setAttribute('class', 'audio-stream');

			// DEBUGGING
			// stream.context.setAttribute('controls', 'true');

			if(set.autoplay){
				stream.context.setAttribute('autoplay', 'true');
			}

			// append the audio stream now
			document.getElementsByTagName('body')[0].appendChild(stream.context);

		}else if(set.type == 'embed'){

			stream.type = set.type;

			stream.context = document.createElement('embed');
			stream.context.id = 'controller-audio-'+(this.streams.length + 1);
			stream.context.src = set.resource;
			stream.context.setAttribute('class', 'audio-stream');

			var mime = '';

			// set the corresponding mime-type
			switch(ext){
				case "mid":
				case "midi":
					mime = 'audio/midi';
				break;
			}

			stream.context.setAttribute('type', (mime.length ? mime : 'audio/*' ));

			// DEBUGGING
			stream.context.setAttribute('hidden' , 'true');

			if(set.autoplay){
				stream.context.setAttribute('autostart', 'true');
			}

			if(set.loop){
				stream.context.setAttribute('loop', 'true');
			}

			// append the audio stream now
			document.getElementsByTagName('body')[0].appendChild(stream.context);

		}

		// cache the jumpmarks
		if(set.jumpmarks){
			stream.jumpmarks = set.jumpmarks;
		}

		// attach the per-stream functionality
		stream.play = this.play;
		stream.stop = this.stop;
		stream.start = this.resume;
		stream.pause = this.pause;
		stream.resume = this.resume;

		// cache the stream
		this.streams.push(stream);

// END WALKTHROUGH

		// no other streams are given, cache the stream
		if(!settings.length){
			this.stream = stream;
		}

	},

	/**
	 * This function plays a jump mark and is called directly on a stream.
	 * It will move the current position of the played audio to a given jumpmark or to 0, also depending on the loop argument
	 * @param {String} [mark] The jumpmark which was previously set while creating the engine.audio instance
	 * @param {Boolean} [loop] Repeats the stream until loop is turned off or stop() was called.
	 */
	play: function(){

		var mark = arguments[0] || false,
			loop = arguments[1] || false;

		// only available for single-stream usage
		if(mark && this.jumpmarks && this.jumpmarks[mark]){
			if(this.context){
				var jumpTo = this.jumpmarks[mark],
					tmp = [];

				// 1:20:10 -> 80.10
				if(jumpTo.match(":")){
					tmp = jumpTo.split(':');
					jumpTo = parseInt(0,10); // integer required!

					tmp[0] = parseInt(tmp[0],10) * 60; // minutes
					tmp[1] = parseInt(tmp[1],10); // seconds
					tmp[2] = parseInt(tmp[2],10) / 60; // milliseconds (-> format: s.ms)

					jumpTo += tmp[0] + tmp[1] + tmp[2];
				}

				if(this.type == 'html5'){
					this.context.currentTime = Math.round(jumpTo);
				}
			}
		}

	},

	/**
	 * This function stops the playback of a stream.
	 * It will reset the current position of the played audio stream.
	 */
	stop: function(){

		if(this.type == 'html5'){
			this.lastPointer = 0; // reset pointer
			this.context.pause();
		}else if(this.type == 'embed'){
			// TODO: Find out how "most" of the plugin APIs work
			// Removing the attribute does nothing. That kinda sucks, dude.
		}

	},

	/**
	 * This function pauses the playback of a stream.
	 * It will save the current position of the played audio stream. This saved position is used by resume()
	 */
	pause: function(){

		if(this.type == 'html5'){
			this.lastPointer = this.context.currentTime && this.context.pause();
		}

	},

	/**
	 * This function resumes the playback of a stream using the last saved position of the audio stream.
	 * Depending on its value, the playback starts on its position in the stream.
	 */
	resume: function(){

		if(this.type == 'html5'){
			this.context.play();

			// only set play position in spritemap if we got a last pointer (set by pause())
			this.lastPointer && this.play(this.lastPointer);
			this.lastPointer = false; // reset pointer (interval can be executed several times/second!)
		}else if(this.type == 'embed'){
			// TODO: Find out how "most" of the plugin APIs work
		}

	}

};
