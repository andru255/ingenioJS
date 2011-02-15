if(!me){ var me = {}; }

me.howto = function(context, settings){

	var context = context.id ? context : document.getElementById(context);
	if(context){
		this.context = context;
	}else{
		throw "Invalid element id given for context.";
	}

	this.settings = settings;

	return this;

};