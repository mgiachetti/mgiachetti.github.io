//colections
var RandBag = function(length) {
	this.data = Array(length);
	this.length = length;
	for(var i = 0; i < length; ++i)
		this.data[i] = i;
}

RandBag.prototype = {
	removeRandom: function() {
		var i = this.getRandIndex();
		var it = this.data[i];
		this.data[i] = this.data[this.length-1];
		this.data[this.length-1] = it;
		this.length--;
		return it;
	},
	getRandom: function() {
		return this.data[this.getRandIndex()];
	},
	getRandIndex: function() {
		return Math.random()*this.length | 0;
	}
}

// Priority Queue
var PriorityQueue = function(data, compareFunc) {
	this.data = data;
	this.length = this.data.length;
	this.compare = compareFunc || function(a,b){return a < b}
	this.rebuild();
}

PriorityQueue.prototype = {
	rebuild: function() {
		this.length = this.data.length;
		for(var i = this.length/2 | 0;  i >= 0 ; --i) {
			this.sink(i);
		}
	},
	removeTop: function() {
		this.swap(0, this.length-1);
		--this.length;
		this.sink(0);
	},
	top: function() {
		return this.data[0];
	},
	swap: function(i,j) {
		var a = this.data[i];
		this.data[i] = this.data[j];
		this.data[j] = a;
	},
	swim: function(i) {
		var d = this.data[i];
		while(i != 0) {
			var p = (i-1)/2 | 0; //parent

			var dp = this.data[p];
			if(this.compare(dp,d)) {
				this.swap(i, p);
				i = p;
			} else break;
		}
	},
	sink: function(i) {
		var d = this.data[i];
		while(true) {
			
			var k = i*2 + 1; //left child
			
			if(k >= this.length) break;

			var dl = this.data[k];
			var dr = k+1 < this.length ? this.data[k+1] : d;
			if(this.compare(d, dl) || this.compare(d, dr)) {
				if(this.compare(dr, dl)) {
					this.swap(i, k);
					i=k;
				} else {
					this.swap(i, k+1);
					i=k+1;
				}
			} else break;
		}
	}
}



