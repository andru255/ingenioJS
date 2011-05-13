package  
{
	import flash.display.*;
	import flash.events.*;
	import flash.media.*;
	import flash.net.*;
	import flash.text.*;
	import flash.system.*;
	
	import flash.net.NetConnection;
	import flash.net.NetStream;
	
	import flash.utils.Timer;
	import flash.external.ExternalInterface;
	import flash.geom.Rectangle;
	
	import AudioElement;

	public class FlashMediaElement extends Sprite {
		
		private var _mediaUrl:String;
		private var _autoplay:Boolean;
		private var _allowedPluginDomain:String;

		// media
		private var _mediaElement:AudioElement;
		
		public function FlashMediaElement() {
			
			// allow this player to be called from different HTML URLs
			Security.allowDomain("*");
			
			// get parameters
			var params:Object = LoaderInfo(this.root.loaderInfo).parameters;
			_mediaUrl = (params['file'] != undefined) ? String(params['file']) : "";
			_autoplay = (params['autoplay'] != undefined) ? (String(params['autoplay']) == "true") : false;
			
			// create media element
			_mediaElement = new AudioElement(_autoplay);
			
			if (_mediaUrl != "") {
				_mediaElement.setSrc(_mediaUrl);
			}

			if (ExternalInterface.available) {

				try {
					if (ExternalInterface.objectID != null && ExternalInterface.objectID.toString() != "") {

						// add HTML media methods
						ExternalInterface.addCallback("playMedia", playMedia);
						ExternalInterface.addCallback("loadMedia", loadMedia);
						ExternalInterface.addCallback("pauseMedia", pauseMedia);
						ExternalInterface.addCallback("stopMedia", stopMedia);

						ExternalInterface.addCallback("setSrc", setSrc);
						ExternalInterface.addCallback("getCurrentTime", getCurrentTime);
						ExternalInterface.addCallback("setCurrentTime", setCurrentTime);
						ExternalInterface.addCallback("setVolume", setVolume);
						ExternalInterface.addCallback("setMuted", setMuted);

					}
					
				} catch (error:SecurityError) {
					throw "A SecurityError occurred: " + error.message + "\n";
				} catch (error:Error) {
					throw "An Error occurred: " + error.message + "\n";
				}

			}

			if (_autoplay) {
				_mediaElement.load();
				_mediaElement.play();
			}
			
		}
		
		function playMedia():void {
			_mediaElement.play();
		}
		
		function loadMedia():void {
			_mediaElement.load();
		}
		
		function pauseMedia():void {
			_mediaElement.pause();
		}
		
		function setSrc(url:String):void {
			_mediaElement.setSrc(url);
		}
		
		function stopMedia():void {
			_mediaElement.stop();
		}
		
		function getCurrentTime():Number {
			return _mediaElement.getCurrentTime();
		}
		
		function setCurrentTime(time:Number):void {
			_mediaElement.setCurrentTime(time);
		}
		
		function setVolume(volume:Number):void {
			_mediaElement.setVolume(volume);
		}
		
		function setMuted(muted:Boolean):void {
			_mediaElement.setMuted(muted);
		}
		
		
	}
}