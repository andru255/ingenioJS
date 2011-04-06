
/**
 * @constructor Engine / Audio Controller (allows playback and controls of audio and music)
 * @param {Object} controller The owning controller instance
 * @returns {Object} controller plugin instance
 * @todo Improve audio engine with multi-channel and multi-stream functionalities; Improve also a flash-using fallback
 */
ingenioJS.engine.audio = function(settings, callback){

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

	_createChannel: function(stream){

		var newStream = {
			context: stream.context.cloneNode(true),
			type: stream.type,
			jumpmarks: stream.jumpmarks
		};

		// set flag that this is just a clone =)
		newStream.isChannel = true;

		// attach the per-stream functionality
		newStream.play = this.play;
		newStream.stop = this.stop;
		newStream.pause = this.pause;
		newStream.resume = this.resume;

		// streams have a link to the queue to influence _loop() behaviour
		newStream._queue = this._queue;

		return newStream;
	},

	_detectFeatures: function(){

		this.features = {};

		var audio = window.Audio && new Audio();
		if(audio && audio.canPlayType){

			// this is the list we will walk through to check codec support
			var mimeList = [
				// e = extension, m = mime type
				{ e: '3gp', m: 'audio/3gpp' },
				// { e: 'avi', m: 'video/x-msvideo' }, // avi container allows pretty everything, impossible to detect -.-
				{ e: 'aac', m: [ 'audio/aac', 'audio/aacp' ] },
				{ e: 'amr', m: 'audio/amr' },
				{ e: 'm4a', m: [ 'audio/mp4', 'audio/mpeg4', 'audio/mp4a-latm' ] },
				{ e: 'mp3', m: [ 'audio/mp3', 'audio/mpeg' ] }, // mpeg was name for mp2 and mp3! avi container was mp4/m4a
				{ e: 'mpga', m: [ 'audio/mpeg', 'video/mpeg' ] },
				{ e: 'mp4', m: 'video/mp4' },
				{ e: 'ogg', m: [ 'application/ogg', 'audio/ogg', 'audio/ogg; codecs="theora, vorbis"', 'video/ogg', 'video/ogg; codecs="theora, vorbis"' ] },
				{ e: 'wav', m: [ 'audio/wave', 'audio/wav', 'audio/x-wav', 'audio/x-pn-wav' ] },
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
							this.features[extension] = true;
							break; // we found a supported codec for extension, so skip redundant checks
						}
					}
				}else{
					mime = mimeList[m].m;

					if(audio.canPlayType(mime) != ""){
						this.features[extension] = true;
					}
				}

				// prevent iteration mistakes
				mime = undefined;
				extension = undefined;
			}

			// set a flag if browser supports our audio api which is the prefered one
			this.features['html5'] = this.features['aac'] || this.features['mp3'] || this.features['ogg'] || this.features['webm'] || false;

			// detect via audio api extension, default is 4
/*
			var self = this;
			audio.addEventListener('loadedmetadata', function(){
				// we can only detect the channels amount if we already loaded (and played) a stream.
				// Dude, this crappy api sucks so hard =/
				self.features['channels'] = (this.channels || this.mozChannels || this.webkitChannels) || 8;
			}, true);
*/

			// no on-demand detection using audio api extension conceptionated by Mozilla. see above.
			this.features['channels'] = 8;

			// check if the browser supports the volume property
			audio.volume=0.1;
			this.features['volume'] = !!audio.volume.toString().match(/^0\.1/);

			// hacky, but there's no method to detect that =/
			if(navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/MSIE 9.0/) || navigator.userAgent.match(/iPod/i) || navigator.userAgent.match(/iPad/i)){
				this.features['channels'] = 1;
			}

		}

		// TODO: This needs to be detected somehow.
		// this.features['embed'] = this.features['mid'] = this.features['midi'] = true;

	},

	_initLoop: function(){

		this._initialized = true;
		this._loopDelay = 100;

		if(this.streams.length){

			// automatically create streams for missing channels
			var missingChannels = (this.features.channels - this.streams.length);
			if(this.streams.length < missingChannels){
				for(var i=0; i<missingChannels; i++){
					this.streams.push(this._createChannel(this.streams[0]));
				}
			}

			// TODO: find a dynamic way or set a flag if an html5 stream exists
			if(this.streams[0].type == 'html5'){
				// only html5 audio api requires sound loop and correction.
				// required due to slow cpu and audio api implementations
				var self = this;
				self._loopId = window.setInterval(function(){
					self._loop.apply(self);
				}, self._loopDelay);
			}
		}

	},

	_loop: function(){

		var stream = undefined;

		// walk through playing streams and stop or restart them if they are looped.
		for(var s=0; s<this.streams.length; s++){

			stream = this.streams[s];

			// hacky, but it's like that.
			stream._queue = this._queue;

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

				stream.locked = false;

				// start stream, try & error due to dom exceptions for currentTime access
				}else if(!stream.locked && stream.context.currentTime < stream._playing.start){
					console.log('updating the currentTime now and locking stream');

					try{
						stream.context.currentTime = stream._playing.start;
						stream.locked = true;
					}catch(e){
						stream.locked = false;
					}

					// TODO: This is required for iOS due to heavily slow implementation.
					// Needs a fix or a different solution. above should check if !stream.locked

/*					try{
						this.streams[s].context.currentTime = stream._playing.start;
						this.streams[s].locked = true;
					}catch(e){
						this.streams[s].tries = this.streams[s].tries ? (this.streams[s].tries+1) : 1;
						console.log(this.streams[s].tries); // randomly between 1000ms and 2500ms (only iOS!) are required for initializing the playback readiness
					}
*/
				}

			// use a free channel to play the file
			}else if(!stream._playing && stream.isChannel && this._queue.length){

				var mark = this._queue[0].mark,
					loop = this._queue[0].loop;

				// clean first queue entry
				this._queue = this._queue.splice(1);

				stream.play(mark, loop);

			}

		}

	},

	/**
	 * This function initializes the stream instance or multiple instances.
	 * @param {Array|Object} settings
	 * @todo Allow multiple settings for checking on being an array - and then walking through it (otherwise settings = [settings])
	 */
	init: function(settings){

		if(!this.streams){
			this.streams = [];
			this._queue = [];
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
						stream.resource = set.resources[r];
						break;
					}
				}

			// stream has no playable media type
			}else{
				continue; // go to next stream settings
			}

			if(stream && stream.resource){

				if(this.features['html5'] === true){

					// cache the type for later usage
					stream.type = 'html5';

					stream.context = new Audio();
					stream.context.id = 'ingenioJS-audio-'+(this.streams.length + 1);
					stream.context.src = stream.resource;

					// old WebKit
					stream.context.autobuffer = true;
					// new WebKit
					stream.context.preload = true;

					if(set.autoplay){
						stream.context.autoplay = true;
					}

					stream.context.preload = 'auto';

					// DEBUGGING
					// stream.context.setAttribute('controls', 'true');

					// append the audio stream now
					document.getElementsByTagName('body')[0].appendChild(stream.context);

				}else if(this.features['embed'] === true){

					stream.context = document.createElement('embed');
					stream.context.id = 'ingenioJS-audio-'+(this.streams.length + 1);
					stream.context.src = stream.resource;
					stream.context.setAttribute('class', 'audio-stream');
//					stream.context.setAttribute('type', stream.type );
//					TODO: lookup mime type
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

				// attach the per-stream functionality
				stream.play = this.play;
				stream.stop = this.stop;
				stream.pause = this.pause;
				stream.resume = this.resume;

				// streams have a link to the queue to influence _loop() behaviour
				stream._queue = this._queue;

				this.streams.push(stream);

			}

		}

		if(!this._initialized){
			this._initLoop();			
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

		// create a queue entry
		if(this._playing){
			var queueEntry = { mark: mark, loop: loop, stream: this };
			this._queue.push(queueEntry);
			return;
		}

		// jumpmarks are only available for single-stream usage
		if(mark && this.jumpmarks && this.jumpmarks[mark]){
			var jumpTo = this.jumpmarks[mark].start,
				tmp = [];

			// 1:20:10 -> 80.10
			if(typeof jumpTo == 'string' && jumpTo.match(/:/)){
				tmp = jumpTo.split(':');
				jumpTo = parseInt(0,10); // integer required!

				tmp[0] = parseInt(tmp[0],10) * 60; // minutes
				tmp[1] = parseInt(tmp[1],10); // seconds
				tmp[2] = parseInt(tmp[2],10) / 60; // milliseconds (-> format: s.ms)

				jumpTo += tmp[0] + tmp[1] + tmp[2];
			}

			if(this.context && this.type == 'html5'){
				if(!this._playing){
					this.context.play();

					// cache the jumpmark's details for quick access
					this._playing = this.jumpmarks[mark];

					try{
						this.context.currentTime = jumpTo;
						this.locked = true;
					}catch(e){
						this.locked = false;
					}

				}
			}
		}else if(typeof mark == 'number'){
			if(this.context && this.type == 'html5'){
				if(!this._playing){
					this.context.play();

					// find the right jumpmark
					for(var jm in this.jumpmarks){
						if(mark >= this.jumpmarks[jm].start && mark <= this.jumpmarks[jm].end){
							this._playing = this.jumpmarks[jm];
							break;
						}
					}

					try{
						this.context.currentTime = mark;
						this.locked = true;
					}catch(e){
						this.locked = false;
					}
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
			this._playing = undefined;
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
			if(this.lastPointer !== undefined){
				this.play(this.lastPointer);
				this.lastPointer = undefined;
			}else{
				this.context.play();
			}

		}else if(this.type == 'embed'){
			// TODO: Find out how "most" of the plugin APIs work
		}

	}

};
