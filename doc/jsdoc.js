if(!me){ var me = {}; }

me.jsdoc = function(settings){

	this.context = {
		doc: document.getElementById(settings.doc) || false,
		scopes: document.getElementById(settings.scopes) || false,
		statistics: document.getElementById(settings.statistics) || false
	};

	// setup the cache
	this.cache = {};

	// initial values for statistics
	this.statistics = {
		files: 0,
		functions: 0,

		documented: 0,
		undocumented: 0
	};

	// arrays with jumping (scope) functionality for later usage
	this.missingDocs = [];
	this.missingFiles = [];
	this.missingFunctions = [];

	return this;

};

me.jsdoc.prototype = {

	/**
	 * This internal function simply gets a file using XMLHttpRequest and returns its data
	 */
	_load: function(url){

		if(!url) return this;

		var self = this,
			callback = arguments[1] || false;

		var req=new XMLHttpRequest();
		req.open('GET',url,false);
		req.send(null);

		if(req.status == (200 || 304)){		
			var data = req.responseText || req.responseXML;
			callback && callback(data);

			return data;
		}else{
			callback && callback(false);
		}

		return false;

	},

	add: function(url){

		String.prototype.trim = function() {
			return this.replace(/^\s+|\s+$/g,"");
		};

		var self = this;
		this._load(url,function(data){
			if(data !== false){
				var lines = data.split(/\n/);
				var cache = {},
					scopeId = 1;

				// sweet statistics
				if(self.statistics){
					self.statistics.files++;
				}

				for(var i=0; i<lines.length; i++){
					var line = lines[i].trim();

					if(!cache[scopeId]){
						cache[scopeId] = [];
					}

					// documentation entry
					if(line.indexOf('*') == 0 && line.indexOf('*/') == -1){

						if(line.indexOf('@todo') != -1){
							// cleanup the statistics once they are found
							self.missingFunctions.push(line.substr(2));
						}

						cache[scopeId].push(line);

					}else if((line.indexOf('= function') != -1) || line.indexOf(': function') != -1){

						line = line.replace('{','');
						cache[scopeId].push(line);
						scopeId++; // next scope is reached

					}

				}

				var namespace = cache[1][cache[1].length - 1].split(' ')[0];

				// now rebuild the cache and order it in a new one
				for(var s in cache){
					var subCache = cache[s];

					if(subCache.length>0){
						var scopedCache = [];
						var subNamespace = subCache[subCache.length - 1];

						if(subNamespace.match(':')){
							subNamespace = '.'+subNamespace.split(': ')[0];
						}else if(subNamespace.match(' = ')){
							subNamespace = ''; // subNamespace.split(' = ')[0];
						}else{
							subNamespace = false;
						}

						// push the documentation lines to the namespace
						for(var sc=0; sc<subCache.length; sc++){
							if(subCache[sc].indexOf("*") == 0){
								scopedCache.push(subCache[sc].substr(2));
							}else{
								scopedCache.push(subCache[sc]);
							}
						}

					}

					self.cache[namespace+subNamespace] = scopedCache;

				}

			}else if(data === false){
				self.missingFiles.push(url);
			}
		});

	},


	_generateDocumentation: function(){

		var cache = this.cache,
			context = this.context.doc,
			missingFunctions = this.missingFunctions,
			html = '';

		for(var scope in cache){
			var section = cache[scope],
				func = section.slice(section.length - 1),
				docs = section.slice(0, section.length - 1),
				isTodo = false;

			// sweet statistics
			this.statistics.functions++;
			if(docs.length == 0){
				this.missingDocs.push(scope);
				this.statistics.undocumented++;
			}else{
				this.statistics.documented++;
			}

			// todo list overview
			if(missingFunctions){
				for(var m=0; m<missingFunctions.length; m++){
					var line = missingFunctions[m];

					for(var d=0; d<docs.length; d++){
						var doc=docs[d];

						// update the origin documentation line
						if(doc == line){
							isTodo = true;
							docs[d] = '<mark>'+docs[d]+'</mark>';
							break;
						}
					}
				}
			}

			// class for todo list (contains @todo)
			if(isTodo !== false){
				var className = 'todo';
			}else{
				var className = '';
			}

			// class for private/public functionality
			if(scope.match(/_/g)){
				className += ' private';
			}else{
				className += ' public';
			}

			html += "<article id=\"" +scope+ "\"";
			if(className != ''){
				html += " class=\"" +className.trim()+ "\"";
			}
			html += ">\n";
			html += "<h3>" +scope+ "</h3>\n";
			html += "<h4>" +func+ "</h4>\n";
			html += "<p>" +docs.join("<br>")+ "</p>";
			html += "</article>\n\n";

		}

		if(context){
			context.innerHTML += html;
		}else{
			throw "No valid context for documentation.";
		}


	},

	_generateScopes: function(){

		var cache = this.cache,
			context = this.context.scopes,
			html = '';

		html = '<ul>';
		for(var scope in cache){
			var article = document.getElementById(scope);
			if(article && article.className.match(/private/)){
				html += '<li><mark><a href="#' +scope+ '">' +scope+ '</a></mark></li>';
			}else{
				html += '<li><a href="#' +scope+ '">' +scope+ '</a></li>';
			}
		}
		html += '</ul>';

		if(context){
			context.innerHTML = html;
		}

	},

	_generateStatistics: function(){

		var context = this.context.statistics,
			html = '';

		if(context){
			html += '<p>Files <span class="right">' +this.statistics.files+ '</p>';
			html += '<p>JSDoc <span class="right">' +this.statistics.documented+ ' / ' +this.statistics.functions+ '</p>';

			context.innerHTML = html;
		}

		if(this.missingDocs.length !== 0){
			this._generateMissing('jsdoc');
		}

		if(this.missingFunctions.length !== 0){
			this._generateMissing('functions');
		}
	},

	_generateMissing: function(what){

		var element = document.createElement('div'),
			beforeElement = this.context.statistics.parentNode,
			context = beforeElement.parentNode,
			html = '';

		element.className = 'ui-fieldset';

		if(what == 'jsdoc'){

			html += '<h3>Missing JSDoc</h3><ul id="ui-missing-jsdoc">';
			if(this.missingDocs.length){
				for(var i=0; i<this.missingDocs.length; i++){
					var article = document.getElementById(this.missingDocs[i]);
					if(article && article.className.match(/private/)){
						html += "<li><mark><a href=\"#" +this.missingDocs[i]+ "\">" +this.missingDocs[i]+ "</a></mark></li>";
					}else{
						html += "<li><a href=\"#" +this.missingDocs[i]+ "\">" +this.missingDocs[i]+ "</a></li>";
					}
				}
			}else{
				html += '<li>No missing Documentation</li>';
			}
			html += '</ul>';

		}else if(what == 'functions'){

			var elements = document.getElementsByClassName('todo');

			html += '<h3>Missing Functions (to do)</h3><ul id="ui-missing-functions">';
			if(elements.length){
				for(var i=0; i<elements.length; i++){
					if(elements[i].className.match(/private/)){
						html += "<li><mark><a href=\"#" +elements[i].id+ "\">" +elements[i].id+ "</a></mark></li>";
					}else{
						html += "<li><a href=\"#" +elements[i].id+ "\">" +elements[i].id+ "</a></li>";
					}
				}
			}else{
				html += '<li>No missing Functions</li>';
			}
			html += '</ul>';

		}

		element.innerHTML = html;
		context.insertBefore(element, beforeElement.nextSibling || beforeElement);

	},

	init: function(){

		// show the documentation
		this._generateDocumentation();
		this._generateStatistics();

		// shows table of contents
		this._generateScopes();

	}

};
