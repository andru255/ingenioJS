package
{
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.ProgressEvent;
	import flash.events.TimerEvent;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.media.SoundLoaderContext;
	import flash.media.SoundTransform;
	import flash.net.URLRequest;
	import flash.utils.Timer;
	
	public class AudioElement {

		private var _sound:Sound;
		private var _soundTransform:SoundTransform;
		private var _soundChannel:SoundChannel;
		private var _soundLoaderContext:SoundLoaderContext;
		
		private var _volume:Number = 1;
		private var _preMuteVolume:Number = 0;
		private var _isMuted:Boolean = false;
		private var _isPaused:Boolean = true;
		private var _isEnded:Boolean = false;
		private var _isLoaded:Boolean = false;
		private var _currentTime:Number = 0;
		private var _duration:Number = 0;
		private var _bufferedTime:Number = 0;

		private var _currentUrl:String = "";
		private var _autoplay:Boolean = true;
		
		private var _firedCanPlay:Boolean = false;


		public function AudioElement(autoplay:Boolean) {
			
			_autoplay = autoplay;
			
			_soundTransform = new SoundTransform();
			_soundLoaderContext = new SoundLoaderContext();
			
		}


		public function load():void {

			if (_currentUrl == "")
				return;

			_sound = new Sound();
			_sound.load(new URLRequest(_currentUrl));
			_currentTime = 0;
			
			_firedCanPlay = false;
			_isLoaded = true;
			
			if (!_firedCanPlay) {
				_firedCanPlay = true;
			}
			
			if (_playAfterLoading) {
				_playAfterLoading = false;
				play();
			}
		}
		
		public function unload():void {
			_sound = null;
			_isLoaded = false;
		}
		
		
		
		// PRIVATE METHODS
		private function soundCompleteHandler(e:Event):void {
			_currentTime = 0;
			_isEnded = true;
		}
		
		private function didStartPlaying():void {
			_isPaused = false;
			if (!_firedCanPlay) {
				_firedCanPlay = true;
			}
		}
		
		
		// PUBLIC METHODS
		public function setSrc(url:String):void {
			_currentUrl = url;
			_isLoaded = false;
		}
		
		private var _playAfterLoading:Boolean= false;
		
		public function play():void {
			
			// initial playback
			if (!_isLoaded) {
				_playAfterLoading = true;
				load();
				return;
			}
			
			_soundChannel = _sound.play(_currentTime, 0, _soundTransform);
			_soundChannel.removeEventListener(Event.SOUND_COMPLETE, soundCompleteHandler);
			_soundChannel.addEventListener(Event.SOUND_COMPLETE, soundCompleteHandler);
			
			didStartPlaying();
		}
		
		public function pause():void {
			if (_soundChannel != null) {
				_currentTime = _soundChannel.position;
				_soundChannel.stop();
			}
			
			_isPaused = true;
		}
		
		
		public function stop():void {
			if (_soundChannel != null) {
				_soundChannel.stop();
				_sound.close();
			}
			unload();
		}
		
		public function getCurrentTime():Number {
			if (_soundChannel != null) {
				_currentTime = _soundChannel.position/1000;
			} else {
				// pretty hacky, but ActionScript sucks hard.
				_currentTime = 0;
			}
			return _currentTime;
		}
		
		public function setCurrentTime(pos:Number):void {
			_currentTime = pos;
			_soundChannel.stop();
			_sound.length
			_soundChannel = _sound.play(_currentTime * 1000, 0, _soundTransform);
			
			didStartPlaying();
		}
		
		public function getDuration():Number {
			return _duration;
		}
		
		public function setVolume(volume:Number):void {
			_volume = volume;
			_soundTransform.volume = volume;
			
			if (_soundChannel != null) {
				_soundChannel.soundTransform = _soundTransform;
			}
		}
		
		public function setMuted(muted:Boolean):void {
			
			// ignore if already set
			if ( (muted && _isMuted) || (!muted && !_isMuted))
				return;
			
			if (muted) {
				_preMuteVolume = _soundTransform.volume;
				setVolume(0);
			} else {
				setVolume(_preMuteVolume);
			}
			
			_isMuted = muted;
		}
		
	}
	
}
