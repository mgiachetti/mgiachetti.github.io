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


function BTSize(node) {
	if(!node) return {w:0, h: 0};
	var l = BTSize(node.left);
	var r = BTSize(node.right);
	node.w = l.w + r.w + 1;
	node.h = (l.h > r.h ? l.h : r.h) + 1;
	return node;
}

function BTWidth(node) {
	if(!node) return 0;
	var l = BTWidth(node.left);
	var r = BTWidth(node.right);
	return l + r + 1;
}

function BTHeight(node) {
	if(!node) return 0;
	var l = BTWidth(node.left);
	var r = BTWidth(node.right);
	return (l > r ? l : r) + 1;
}

function BSTAdd(h, val) {
	if(!h) return { val: val, left: null, right: null };
	if(val < h.val) {
		h.left = BSTAdd(h.left, val);
	} else {
		h.right = BSTAdd(h.right, val);
	}
	return h;
}

function BSTGet(h, val) {
	if(h == null) return false;
	if(val < h.val) return BSTGet(h.left, val);
	else if(val > h.val) return BSTGet(r.right, val);
	return h;
}

function RBTIsRed(node) {
	return node ? node.red : false;
}

function RBTRotateLeft(h) {
	if(!RBTIsRed(h.right)) alert("RBTRotateLeft: Error no es rojo");
	var x = h.right;
	x.red = h.red;
	h.red = true;
	h.right = x.left;
	x.left = h;
	return x;
}

function RBTRotateRight(h) {
	if(!RBTIsRed(h.left) || !RBTIsRed(h.left.left)) alert("RBTRotateRight: Error no son rojos");

	var x = h.left;
	x.red = h.red;
	h.red = true;
	h.left = x.right;
	x.right = h;

	return x;
}

function RBTSwapColor(h) {
	if(!RBTIsRed(h.left) || !RBTIsRed(h.right)) alert("RBTSwapColor: Error no son rojo");
	h.red = true;
	h.left.red = false;
	h.right.red = false;
}

function RBTAdd(h, val) {
	if(!h) return {red: true, left: null, right: null, val: val};

	if(val < h.val) h.left = RBTAdd(h.left, val);
	else h.right = RBTAdd(h.right, val);

	if(RBTIsRed(h.right) && !RBTIsRed(h.left)) h = RBTRotateLeft(h);
	if(RBTIsRed(h.left) && RBTIsRed(h.left.left)) h = RBTRotateRight(h);
	if(RBTIsRed(h.left) && RBTIsRed(h.right)) RBTSwapColor(h);

	return h;
}


