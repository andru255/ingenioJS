
/**
 * @constructor Engine / Hitmap / Pathfinder Plugin (allows finding path(s) from A to B)
 * @param {Object} start The start point in {x, y} format
 * @param {Object} goal The goal point in {x, y} format
 * @param {Object} hitmap The hitmap
 * @param {Object} hitmapsize The hitmap's size in {x, y} format
 * @returns {Array} path with coordinates (e.g. [[x1,y1][x2,y2]])
 * @example
 * var path = new ingenioJS.engine.hitmap.pathfinder({x:2,y:2},{x:12,y:6}, engine);
 */
ingenioJS.engine.hitmap.pathfinder = function(start, goal, hitmap, hitmapsize){

	// first setup the grid & size
	this.hitmap = hitmap;
	this.hitmapsize = hitmapsize;

	var _start = this._node(null, {
		x: start.x,
		y: start.y
	});

	var _goal = this._node(null, {
		x: goal.x,
		y: goal.y
	});

	// setup velocities, can be negative in both dimensions
	this.velocity = {
		x: goal.x - start.x,
		y: goal.y - start.y
	};

	if(this.velocity.x == 0 && this.velocity.y == 0){
		return false;
	}

	// console.log(this.velocity);

	var limit = this.hitmapsize.x * this.hitmapsize.y,
		AStar = {}, // new Array(limit),
		result = [],
		_open = [ _start ],
		_closed = [],
		_successors,
		_node,
		_path;

	var length, max, min, i, j; // iteration vars

	while(length = _open.length){
		max = limit;
		min = -1;

		for(i=0; i<length; i++){
			if(_open[i] < max){
				max = _open[i].f;
				min = i;
			}
		};

		_node = _open.splice(min, 1)[0];

		if(_node.value === _goal.value){
			_path = _closed[_closed.push(_node) - 1];
			do{
				result.push( [ _path.x, _path.y ] );
				// result[_path.x+'_'+_path.y] = true;

			}while( _path = _path.parent );
			// reset everything
			AStar = _closed = _open = [];
			result.reverse();
		}else{
			_successors = this._successors(_node.x, _node.y);

			for(i=0,j=_successors.length; i<j; i++){
				_path = this._node(_node, _successors[i]);
				if(!AStar[_path.value]){
					_path.g = _node.g + this._distance(_successors[i], _node);
					_path.f = _path.g + this._distance(_successors[i], _goal);
					// cache the open point in grid
					_open.push(_path);
					AStar[_path.value] = true;
				}
			}
			_closed.push(_node);
		}

	}

	return result;

};

ingenioJS.engine.hitmap.pathfinder.prototype = {

	/**
	 * This internal function creates a node-relation between a parent and the actual point.
	 * It also rates the node-relations depending on their coordinate and distance.
	 * @param {Object} parent The parent, which is a _node object.
	 * @param {Object} point The (child)-point, which is a successor or another _node object
	 * @returns {Object} Node-Object
	 */
	_node: function(parent, point){

		var cols = this.hitmapsize.x;
		// var	rows = this.hitmapsize.y;

        return {
			parent: parent,
			// value: point.y + (point.x * rows), // This will end up in more vertically searching successors
			value: point.x + (point.y * cols), // This ends up in more horizontally searching successors
			x: point.x,
			y: point.y,
			f: 0,
			g: 0
        };

	},

	/**
	 * This internal function calculates the distance between two points in a 2D coordinate system.
	 * May differ, depending on used path algorithm (e.g. manhattan, diagonal or euclidean).
	 * @param {Object} point The point from where to calculate distance
	 * @param {Object} goal The goal point to where the distance is calculated
	 * @returns {Number} Distance as a vectorial entity
	 */
	_distance: function(point, goal){
		// manhattan
		return Math.abs(point.x - goal.x) + Math.abs(point.y - goal.y);		

		// diagonal
		// return Math.max(Math.abs(point.x - goal.x), Math.abs(point.y - goal.y));
		// euclidean
		// return Math.sqrt(Math.pow(point.x - goal.x, 2) + Math.pow(point.y - goal.y, 2));		
	},

	/**
	 * This internal function calculates the possible successing point around the given coordinate. Calculated depending on velocity and the hitmap entries.
	 * @param {Number} x The X-Coordinate
	 * @param {Number} y The Y-Coordinate
	 * @returns {Array} Array of successing points who are possible to go to.
	 */
	_successors: function(x, y){

		var N = y - 1,
			S = y + 1,
			E = x + 1,
			W = x - 1,
			_N = N > -1 && !this.hitmap.get(x, N),
			_S = S < this.hitmapsize.y && !this.hitmap.get(x, S),
			_E = E < this.hitmapsize.x && !this.hitmap.get(E, y),
			_W = W > -1 && !this.hitmap.get(W, y),
			result = [],
			_velocity = this.velocity;

		// Yeah, dude! This is Crockford-Mathematics at its best!
		// muhaha - Me, the JSNinja bashed you! =D

		// Why is nothing done when velocity is 0? -> Because then there's nothing to do, dude!

		if(_velocity.y < 0){
			if(_N){
				result.push({x: x, y: N});
			}else if(_S){
			//}else if(_S && ((_velocity.x < 0 && !_W) || (_velocity.x > 0 && !_E))){
				result.push({x: x, y: S});
			}
		}else if(_velocity.y > 0){
			if(_S){
				result.push({x: x, y: S});
			}else if(_N){
			//}else if(_N && ((_velocity.x < 0 && !_W) || (_velocity.x > 0 && !_E))){
				result.push({x: x, y: N});
			}
		}

		if(_velocity.x < 0){
			if(_W){
				result.push({x: W, y: y});
			}else if(_E){
			//}else if(_E && ((_velocity.y < 0 && !_N) || (_velocity.y > 0 && !_S))){
				result.push({x: E, y: y});
			}
		}else if(_velocity.x > 0){
			if(_E){
				result.push({x: E, y: y});
			}else if(_W){
			//}else if(_W && ((_velocity.y < 0 && !_N) || (_velocity.y > 0 && !_S))){
				result.push({x: W, y: y});
			}
		}

		return result;

	}

};