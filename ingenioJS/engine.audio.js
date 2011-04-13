
/**
 * @constructor Engine / Audio Controller (allows playback and controls of music/sound spritemaps using html5 audio api)
 * @param {Array|Object} settings The settings array (for multiple streams) or the settings object for a single stream
 * @returns {Array|Object} multiple streams will return an array, single stream will return the stream.
 */
ingenioJS.engine.audio = function(settings, callback){

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

	// callback function
	callback && callback(this);

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
		this.codecs = {};

		var audio = window.Audio && new Audio();
		if(audio && audio.canPlayType){

			// this is the list we will walk through to check codec support
			var mimeList = [
				// e = extension, m = mime type
				{ e: '3gp', m: 'audio/3gpp' },
				// { e: 'avi', m: 'video/x-msvideo' }, // avi container allows pretty everything, impossible to detect -.-
				{ e: 'aac', m: [ 'audio/aac', 'audio/aacp' ] },
				{ e: 'amr', m: 'audio/amr' },
				{ e: 'm4a', m: [ 'audio/mp4', 'audio/mp4; codecs="mp4a.40.2"', 'audio/mpeg4', 'audio/mpeg4-generic', 'audio/mp4a-latm', 'audio/MP4A-LATM', 'audio/x-m4a' ] },
				{ e: 'mp3', m: [ 'audio/mp3', 'audio/mpeg', 'audio/mpeg; codecs="mp3"', 'audio/MPA', 'audio/mpa-robust' ] }, // mpeg was name for mp2 and mp3! avi container was mp4/m4a
				{ e: 'mpga', m: [ 'audio/MPA', 'audio/mpa-robust', 'audio/mpeg', 'video/mpeg' ] },
				{ e: 'mp4', m: 'video/mp4' },
				{ e: 'ogg', m: [ 'application/ogg', 'audio/ogg', 'audio/ogg; codecs="theora, vorbis"', 'video/ogg', 'video/ogg; codecs="theora, vorbis"' ] },
				{ e: 'wav', m: [ 'audio/wave', 'audio/wav', 'audio/wav; codecs="1"', 'audio/x-wav', 'audio/x-pn-wav' ] },
				{ e: 'webm', m: [ 'audio/webm', 'video/webm' ] }
			];

			var mime = undefined,
				extension = undefined;
			for(var m=0; m<mimeList.length; m++){
				extension = mimeList[m].e;

				if(mimeList[m].m.length && typeof mimeList[m].m == 'object'){
					// walk through array
					for(var mm=0; mm<mimeList[m].m.length; mm++){
						mime = mimeList[m].m[mm];

						if(audio.canPlayType(mime) != ""){
							this.codecs[extension] = mime;
							break; // we found a supported codec for extension, so skip redundant checks
						}
					}
				}else{
					mime = mimeList[m].m;

					if(audio.canPlayType(mime) != ""){
						this.codecs[extension] = mime;
					}
				}

				// prevent iteration mistakes
				mime = undefined;
				extension = undefined;
			}

			// browser supports html5 audio api theoretically, but depends on codec implementations
			this.features['html5audio'] = true;

			// default amount is 8 channels, tested and worked on all browsers. The more channels the laggier it gets =/
			this.features['channels'] = 8;

			// check if the browser supports the volume property
			audio.volume=0.1;
			this.features['volume'] = !!audio.volume.toString().match(/^0\.1/);

			// hacky, but there's no method to detect that these things are just crappy implementations =/
			if(navigator.userAgent.match(/MSIE 9.0/) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)){
				this.features['channels'] = 1;
			}

		}

	},

	_initLoop: function(){

		this._loopDelay = 100;

		if(this.streams.length){

			// automatically create additional channels
			var originStreams = this.streams.length;

			if(this.streams.length < this.features.channels){

				while(this.streams.length < this.features.channels){
					for(var s=0; s<originStreams; s++){

						if(this.streams.length < this.features.channels){
							var origin = this.streams[s];
							var channel = new ingenioJS.engine.stream(origin.context.src, {
								spritemap: origin.spritemap
							});

							// set flags for later usage
							channel.isChannel = true;
							channel.origin = s;

							this.streams.push(channel);
						}

					}
				}

			}

			// html5 audio api requires sound loop and corrections due to slow (no-feedback-giving) implementations
			var self = this;
			self._loopId = window.setInterval(function(){
				self._loop.apply(self);
			}, self._loopDelay);

		}

	},

	_loop: function(){

		var stream = undefined;

		// walk through all streams and correct them if necessary
		for(var s=0; s<this.streams.length; s++){

			stream = this.streams[s];

			// hacky, but it's like that. and it's faster, dunno =/
			if(this._queue){
				stream._queue = this._queue;
			}

			// stream corrections
			if(stream._playing){

				// stream seems to have finished playback
				if(stream.context.currentTime >= stream._playing.end){

					// restart stream
					if(stream._playing.loop === true){
						var newPointer = stream._playing.start;
						stream.stop();
						stream.play(newPointer);

					// stop stream
					}else{
						stream.stop();
					}

				// start stream again, try & error due to dom exceptions for currentTime access
				}else if(!stream.locked && stream.context.currentTime < stream._playing.start){

					try{
						stream.context.currentTime = stream._playing.start;
						stream.locked = true;
					}catch(e){
						stream.locked = false;
					}

				}

			// use a free channel to play next queue item if there's a queue
			// Hint: There's no queue when browser doesn't support multiple streams (see _detectFeatures())
			}else if(this._queue && this._queue.length){

				// find a matching channel for the queue entry
				if(!stream._playing && stream.isChannel && stream.origin == this._queue[0].origin){

					var to = this._queue[0].to,
						loop = this._queue[0].loop;

					// clean first queue entry
					this._queue = this._queue.splice(1);

					stream.play(to, loop);

				}

			// we got a sucking audio api running on iOS =D
			}else if(stream._background){
				if(stream.context.currentTime >= stream._background.end){
					stream._backgroundHackForiOS(true);
				}
			}
		}

	},

	/**
	 * This function initializes the stream instances
	 * @param {Array|Object} settings
	 */
	init: function(settings){

		if(!this.streams){
			this.streams = [];
		}

		// queue mode only available if browser supports multiple streams
		if(this.features['channels'] > 1){
			this._queue = [];
		}else{
			this._queue = false;
		}

		if(!settings.length){
			settings = [ settings ];
		}

		for(var s=0; s<settings.length; s++){

			var set = settings[s],
				resource = undefined;

			// find playable media type in given resources
			if(set.resources && set.resources.length){
				for(var r=0; r<set.resources.length; r++){
					var ext = set.resources[r].split('.');
						ext = ext[ext.length - 1];

					if(ext && !!this.codecs[ext]){
						resource = set.resources[r];
						break;
					}
				}

			// stream has no playable media type, go to next stream settings
			}else{
				continue;
			}

			if(resource && this.features['html5audio']){

				// id for tracing channel origins
				set.id = s;

				// link features to let stream know if a _background has to be set
				var stream = new ingenioJS.engine.stream(resource, set, this.features);

				// streams have a link to the queue to influence _loop() behaviour
				stream._queue = this._queue;

				this.streams.push(stream);

			}
		}


		// initialize loop now, because streams should be ready.
		if(!this._loopId){
			this._initLoop();			
		}

	}

};

/*
 * @constructor This will create a stream instance with given settings.
 * @returns {Object} The created stream instance that contains the context, a spritemap and attached playback methods.
 */
ingenioJS.engine.stream = function(resource, settings, features){

	// set an id to trace channel origins
	this.id = settings.id;

	this.context = new Audio();
	this.context.src = resource;

	// old WebKit
	this.context.autobuffer = true;
	// new WebKit
	this.context.preload = true; // or "auto"

	// cache the spritemap
	if(typeof settings.spritemap == 'object'){
		this.spritemap = settings.spritemap;
	}


	if(features && features.channels > 1){
		if(settings.autoplay === true){
			this.context.autoplay = true;
		}else if(this.spritemap[settings.autoplay]){
			this.play(settings.autoplay);
		}
	}else if(features && features.channels === 1 && this.spritemap[settings.autoplay]){
		// only support autoplay as a spritemap entry for iOS devices
		this._background = this.spritemap[settings.autoplay];
	}

	return this;

};

ingenioJS.engine.stream.prototype = {

	/**
	 * This function plays a stream. It accepts either a spritemap entry's name or a direct seconds-based position value in the stream.
	 * @param {Number|String} to The spritemap entry or the position value in seconds
	 */
	play: function(to){

		// create a queue entry if stream is busy
		if(this._queue && this._playing){

			this._queue.push({
				to: to,
				origin: this.id
			});

			return;

		}else if(!this._playing && this._background){
			if(!this._background.started){
				this._background.started = (new Date()).getTime();
			}
		}

		var position = undefined;

		// play via spritemap position
		if(to && this.spritemap && this.spritemap[to]){

			position = this.spritemap[to].start;

			// 1:20:10 -> 80.10
			if(typeof position == 'string' && position.match(/:/)){
				var tmp = position.split(':');
				position = parseInt(0,10); // integer required!

				tmp[0] = parseInt(tmp[0],10) * 60; // minutes
				tmp[1] = parseInt(tmp[1],10); // seconds
				tmp[2] = parseInt(tmp[2],10) / 60; // milliseconds (-> format: s.ms)

				position += tmp[0] + tmp[1] + tmp[2];
			}

		// play via position number
		}else if(typeof to == 'number'){

			position = to;

			// find matching spritemap entry
			for(var s in this.spritemap){
				if(position >= this.spritemap[s].start && position <= this.spritemap[s].end){
					to = s;
					break;
				}
			}

		}

		// return if we didn't find matching spritemap entry
		if(position === undefined || !to) return;

		this.context.play();

		// cache the spritemap entry's details for quicker access
		this._playing = this.spritemap[to];

		// locking the stream due to slow reaction on mobile devices
		try{
			this.context.currentTime = position;
			this.locked = true;
		}catch(e){
			this.locked = false;
		}

	},

	/**
	 * This function stops the playback of a stream.
	 * It will reset the current position of the played audio stream to 0.
	 */
	stop: function(){

		this.lastPointer = 0; // reset pointer
		this._playing = undefined;
		this.locked = false;

		// is the background started already?
		if(this._background && this._background.started){
			// this._background.lastPointer = ( (new Date()).getTime() - this._background.started ) % ( this._background.end - this._background.start ) + this._background.start;
			this._backgroundHackForiOS();
		}else{
			this.context.pause();
		}

	},

	_backgroundHackForiOS: function(reset){

		if(reset){
			this.context.currentTime = this._background.start;
		}else{
			this._background.lastPointer = ( ( (new Date()).getTime() - this._background.started ) / 1000 ) % ( this._background.end - this._background.start ) + this._background.start;
			this.context.currentTime = this._background.lastPointer;
		}

	},

	/**
	 * This function pauses the playback of a stream.
	 * It will save the current position of the played audio stream. This saved position is used by resume()
	 */
	pause: function(){

		this.lastPointer = this.context.currentTime;
		this.context.pause();

	},

	/**
	 * This function resumes the playback of a stream using the last saved position of the audio stream.
	 * Depending on its value, the playback starts on its position in the stream.
	 */
	resume: function(){

		// only set play position in spritemap if we got a last pointer (set by pause())
		if(this.lastPointer !== undefined){
			this.play(this.lastPointer);
			this.lastPointer = undefined;
		}else{
			this.context.play();
		}

	}

}
