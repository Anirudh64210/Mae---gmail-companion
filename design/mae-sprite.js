/* Mae sprite v1.2: hand-placed pixels, mirror-symmetric around the canvas center (x <-> 19 - x).
   Moods: wave, asleep, checking, waiting, unimpressed, relieved, sealed, shrug.
   t is in ticks (8 per second). For "sealed", t must count from the moment the state started. */
var MAE = (function(){
  var W = 20, H = 28, OY = 4;
  var P = {
    out:'#231E1C', cap:'#3E5A6E', capHi:'#56768C', brim:'#2C4252', badge:'#E8D48A',
    hair:'#3A2419', skin:'#D9A06E', skinD:'#B97F50', blush:'#D9826A', feat:'#1D1A19',
    shirt:'#A9C2D1', shirtD:'#809CAF', pants:'#3E5A6E', shoe:'#3B3230',
    env:'#FAF8F2', envL:'#9E9788', fx:'#8C9490', puff:'#B4BEBA',
    // sealed envelope
    paper:'#FAF8F2', lip:'#EDE7DA', inside:'#E2DAC8', flap:'#F2EDE2', edge:'#B8AE98', fold:'#D3CBB9',
    seal:'#D9AE45', sealHi:'#F2D98A', spark:'#E6A93A', sparkHi:'#FFF6D6'
  };
  function Grid(){ this.c = []; for (var y=0;y<H;y++){ this.c.push(new Array(W).fill(null)); } }
  Grid.prototype.set = function(x,y,col){ if(x>=0&&y>=0&&x<W&&y<H) this.c[y][x]=col; };
  Grid.prototype.get = function(x,y){ return (x>=0&&y>=0&&x<W&&y<H) ? this.c[y][x] : null; };
  Grid.prototype.row = function(x0,x1,y,col){ for(var x=x0;x<=x1;x++) this.set(x,y,col); };
  Grid.prototype.outline = function(){
    var add=[], x, y;
    for (y=0;y<H;y++) for (x=0;x<W;x++){
      if (this.c[y][x]) continue;
      if (this.get(x,y-1)||this.get(x,y+1)||this.get(x-1,y)||this.get(x+1,y)) add.push([x,y]);
    }
    for (var i=0;i<add.length;i++) this.c[add[i][1]][add[i][0]] = P.out;
  };

  // draw helpers in figure space (y offset added), m = mirrored
  function mk(g, dy){
    return {
      p:function(x,y,c){ g.set(x, y+OY+dy, c); },
      m:function(x,y,c){ g.set(x, y+OY+dy, c); g.set(19-x, y+OY+dy, c); },
      row:function(x0,x1,y,c){ for(var x=x0;x<=x1;x++) g.set(x, y+OY+dy, c); }
    };
  }

  function head(d){
    d.row(6,13,1,P.capHi);
    d.row(5,14,2,P.cap); d.row(5,14,3,P.cap);
    d.p(9,2,P.badge); d.p(10,2,P.badge);
    d.row(3,16,4,P.brim);
    d.row(4,15,5,P.hair);
    d.m(4,6,P.hair); d.m(5,6,P.hair); d.row(6,13,6,P.skin);
    d.m(4,7,P.hair); d.row(5,14,7,P.skin);
    for (var y=8;y<=11;y++) d.row(4,15,y,P.skin);
    d.row(5,14,12,P.skin);
    d.m(3,8,P.skin); d.m(3,9,P.skinD);
  }

  function face(d, mood, t){
    var F=P.feat;
    if (mood==='asleep'){ d.m(6,9,F); d.m(7,9,F); d.p(9,11,P.skinD); d.p(10,11,P.skinD); }
    if (mood==='checking'){ var f=((t>>1)%2); d.p(7-f,9,F); d.p(12-f,9,F); d.m(6,7,F); d.m(7,7,F); d.p(9,11,F); d.p(10,11,F); }
    // waiting: calm, eyes resting on the envelope, one slow blink every 3 s
    if (mood==='waiting'){ if ((t%24)===23){ d.m(6,9,F); d.m(7,9,F); } else d.m(7,9,F); d.p(9,11,F); d.p(10,11,F); }
    if (mood==='unimpressed'){ var blink=(t%24)===0; d.m(6,8,F); d.m(7,8,F); if(!blink) d.m(7,9,F); d.row(8,11,11,F); }
    if (mood==='relieved'){ d.m(6,8,F); d.m(7,9,F); d.m(8,8,F); d.m(5,10,P.blush); d.row(9,10,10,F); d.row(9,10,11,F); }
    if (mood==='shrug'){ var bl=(t%20)===0; if(!bl) d.m(7,8,F); d.m(7,9,F); d.m(6,7,F); d.m(7,6,F); d.row(9,10,11,F); }
    if (mood==='wave'){ var wb=(t%28)===0; if(!wb) d.m(7,8,F); d.m(7,9,F); d.m(5,10,P.blush); d.m(8,10,F); d.row(9,10,11,F); }
  }

  function body(d, mood, t){
    d.row(6,13,13,P.shirt); d.p(9,13,P.skinD); d.p(10,13,P.skinD);
    for (var y=14;y<=17;y++) d.row(6,13,y,P.shirt);
    d.m(7,15,P.shirtD);
    d.row(6,13,18,P.pants); d.row(6,13,19,P.pants);
    d.row(6,8,20,P.pants); d.row(11,13,20,P.pants);
    d.row(5,8,21,P.shoe); d.row(11,14,21,P.shoe);
    if (mood==='unimpressed' && (t%6)<3){ d.p(14,21,null); d.p(14,20,P.shoe); }
  }

  function arms(d, mood, t){
    var S=P.shirtD, K=P.skin;
    if (mood==='asleep'||mood==='relieved'){ d.m(5,14,S); d.m(5,15,S); d.m(5,16,S); d.m(5,17,K); }
    if (mood==='checking'||mood==='waiting'){
      d.m(5,14,S); d.m(5,15,S); d.m(5,16,S); d.m(6,16,K);
      d.row(7,12,14,P.envL); d.row(7,12,17,P.envL);
      d.m(7,15,P.envL); d.m(7,16,P.envL);
      d.m(8,15,P.envL); d.m(9,15,P.env); d.m(8,16,P.env); d.m(9,16,P.envL);
    }
    if (mood==='unimpressed'){ d.m(5,14,S); d.row(5,14,15,S); d.row(5,14,16,S); }
    if (mood==='shrug'){ var up=((t>>2)%2)===0; d.m(5,14,S); d.m(4,14,S); d.m(3,14,S); if(up){ d.m(3,13,S); d.m(3,12,K); } else { d.m(3,13,K); } }
    if (mood==='wave'){
      // left arm down; right arm raised, hand waving between two positions
      d.p(5,14,S); d.p(5,15,S); d.p(5,16,S); d.p(5,17,K);
      var w=((t>>1)%2)===0;
      d.p(14,14,S); d.p(15,14,S); d.p(16,13,S); d.p(17,12,S);
      if (w){ d.p(18,11,K); d.p(18,10,K); } else { d.p(18,11,S); d.p(18,10,K); d.p(18,9,K); }
    }
  }

  function effects(g, mood, t){
    var put=function(x,y,c){ if(!g.get(x,y)) g.set(x,y,c); };
    if (mood==='asleep'){
      var ph=t%16; if (ph<12){ var y0=2-(ph>>2);
      var Z=[[0,0],[1,0],[2,0],[1,1],[0,2],[1,2],[2,2]];
      for (var i=0;i<Z.length;i++) put(16+Z[i][0], y0+Z[i][1], P.fx); }
    }
    if (mood==='relieved'){
      var q=t%12; if (q<8){ if(q<4){ put(18,15,P.puff); put(19,15,P.puff); put(18,14,P.puff); } else { put(19,13,P.puff); } }
    }
  }

  // ---- sealed: Mae hops, dives into an envelope, the flap closes with her badge as the seal, it glitters ----
  var DIVE = [0,-2,-3,-4,-4,-3,0,3,6,9,12,15];   // Mae's vertical offset per tick; after that she is inside
  var SEAL_AT = 14;                                // tick the seal lands (sound + "ready")
  function buildSealed(t, opts){
    var g = new Grid(), T = Math.max(0, t);
    var envOn = T >= 1;
    var ey = T === 1 ? 2 : (T >= 15 && T <= 18 ? [-1,-2,-1,0][T-15] : 0);
    var FRONT = 17 + ey;
    var flap = T <= 11 ? 'open' : (T === 12 ? 'half' : 'closed');
    if (envOn && flap === 'open') for (var i=0;i<6;i++) g.row(2+i, 17-i, 16-i+ey, P.inside);
    if (T < DIVE.length){
      var m = build('relieved', 4, { noFx:true }), off = DIVE[T];
      for (var y=0;y<H;y++) for (var x=0;x<W;x++){
        var col = m.c[y][x]; if (!col || col === P.out) continue;
        var yy = y + off; if (envOn && yy >= FRONT) continue;
        g.set(x, yy, col);
      }
    }
    if (envOn){
      for (var r=0;r<10;r++) g.row(2, 17, FRONT+r, P.paper);
      g.row(2, 17, FRONT, P.lip);
      for (var k=0;k<7;k++){ g.set(2+k, FRONT+9-k, P.fold); g.set(17-k, FRONT+9-k, P.fold); }
    }
    if (envOn && flap === 'half'){ g.row(2,17,FRONT-1,P.flap); g.row(2,17,FRONT,P.edge); }
    if (envOn && flap === 'closed'){
      for (var j=0;j<7;j++){ g.row(2+j, 17-j, FRONT+j, P.flap); g.set(2+j, FRONT+j, P.edge); g.set(17-j, FRONT+j, P.edge); }
      g.row(8, 11, FRONT+6, P.edge);
      if (T >= SEAL_AT){ g.set(9,FRONT+5,P.sealHi); g.set(10,FRONT+5,P.sealHi); g.set(9,FRONT+6,P.seal); g.set(10,FRONT+6,P.seal); }
    }
    g.outline();
    if (T >= SEAL_AT && !(opts && opts.noFx)){
      var put=function(x,y,c){ if(!g.get(x,y)) g.set(x,y,c); };
      var star=function(cx,cy,size){
        if (size<=0) return;
        put(cx,cy,size>1?P.sparkHi:P.spark);
        for (var s=1;s<size;s++){ put(cx-s,cy,P.spark); put(cx+s,cy,P.spark); put(cx,cy-s,P.spark); put(cx,cy+s,P.spark); }
      };
      var SZ=[1,2,3,2,1,0,0,0], a=SZ[(T-SEAL_AT)%8], b=SZ[(T-SEAL_AT+4)%8];
      star(3, 11+ey, a); star(16, 11+ey, a);
      star(7, 6+ey, b);  star(12, 6+ey, b);
      if ((T-SEAL_AT)%4 < 2){ put(0, 21+ey, P.spark); put(19, 21+ey, P.spark); }
    }
    return g;
  }

  var MOODS = ['wave','asleep','checking','waiting','unimpressed','relieved','sealed','shrug'];

  function build(mood, t, opts){
    opts = opts || {};
    if (mood==='sealed') return buildSealed(t, opts);
    var g = new Grid();
    var nod = mood==='asleep' ? ((t>>3)%2) : 0;
    var b = mk(g, 0), h = mk(g, nod);
    body(b, mood, t); arms(b, mood, t);
    head(h); face(h, mood, t);
    g.outline();
    if (!opts.noFx) effects(g, mood, t);
    return g;
  }
  function paint(cv, mood, t){
    var ctx=cv.getContext('2d'); ctx.clearRect(0,0,W,H);
    var g=build(mood,t);
    for (var y=0;y<H;y++) for (var x=0;x<W;x++){ var col=g.c[y][x]; if(col){ ctx.fillStyle=col; ctx.fillRect(x,y,1,1); } }
  }
  return { W:W, H:H, P:P, MOODS:MOODS, build:build, paint:paint, SEAL_AT:SEAL_AT };
})();
if (typeof module!=='undefined') module.exports = MAE;
