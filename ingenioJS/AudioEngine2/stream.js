/*
 * @constructor This will create a stream instance for a given settings object.
 * @returns {Object} The created stream instance that contains the context, a spritemap and attached playback methods.
 */
ingenioJS.audio.stream = function( resource, settings, features ) {

	// set an id to trace channel origins
	this.id = settings.id;

	// html5 sound api
	if (features['html5audio']) {

		this.context = new Audio();

	// flash sound api
	} else if (features['flashaudio'] && ingenioJS.audio.flashstream) {

		return new ingenioJS.audio.flashstream(resource, settings, features);

	} else {

		throw "No sound API is available on this device / browser combination.";

	}

	this.context.src = resource;

	// old WebKit
	this.context.autobuffer = true;

	// new WebKit
	this.context.preload = true; // or "auto"

	// cache the spritemap
	if (typeof settings.spritemap == 'object') {
		this.spritemap = settings.spritemap;
	}

	if (features && features.channels > 1) {

		if (settings.autoplay === true) {
			this.context.autoplay = true;
		} else if (this.spritemap[settings.autoplay]) {
			this.play( settings.autoplay );
		}

	} else if (features && features.channels === 1 && this.spritemap[settings.autoplay]) {
		// only support autoplay as a spritemap entry for iOS devices
		this.__background = this.spritemap[settings.autoplay];
	}

	return this;

};

ingenioJS.audio.stream.prototype = {

	/**
	 * This function plays a stream. It accepts either a spritemap entry's name or a direct seconds-based position value in the stream.
	 * @param {Number|String} to The spritemap entry or the position value in seconds
	 */
	play: function( to ) {

		// create a queue entry if stream is busy
		if (this.__queue && this._playing) {

			this.__queue.push({
				to: to,
				origin: this.id
			});

			return;

		// set the position when the background started to let it continue later on
		} else if (!this._playing && this.__background) {
			if (!this.__background.started) {
				this.__background.started = (new Date()).getTime();
			}
		}

		var position = undefined;

		// play via spritemap position
		if (this.spritemap && this.spritemap[to]) {

			position = this.spritemap[to].start;

			// 1:20:10 -> 80.10
			if (typeof position == 'string' && position.match(/:/)) {

				var tmp = position.split(':');
				position = parseInt(0, 10); // integer required!

				tmp[0] = parseInt(tmp[0], 10) * 60; // minutes
				tmp[1] = parseInt(tmp[1], 10); // seconds
				tmp[2] = parseInt(tmp[2], 10) / 60; // milliseconds (-> format: s.ms)

				position += tmp[0] + tmp[1] + tmp[2];

			}

		// play via position number
		} else if (typeof to == 'number') {

			position = to;

			// find matching spritemap entry
			for (var s in this.spritemap) {
				if (position >= this.spritemap[s].start && position <= this.spritemap[s].end) {
					to = s;
					break;
				}
			}

		}

		// return if we didn't find matching spritemap entry
		if (position === undefined || !to) {
			return false;
		}

		// cache the spritemap entry's details for soundloop's access
		this._playing = this.spritemap[to];

		// start playback or initialize playback
		// the stream will be corrected within the soundloop due to codec delay on mobiles
		this.context.play();

		// locking the stream due to slow reaction on mobile devices
		this.setCurrentTime(position);

	},

	/**
	 * This function stops the playback of a stream.
	 * It will reset the current position of the played audio stream to 0.
	 */
	stop: function() {

		this.__lastPointer = 0; // reset pointer
		this._playing = undefined;
		this.isLocked = false;

		// was the background music already?
		if (this.__background && this.__background.started) {
			this.__backgroundHackForiOS();
		} else {
			this.context.pause();
		}

	},

	__backgroundHackForiOS: function( reset ) {

		if (reset) {
			this.context.currentTime = this._background.start;
		} else {
			this.__background.__lastPointer = ( ( (new Date()).getTime() - this.__background.started ) / 1000 ) % ( this.__background.end - this.__background.start ) + this.__background.start;
			this.context.currentTime = this.__background.__lastPointer;
		}

	},

	/**
	 * This function pauses the playback of a stream.
	 * It will save the current position of the played audio stream. This saved position is used by resume()
	 */
	pause: function() {

		this.__lastPointer = this.context.currentTime;
		this.context.pause();

	},

	/**
	 * This function resumes the playback of a stream using the last saved position of the audio stream.
	 * Depending on its value, the playback starts on its position in the stream.
	 */
	resume: function() {

		// only set play position in spritemap if we got the last pointer (set by pause())
		if (this.__lastPointer !== undefined) {
			this.play(this.__lastPointer);
			this.__lastPointer = undefined;
		} else {
			this.context.play();
		}

	},

	setVolume: function( value ) {

		value = parseFloat(value);
		if (value) {
			this.context.volume = value;
		}

	},

	getCurrentTime: function() {
		return this.context.currentTime;
	},

	setCurrentTime: function( value ) {

		try {
			this.context.currentTime = value;
			this.isLocked = true;
		} catch(e) {
			this.isLocked = false;
		}

	}

};
