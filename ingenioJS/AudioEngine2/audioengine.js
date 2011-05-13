/**
 * @constructor Audio Engine (allows playback and controls of music/sound spritemaps using html5 audio api)
 * @param {Array|Object} settings The settings array (for multiple streams) or the settings object for a single stream
 * @returns {Array|Object} multiple streams will return an array, single stream will return the stream.
 */
ingenioJS.audio = function(settings, callback){

	// settings should be an Array
	if (!settings.length) {
		settings = [ settings ];
	}

	if(settings.length){
		this.__settings = [];
		// overwrite defaults
		for(var i=0; i<settings.length; i++){
			if(!this.__settings[i]){
				this.__settings[i] = {};
			}

			for(var d in settings[i]){
				if(settings[i].hasOwnProperty(d)){
					this.__settings[i][d] = settings[i][d];
				}
			}
		}
	}

	// detect the supported features
	if (!this.features) {
		this.__detectFeatures();
	}

	// queue mode only available if browser supports multiple streams
	if (this.features['channels'] > 1) {
		this.__queue = [];
	} else {
		this.__queue = false;
	}

	// cached streams, will be used externally for playback
	this.streams = [];

	// initialize the audio
	this.init();

	// callback function
	callback && callback(this);

	return this.streams;

};

ingenioJS.audio.prototype = {

	/*
	 * This function detects the supported codecs and features. There are a bunch of different codec formats that can be played or detected.
	 * The html5 audio api theoretically works when there is an Audio element and canPlayType() method on it - but could still be unusable due to missing codec implementations.
	 */
	__detectFeatures: function(){

		// reset detected features and codecs
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
				{ e: 'mp4', m: [ 'audio/mp4', 'video/mp4' ] },
				{ e: 'ogg', m: [ 'application/ogg', 'audio/ogg', 'audio/ogg; codecs="theora, vorbis"', 'video/ogg', 'video/ogg; codecs="theora, vorbis"' ] },
				{ e: 'wav', m: [ 'audio/wave', 'audio/wav', 'audio/wav; codecs="1"', 'audio/x-wav', 'audio/x-pn-wav' ] },
				{ e: 'webm', m: [ 'audio/webm', 'video/webm' ] }
			];

			var mime = undefined,
				extension = undefined;

			for (var m = 0, l = mimeList.length; m < l; m++) {

				extension = mimeList[m].e;

				if (mimeList[m].m.length && typeof mimeList[m].m == 'object') {

					// walk through mime array
					for (var mm = 0, mml = mimeList[m].m.length; mm < mml; mm++){

						mime = mimeList[m].m[mm];

						if (audio.canPlayType(mime) != "") {
							this.codecs[extension] = mime;
							break; // we found a supported codec for extension, so skip redundant checks

						// we have to flag that this extension is not supported for the Flash Fallback
						} else if(!this.codecs[extension]) {
							this.codecs[extension] = false;
						}

					}

				}else{

					mime = mimeList[m].m;

					if (audio.canPlayType(mime) != "") {
						this.codecs[extension] = mime;
					}

				}

				// prevent iteration mistakes
				mime = undefined;
				extension = undefined;

			}

			// browser supports html5 audio api theoretically, but depends on codec implementations
			this.features['html5audio'] = !!( this.codecs['mp3'] || this.codecs['ogg'] || this.codecs['webm'] || this.codecs['wav'] );

			// default amount is 8 channels, tested and worked on all browsers. The more channels the laggier it gets =/
			this.features['channels'] = 8;

			// check if the browser supports the volume property
			audio.volume = 0.1;
			this.features['volume'] = !!audio.volume.toString().match(/^0\.1/);

			// hacky, but there's no method to detect that these things are just crappy implementations =/
			if (navigator.userAgent.match(/MSIE 9.0/) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)) {
				this.features['channels'] = 1;
			}

		}

		// Awesome! Nearly all Android devices support Flash! Stunning!
		this.features['flashaudio'] = !!navigator.mimeTypes['application/x-shockwave-flash'];

		if (this.features['flashaudio']) {

			// Overwrite these features only if there's no html5audio available
			if (!this.features['html5audio']) {

				// These are known to work for every Flash implementation
				this.codecs['mp3'] = 'audio/mp3';
				this.codecs['mpga'] = 'audio/mpeg';
				this.codecs['mp4'] = 'audio/mp4';
				this.codecs['m4a'] = 'audio/mp4';

				// Funnily, the Flash Runtime on Android also supports GSM codecs (e.g. 3gp or amr) ... but they are impossible to detect
				// this.codecs['3pg'] = this.codecs['3gp'] || 'audio/3gpp';
				// this.codecs['amr'] = this.codecs['amr'] || 'audio/amr';

				this.features['volume'] = true;
				this.features['channels'] = 1;
			}

		}

	},

	__initLoop: function(){

		this.__loopDelay = 100;

		// fastest path. Walk only inside here if there are initialized streams

		var length = this.streams.length;

		if (length) {

			// automatically create additional channels
			if (length < this.features.channels) {

				// this loop will create dynamically channels depending on the original streams.
				// given that 8 channels are supported:
				// 1 stream -> 7 channels of streams[0]
				// 2 streams -> 3 channels of streams[0], 3 channels of streams[0]
				// 3 streams -> 2 channels of streams[0], 2 channels of streams[1] and 1 channel of streams[2]

				while (this.streams.length < this.features.channels) {

					for (var s = 0; s < length; s++) {

						// Don't remove this. Could be the case that you have 5 origin channels and the maximum is 8
						if (this.streams.length < this.features.channels) {

							var origin = this.streams[s],
								channel = new ingenioJS.audio.stream( origin.context.src, {
									id: origin.id,
									spritemap: origin.spritemap
								}, this.features);

							// set flags for later usage
							channel.isChannel = true;
							channel.origin = origin.id;

							this.streams.push(channel);

						}

					}

				}

			}

			// Only initialize the loop if we have streams ^_^
			var self = this;
			self.__loopId = window.setInterval(function(){
				self.__loop.apply(self);
			}, self.__loopDelay);

		}

	},

	/*
	 * The html5 audio api gives no feedback due to slow asynchronous implementations.
	 * This soundloop is mostly used for correcting streams and looping them, but it also manages
	 * the single-stream-mode (iOS / IE9) and starts the background music again if there's nothing else to do.
	 */
	__loop: function(){

		// walk through all streams and correct them if necessary
		for (var s = 0, l = this.streams.length; s < l; s++) {

			var stream = this.streams[s],
				currentTime = stream.getCurrentTime() || 0;

			// hacky, but it's like that. and it's faster, dunno =/
			if (this.__queue) {
				stream.__queue = this.__queue;
			}

			// stream corrections
			if (stream._playing) {

				// stream seems to have finished playback
				if (currentTime >= stream._playing.end) {

					// restart stream
					if (stream._playing.loop === true) {

						var newPointer = stream._playing.start;
						stream.stop();
						stream.play(newPointer);

					// stop stream
					} else {
						stream.stop();
					}

				// start stream again, try & error due to dom exceptions for currentTime setter access
				} else if (!stream.isLocked && currentTime < stream._playing.start) {

					console.log('stream correction for ', stream.id + '('+s+')', stream.context.currentTime);

					stream.setCurrentTime(stream._playing.start);

				}

			// use a free channel to play next queue item if there's a queue
			// Hint: There's no queue when browser doesn't support multiple streams (iOS / IE9)
			} else if (this.__queue && this.__queue.length) {

				// find a matching channel for the queue entry
				if (!stream._playing && stream.isChannel && stream.origin == this.__queue[0].origin) {

					var to = this.__queue[0].to,
						loop = this.__queue[0].loop;

					// clean first queue entry to prevent double-actions withing play()
					this.__queue.splice(0, 1);

					stream.play(to, loop);

				}

			// we got a sucking audio api running on iOS or IE9 =D
			} else if (stream._background) {
				if (currentTime >= stream._background.end) {
					stream.__backgroundHackForiOS(true);
				}
			}
		}

	},

	/**
	 * This function initializes the stream instances. Can be called externally to pass through different settings
	 * @param {Array|Object} [settings] The per-stream settings
	 */
	init: function(settings) {

		if (!settings) {
			settings = this.__settings;
		} else if (!settings.length) {
			settings = [ settings ];
		}


		for (var s = 0, l = settings.length; s < l; s++) {

			var setting = settings[s],
				resource = undefined,
				stream = undefined;

			// find playable media type in given resources
			if (setting.resources && setting.resources.length) {

				for (var r = 0, rl = setting.resources.length; r < rl; r++) {

					// grab the extension of the resource url
					var extension = setting.resources[r].match(/\.([^\.]*)$/)[1];

					if (extension && !!this.codecs[extension]) {
						resource = setting.resources[r];
						break; // first resource is preferred one
					}

				}

			// stream has no resources, so we could do pretty nothing with it =/
			} else {
				continue;
			}

			if (resource && (this.features['html5audio'] || this.features['flashaudio'])) {

				// id required currently only for external plugin apis (which is my awesome Flash file =D)
				setting.id = 'z-sound-channels-' + s;

				// link features to let stream know if a _background has to be set
				stream = new ingenioJS.audio.stream( resource, setting, this.features );

				// streams have a link to the queue to influence soundloop behaviour
				stream.__queue = this.__queue;

				this.streams.push( stream );

			}

		}

		if (!this.features['html5audio'] && !this.features['flashaudio']) {
			throw "No sound API is available on this device / browser combination.";
		}

		// initialize loop now, because streams should be ready.
		if (!this.__loopId) {
			this.__initLoop();			
		}

	}

};
