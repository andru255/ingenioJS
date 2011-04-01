
/**
 * @constructor Engine / Audio Controller (allows playback and controls of audio and music)
 * @param {Object} controller The owning controller instance
 * @returns {Object} controller plugin instance
 * @todo Improve audio engine with multi-channel and multi-stream functionalities; Improve also a flash-using fallback
 */
ingenioJS.engine.audio = function(settings){

	// defaults
	/*
	this.defaults = {
		resources: false,
		autoplay: false,
		jumpmarks: {},
		frequency: 10, // 40 will result in 40Hz, 22500 in 22.5kHz
		loop: false
	};
	*/

	if(settings.length){
		this.settings = [];
		// overwrite defaults
		for(var i=0; i<settings.length; i++){
			if(!this.settings[i]){
				this.settings[i] = {};
			}

			for(var d in settings[i]){
				if(settings[i].hasOwnProperty(d)){
					this.settings[i][d] = settings[i][d];
				}
			}
		}
	}else{
		this.settings = {};
		// overwrite defaults
		for(var s in settings){
			if(settings.hasOwnProperty(s)){
				this.settings[s] = settings[s];
			}
		}
	}

	// detect the supported features
	if(!this.features){
		this._detectFeatures();
	}

	// initialize the audio
	this.init(this.settings);

	// called for multiple streams
	if(this.settings.length){
		return this.streams;
	// called for single stream
	}else{
		return this.streams[0];
	}

};

ingenioJS.engine.audio.prototype = {

	_detectFeatures: function(){

		this.features = {};

		var audio = window.Audio && new Audio();
		if(audio && audio.canPlayType){
			this.features['mp3'] = (audio.canPlayType('audio/mpeg') != "");
			this.features['ogg'] = (audio.canPlayType('audio/ogg; codecs="vorbis"') != "");

			// set a flag if browser supports our audio api which is the prefered one
			this.features['html5'] = this.features['mp3'] || this.features['ogg'];

		}


		// TODO: This needs to be detected somehow.
		this.features['embed'] = this.features['mid'] = this.features['midi'] = true;

/*
	    var audio = window.Audio && new Audio();
	    if (audio && audio.canPlayType) {
	        c.canPlayMp3 = audio.canPlayType('audio/mpeg') != "";
	        c.canPlayOgg = audio.canPlayType('audio/ogg; codecs="vorbis"') != "";
		    c.canPlay = c.canPlayMp3 || c.canPlayOgg;
	        c.channels = 4;
	        c.volumeControl = true;
	        c.canPlayAnytime = true;

			// not the best solution and hacky, but limited channel
	        if (navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)) {
	            c.channels = 1;
		        c.volumeControl = false;
		        c.canPlayAnytime = false;
	        }
		    if (c.canPlay) {
			    c.preferedType = c.canPlayOgg ? "ogg" : "mp3";
		    }
	    }
*/

	},

	/**
	 * This function initializes the stream instance or multiple instances.
	 * @param {Array|Object} settings
	 * @todo Allow multiple settings for checking on being an array - and then walking through it (otherwise settings = [settings])
	 */
	init: function(settings){

		if(!this.streams){
			this.streams = [];
		}

		if(!settings.length){
			settings = [ settings ];
		}

		for(var s=0; s<settings.length; s++){
			var set = settings[s],
				stream = {};

			// find playable media type in given resources
			if(set.resources && set.resources.length){
				for(var r=0; r<set.resources.length; r++){
					var ext = set.resources[r].split('.');
						ext = ext[ext.length - 1];

					if(ext && this.features[ext] === true){
						stream.type = ext;
						stream.resource = set.resources[r];
					}

					// hacky... but these are the prefered formats
					if(stream.resource && stream.type == ('mp3' || 'ogg')){
						break;
					}
				}
			}else{
				// stream has no playable media type, so flag it to false
				stream = false;
				continue; // go to next stream settings
			}

			if(stream && stream.type){
				switch(stream.type){
					case "mid": case "midi":
						set.type = 'embed';
					break;
					case "mp3": case "ogg":
						set.type = 'html5';
					break;
					default: // default will try to use a browser plugin!
						set.type = 'embed';
					break;
				}

				if(set.type == 'html5' && this.features[set.type] === true){

					// cache the type for later usage
					stream.type = set.type;

					stream.context = document.createElement('audio');
					stream.context.id = 'ingenioJS-audio-'+(this.streams.length + 1);
					stream.context.src = stream.resource;
					stream.context.setAttribute('class', 'audio-stream');

					// DEBUGGING
					// stream.context.setAttribute('controls', 'true');

					if(set.autoplay){
						stream.context.setAttribute('autoplay', 'true');
					}

					// append the audio stream now
					document.getElementsByTagName('body')[0].appendChild(stream.context);

				}else if(set.type == 'embed' && this.features[set.type] === true){

					stream.context = document.createElement('embed');
					stream.context.id = 'ingenioJS-audio-'+(this.streams.length + 1);
					stream.context.src = stream.resource;
					stream.context.setAttribute('class', 'audio-stream');

					var mime = false;

					// set the corresponding mime-type
					switch(stream.type){
						case "mid":
						case "midi":
							mime = 'audio/midi';
						break;
					}

					stream.context.setAttribute('type', (mime ? mime : 'audio/*' ));

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
				if(typeof set.jumpmarks == 'object'){
					stream.jumpmarks = set.jumpmarks;
				}

				// cache the type for later usage
				stream.type = set.type;

				// attach the per-stream functionality
				stream.play = this.play;
				stream.stop = this.stop;
				stream.start = this.resume;
				stream.pause = this.pause;
				stream.resume = this.resume;

				this.streams.push(stream);

			}

		}

	},

	/**
	 * This function plays a jump mark and is called directly on a stream.
	 * It will move the current position of the played audio to a given jumpmark or to 0, also depending on the loop argument
	 * @param {String} [mark] The jumpmark which was previously set while creating the engine.audio instance
	 * @param {Boolean} [loop] Repeats the stream until loop is turned off or stop() was called.
	 */
	play: function(){

		var mark = false,
			loop = false;
		if(arguments[0] !== undefined){
			mark = arguments[0];
		}
		if(arguments[1] !== undefined){
			loop = arguments[1];
		}

		// jumpmarks are only available for single-stream usage
		if(mark && this.jumpmarks && this.jumpmarks[mark]){
			if(this.context){
				var jumpTo = this.jumpmarks[mark].start,
					tmp = [];

				// 1:20:10 -> 80.10
				if(jumpTo.match(/:/)){
					tmp = jumpTo.split(':');
					jumpTo = parseInt(0,10); // integer required!

					tmp[0] = parseInt(tmp[0],10) * 60; // minutes
					tmp[1] = parseInt(tmp[1],10); // seconds
					tmp[2] = parseInt(tmp[2],10) / 60; // milliseconds (-> format: s.ms)

					jumpTo += tmp[0] + tmp[1] + tmp[2];
				}

				if(this.type == 'html5'){
					if(!this._playing){
						this._playing = this.context.play();
					}

					this.context.currentTime = Math.round(jumpTo);
				}
			}
		}else if(typeof mark == 'number'){
			if(this.context){
				if(this.type == 'html5'){
					if(!this._playing){
						this._playing = this.context.play();
					}

					this.context.currentTime = mark;
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
			this._playing = false;
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
			// only set play position in spritemap if we got a last pointer (set by pause())

console.log(this.lastPointer);

			if(this.lastPointer !== undefined){
				this.play(this.lastPointer);
				this.lastPointer = undefined;
			}else{
				this.context.play();
			}

console.log('resume!!!', this.lastPointer);

		}else if(this.type == 'embed'){
			// TODO: Find out how "most" of the plugin APIs work
		}

	}

};
