"use strict";

var numpy = {
  zeros: function() {//dimentions as arguments
    var params = Array.prototype.slice.call(arguments);
    var dim = params.shift();
    return Array.apply(null, Array(dim)).map( function(i) { return params.length ? numpy.zeros.apply(null, params) : 0.0; } );
  }
}

var Plot = function(canvasId) {
  this.lines = [];
  this.canvas = document.getElementById(canvasId);
}

Plot.prototype = {
  clear: function(){
    this.lines = [];
  },
  autoScale: function() {
    var xmin = null, xmax=null, ymin=null, ymax=null;
    this.lines.forEach(function(l){
      l.xs.forEach(function(x){
        if(xmin== null || x < xmin) xmin = x;
        if(xmax== null || x > xmax) xmax = x;
      });

      l.ys.forEach(function(y){
        if(ymin== null || y < ymin) ymin = y;
        if(ymax== null || y > ymax) ymax = y;
      });
    });
    return {xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax}
  },
  plot: function(xs, ys) {
    this.lines.push({xs: xs, ys: ys});
  },
  render: function() {

    var ctx = this.canvas.getContext("2d");
    var w = this.canvas.width;
    var h = this.canvas.height;

    //TODO: Fix zero division
    var dims = this.autoScale();
    var sx = w/(dims.xmax - dims.xmin);
    var x0 = dims.xmin;
    var sy = h/(dims.ymax - dims.ymin);
    var y0 = dims.ymin;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,w,h);

    // axis
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(0, h - ( -y0*sy));
    ctx.lineTo(w, h - ( -y0*sy));

    ctx.moveTo(-x0*sx, 0);
    ctx.lineTo(-x0*sx, h);
    ctx.stroke();

    var colors = ['#ff0000','#00ff00','#0000ff','#ffff00','#00ffff','#ff00ff'];
    for(var i = 0; i < this.lines.length; ++i) {
      var line = this.lines[i];

      ctx.strokeStyle = colors[i%colors.length];
      ctx.beginPath();
      for(var j = 0; j < line.xs.length; ++j) {
        var x = (line.xs[j] - x0)*sx;
        var y = (line.ys[j] - y0)*sy;

        if(j==0) {
          ctx.moveTo(x,  h -y);
        }

        ctx.lineTo(x, h - y);
      }
      ctx.stroke();
    }

  }
}
