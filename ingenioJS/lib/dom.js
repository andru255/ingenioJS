
String.prototype.trim = function() {
	return this.replace(/^\s+|\s+$/g,"");
};

String.prototype.basename=function(){
	var suffix = arguments[0] || false;

	var base = this.replace(/^.*[\/\\]/g, '');
	if (typeof(suffix) == 'string' && base.substr(base.length-suffix.length) == suffix) {
		base = base.substr(0, base.length-suffix.length);
	}
	return base;
};

Element.prototype.hasClass=function(selector){
	if((" " + this.className + " ").replace(/[\n\t]/g, " ").indexOf(" " + selector + " ") > -1 ){
		return true;
	}
	return false;
};

Element.prototype.addClass=function(className){
	var classNames=this.className.split(' ');

	// first check if Element has className
	for(var i=0;i<classNames.length;i++){
		if(classNames[i]===className){
			// nothing to do
			return true;
		}
	}

	// add className now
	this.className+=' '+className;
	return true;
};

Element.prototype.removeClass=function(className){
	var classNames=this.className.split(' '),
		newClass='';

	for(var i=0;i<classNames.length;i++){
		if(classNames[i]!==className){
			newClass+=' '+classNames[i];
		}
	}

	// update the className
	return !!(this.className=newClass.trim());
};
