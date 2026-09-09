/* Arrow Escape — WordPress front-end (vanilla). Depends on window.ArrowEngine. */
(function (global) {
  "use strict";

  var E = global.ArrowEngine;
  if (!E) return;

  var TOTAL = E.TOTAL_LEVELS || 100;
  var KEY = "arrow-escape-v4";
  var DR = [-1, 0, 1, 0];
  var DC = [0, 1, 0, -1];
  var INK = "#1a1814";
  var DENY = "#c44536";
  var HINT = "#b4532a";
  var TILE = "#e7dfd0";
  var FLY_PAD = 3.4;

  var ICO = {
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" fill="none"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    back: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17H8v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/></svg>',
    zin: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zout: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zreset: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  };

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function defaults() {
    return { version: 4, unlocked: 1, stars: {}, daily: {}, perfect: { cur: 0, best: 0 }, sound: true };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      var d = defaults();
      s = Object.assign({}, d, s);
      s.perfect = Object.assign({}, d.perfect, s.perfect || {});
      s.stars = s.stars || {};
      s.daily = s.daily || {};
      s.unlocked = Math.max(1, Math.min(TOTAL, s.unlocked | 0));
      s.version = 4;
      return s;
    } catch (e) {
      return defaults();
    }
  }

  function persistSave(save) {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch (e) { /* private mode */ }
  }

  var audio = (function () {
    var ctx = null, master = null, enabled = true;
    function get() {
      if (!ctx) {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC({ latencyHint: "interactive" });
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
      }
      return ctx;
    }
    function unlock() {
      var c = get();
      if (c && c.state === "suspended") c.resume();
    }
    function setOn(on) {
      enabled = on;
      if (master) master.gain.setTargetAtTime(on ? 0.22 : 0, get().currentTime, 0.02);
    }
    function beep(freq, dur, type, gain, slide) {
      if (!enabled) return;
      var c = get();
      if (!c || c.state === "suspended") return;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), c.currentTime + dur);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(gain, c.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(c.currentTime + dur + 0.02);
    }
    return {
      unlock: unlock,
      setOn: setOn,
      tap: function () { beep(520, 0.05, "triangle", 0.4, 0); },
      swoosh: function () { beep(420, 0.16, "sine", 0.55, 2.4); },
      err: function () { beep(180, 0.14, "square", 0.35, 0.6); },
      hint: function () { beep(660, 0.12, "triangle", 0.4, 0); },
      win: function () {
        beep(523, 0.12, "sine", 0.45, 0);
        setTimeout(function () { beep(659, 0.12, "sine", 0.45, 0); }, 90);
        setTimeout(function () { beep(784, 0.22, "sine", 0.5, 0); }, 180);
      },
      lose: function () { beep(220, 0.28, "sawtooth", 0.25, 0.45); },
    };
  })();

  function difficultyName(level) {
    if (level <= 8) return "Very Easy";
    if (level <= 20) return "Easy";
    if (level <= 36) return "Medium";
    if (level <= 52) return "Hard";
    if (level <= 68) return "Expert";
    if (level <= 80) return "Super Hard";
    if (level <= 92) return "Insane";
    return "Extreme";
  }

  function formatTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function starCountFor(mistakes) {
    if (mistakes === 0) return 3;
    if (mistakes <= 2) return 2;
    return 1;
  }

  function turnsOf(a, W) {
    var n = 0;
    for (var i = 1; i < a.cells.length - 1; i++) {
      var A = a.cells[i - 1], B = a.cells[i], C = a.cells[i + 1];
      var r1 = Math.floor(A / W), c1 = A % W;
      var r2 = Math.floor(B / W), c2 = B % W;
      var r3 = Math.floor(C / W), c3 = C % W;
      if (r2 - r1 !== r3 - r2 || c2 - c1 !== c3 - c2) n++;
    }
    return n;
  }

  function arrowScore(a, mistakes, W) {
    var t = turnsOf(a, W);
    var longBonus = a.cells.length >= 15 ? 10 : a.cells.length >= 10 ? 5 : 0;
    return Math.floor(10 + a.cells.length * 1.5 + longBonus + t * 2 + (mistakes === 0 ? 20 : 0));
  }

  function hydrate(p) {
    return p.arrows.map(function (a) {
      return Object.assign({}, a, { cells: a.cells.slice(), alive: true });
    });
  }

  function shapeName(id) {
    return (E.SHAPES && E.SHAPES[id] && E.SHAPES[id].name) || "Classic";
  }

  function rayBlocked(puzzle, alive, arrow) {
    var own = {}, occupied = {}, i, j, cell;
    for (i = 0; i < arrow.cells.length; i++) own[arrow.cells[i]] = 1;
    for (i = 0; i < alive.length; i++) {
      if (!alive[i].alive || alive[i].id === arrow.id) continue;
      for (j = 0; j < alive[i].cells.length; j++) occupied[alive[i].cells[j]] = 1;
    }
    var head = arrow.cells[arrow.cells.length - 1];
    var r = Math.floor(head / puzzle.W) + DR[arrow.dir];
    var c = (head % puzzle.W) + DC[arrow.dir];
    while (r >= 0 && r < puzzle.H && c >= 0 && c < puzzle.W) {
      cell = r * puzzle.W + c;
      if (occupied[cell] && !own[cell]) return true;
      r += DR[arrow.dir];
      c += DC[arrow.dir];
    }
    return false;
  }

  function ptsOf(a, W) {
    var pts = a.cells.map(function (cell) {
      return { x: (cell % W) + 0.5, y: Math.floor(cell / W) + 0.5 };
    });
    if (pts.length === 1) {
      pts.unshift({ x: pts[0].x - DC[a.dir] * 0.52, y: pts[0].y - DR[a.dir] * 0.52 });
    }
    return pts;
  }

  function pathCum(pts) {
    var cum = [0], i;
    for (i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return cum;
  }

  function pointAt(pts, cum, dir, d) {
    var L = cum[cum.length - 1] || 0.01;
    var exitAng = Math.atan2(DR[dir], DC[dir]);
    var i, seg, t, x, y, ang;
    if (d <= 0) {
      ang = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : exitAng;
      return { x: pts[0].x, y: pts[0].y, ang: ang };
    }
    if (d >= L - 1e-9) {
      return {
        x: pts[pts.length - 1].x + DC[dir] * (d - L),
        y: pts[pts.length - 1].y + DR[dir] * (d - L),
        ang: exitAng,
      };
    }
    i = 1;
    while (i < cum.length && cum[i] < d) i++;
    seg = cum[i] - cum[i - 1] || 1e-6;
    t = (d - cum[i - 1]) / seg;
    x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t;
    y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t;
    ang = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    return { x: x, y: y, ang: ang };
  }

  function headTriangle(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -0.16);
    ctx.lineTo(0.42, 0);
    ctx.lineTo(0, 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPolyline(ctx, pts) {
    var i;
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function flightTravel(a, W, H) {
    var pts = ptsOf(a, W);
    var L = pathCum(pts)[pts.length - 1] || 0.5;
    var hx = pts[pts.length - 1].x;
    var hy = pts[pts.length - 1].y;
    var edge =
      a.dir === 0
        ? hy + FLY_PAD + 0.8
        : a.dir === 1
          ? W - hx + FLY_PAD + 0.8
          : a.dir === 2
            ? H - hy + FLY_PAD + 0.8
            : hx + FLY_PAD + 0.8;
    return { L: L, travel: L + Math.max(2.4, edge) };
  }

  function drawArrow(ctx, a, W, color, sw) {
    var pts = ptsOf(a, W);
    if (!pts.length) return;
    var last = pts[pts.length - 1];
    var ang = Math.atan2(DR[a.dir], DC[a.dir]);
    var i;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = sw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    headTriangle(ctx, last.x, last.y, ang);
    ctx.restore();
  }

  function drawUncoil(ctx, a, W, s, color, sw) {
    var pts = ptsOf(a, W);
    if (pts.length < 2) return;
    var cum = pathCum(pts);
    var L = cum[cum.length - 1] || 0.5;
    var tailD = s;
    var headD = s + L;
    var poly = [pointAt(pts, cum, a.dir, tailD)];
    var i, head;
    for (i = 0; i < pts.length; i++) {
      if (cum[i] > tailD + 1e-6 && cum[i] < headD - 1e-6) {
        poly.push({ x: pts[i].x, y: pts[i].y, ang: 0 });
      }
    }
    head = pointAt(pts, cum, a.dir, headD);
    poly.push(head);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = sw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawPolyline(ctx, poly);
    headTriangle(ctx, head.x, head.y, head.ang);
    ctx.restore();
  }

  function Board(wrap) {
    this.wrap = wrap;
    this.canvas = wrap.querySelector("canvas");
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.puzzle = null;
    this.arrows = [];
    this.denyId = null;
    this.hintId = null;
    this.flying = [];
    this._ended = {};
    this.onTap = function () {};
    this.onFlyEnd = function () {};
    this._flyRaf = 0;
    this._bind();
  }

  Board.prototype._bind = function () {
    var self = this;
    var pan = false, sx = 0, sy = 0, moved = 0, pinch = 0;
    function isChrome(t) {
      return t && t.closest && t.closest("button");
    }
    this.wrap.addEventListener("pointerdown", function (e) {
      if (isChrome(e.target)) return;
      moved = 0;
      if (self.view.zoom > 1.01) {
        pan = true;
        sx = e.clientX - self.view.panX;
        sy = e.clientY - self.view.panY;
      }
    });
    global.addEventListener("pointermove", function (e) {
      if (!pan) return;
      self.view.panX = e.clientX - sx;
      self.view.panY = e.clientY - sy;
      moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      self.applyView();
    });
    global.addEventListener("pointerup", function (e) {
      var was = pan;
      pan = false;
      if (isChrome(e.target)) return;
      if (was && moved >= 8) return;
      if (!self.puzzle) return;
      var rect = self.canvas.getBoundingClientRect();
      var spanW = self.puzzle.W + FLY_PAD * 2;
      var spanH = self.puzzle.H + FLY_PAD * 2;
      var sxu = rect.width / spanW;
      var syu = rect.height / spanH;
      var ux = (e.clientX - rect.left) / sxu - FLY_PAD;
      var uy = (e.clientY - rect.top) / syu - FLY_PAD;
      var best = null, bestD = 0.55, i, j, a, cell, x, y, d;
      for (i = 0; i < self.arrows.length; i++) {
        a = self.arrows[i];
        if (!a.alive) continue;
        if (self._isFlying(a.id)) continue;
        for (j = 0; j < a.cells.length; j++) {
          cell = a.cells[j];
          x = (cell % self.puzzle.W) + 0.5;
          y = Math.floor(cell / self.puzzle.W) + 0.5;
          d = Math.hypot(ux - x, uy - y);
          if (d < bestD) {
            bestD = d;
            best = a;
          }
        }
      }
      if (best) self.onTap(best);
    });
    this.wrap.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        self.view.zoom = Math.max(0.7, Math.min(4, self.view.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
        self.applyView();
      },
      { passive: false }
    );
    this.wrap.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length === 2) {
          pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          pan = false;
        }
      },
      { passive: true }
    );
    this.wrap.addEventListener(
      "touchmove",
      function (e) {
        if (e.touches.length === 2 && pinch) {
          e.preventDefault();
          var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          self.view.zoom = Math.max(0.7, Math.min(4, self.view.zoom * (dist / pinch)));
          pinch = dist;
          self.applyView();
        }
      },
      { passive: false }
    );
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () {
        self.layout();
      }).observe(this.wrap);
    }
  };

  Board.prototype.applyView = function () {
    var v = this.view;
    this.canvas.style.transform = "translate3d(" + v.panX + "px," + v.panY + "px,0) scale(" + v.zoom + ")";
  };

  Board.prototype.resetView = function () {
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.applyView();
  };

  Board.prototype.zoomBy = function (f) {
    this.view.zoom = Math.max(0.7, Math.min(4, this.view.zoom * f));
    this.applyView();
  };

  Board.prototype.setState = function (puzzle, arrows, denyId, hintId) {
    this.puzzle = puzzle;
    this.arrows = arrows;
    this.denyId = denyId;
    this.hintId = hintId;
    this.layout();
  };

  Board.prototype._isFlying = function (id) {
    var i;
    for (i = 0; i < this.flying.length; i++) {
      if (this.flying[i].arrow.id === id) return true;
    }
    return false;
  };

  Board.prototype.clearFlights = function () {
    if (this._flyRaf) cancelAnimationFrame(this._flyRaf);
    this._flyRaf = 0;
    this.flying = [];
    this._ended = {};
  };

  Board.prototype.layout = function () {
    var puzzle = this.puzzle;
    var canvas = this.canvas;
    var wrap = this.wrap;
    if (!puzzle || !canvas) return;
    var dpr = Math.min(2.5, global.devicePixelRatio || 1);
    var pad = 16;
    var bw = wrap.clientWidth - pad;
    var bh = wrap.clientHeight - pad;
    var spanW = puzzle.W + FLY_PAD * 2;
    var spanH = puzzle.H + FLY_PAD * 2;
    var cell = Math.max(8, Math.min(bw / spanW, bh / spanH));
    var cssW = cell * spanW;
    var cssH = cell * spanH;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * cell, 0, 0, dpr * cell, dpr * cell * FLY_PAD, dpr * cell * FLY_PAD);
    this.paint(ctx);
  };

  Board.prototype.paint = function (ctx, ts) {
    var puzzle = this.puzzle;
    if (!puzzle) return;
    ts = ts || performance.now();
    ctx.clearRect(-FLY_PAD - 1, -FLY_PAD - 1, puzzle.W + FLY_PAD * 2 + 2, puzzle.H + FLY_PAD * 2 + 2);
    var i, a, r, c, f, ft, dur, t, e, s, fade, reduce;
    for (i = 0; i < puzzle.mask.length; i++) {
      if (!puzzle.mask[i]) continue;
      r = Math.floor(i / puzzle.W);
      c = i % puzzle.W;
      ctx.fillStyle = TILE;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c + 0.08, r + 0.08, 0.84, 0.84, 0.12);
      else ctx.rect(c + 0.08, r + 0.08, 0.84, 0.84);
      ctx.fill();
    }
    for (i = 0; i < this.arrows.length; i++) {
      a = this.arrows[i];
      if (!a.alive) continue;
      if (this._isFlying(a.id)) continue;
      var deny = this.denyId === a.id;
      var hint = this.hintId === a.id;
      drawArrow(ctx, a, puzzle.W, deny ? DENY : hint ? HINT : INK, hint || deny ? 0.18 : 0.15);
    }
    reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (i = 0; i < this.flying.length; i++) {
      f = this.flying[i];
      ft = flightTravel(f.arrow, puzzle.W, puzzle.H);
      dur = reduce ? 220 : Math.max(460, Math.min(920, ft.travel * 52));
      t = Math.min(1, Math.max(0, (ts - f.start) / dur));
      e = t * t * (3 - 2 * t);
      s = e * ft.travel;
      fade = t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      drawUncoil(ctx, f.arrow, puzzle.W, s, INK, 0.16);
      ctx.restore();
    }
  };

  Board.prototype.fly = function (arrow) {
    var self = this;
    this.flying.push({ arrow: arrow, start: performance.now() });
    if (this._flyRaf) return;
    var tick = function (ts) {
      var ctx = self.canvas.getContext("2d");
      if (!ctx) return;
      self.paint(ctx, ts);
      var pending = false;
      var ended = [];
      var i, f, ft, dur, t, reduce;
      reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (i = 0; i < self.flying.length; i++) {
        f = self.flying[i];
        ft = flightTravel(f.arrow, self.puzzle.W, self.puzzle.H);
        dur = reduce ? 220 : Math.max(460, Math.min(920, ft.travel * 52));
        t = Math.min(1, Math.max(0, (ts - f.start) / dur));
        if (t < 1) pending = true;
        else if (!self._ended[f.arrow.id]) {
          self._ended[f.arrow.id] = 1;
          ended.push(f.arrow.id);
        }
      }
      if (ended.length) {
        self.flying = self.flying.filter(function (fl) {
          return ended.indexOf(fl.arrow.id) < 0;
        });
        for (i = 0; i < ended.length; i++) self.onFlyEnd(ended[i]);
      }
      if (pending) self._flyRaf = requestAnimationFrame(tick);
      else self._flyRaf = 0;
    };
    tick(performance.now());
  };

  function boot(root) {
    if (root._aeBooted) return;
    root._aeBooted = true;

    var save = loadSave();
    audio.setOn(save.sound);

    var state = {
      screen: "home",
      overlay: null,
      puzzle: null,
      arrows: [],
      mode: "campaign",
      level: 1,
      date: dateKey(),
      lives: 3,
      maxLives: 3,
      mistakes: 0,
      score: 0,
      busy: false,
      loading: false,
      loadMsg: "Setting the board",
      denyId: null,
      hintId: null,
      remaining: 0,
      departing: {},
      winning: false,
      elapsed: 0,
      cal: { y: new Date().getFullYear(), m: new Date().getMonth() },
    };

    var startStamp = 0;
    var timerRaf = 0;
    var hintLock = 0;
    var toastTimer = 0;
    var board = null;

    root.innerHTML =
      '<div class="ae-screen ae-home" data-screen="home"></div>' +
      '<div class="ae-screen ae-play" data-screen="play">' +
        '<div class="ae-hud">' +
          '<button class="ae-icon-btn" data-act="back" aria-label="Back to map">' + ICO.back + "</button>" +
          '<button class="ae-icon-btn" data-act="restart" aria-label="Restart">' + ICO.restart + "</button>" +
          '<div class="ae-hud-mid">' +
            '<div class="ae-hud-title"><span data-el="title"></span><span class="ae-hud-sub" data-el="sub"></span></div>' +
            '<div class="ae-hud-meta"><span class="ae-hearts" data-el="hearts"></span><span class="ae-clock" data-el="clock">00:00 · 0</span></div>' +
          "</div>" +
          '<div style="width:2.75rem;flex-shrink:0"></div>' +
        "</div>" +
        '<div class="ae-board-wrap" data-el="boardWrap">' +
          '<canvas aria-label="Arrow Escape board" hidden></canvas>' +
          '<div class="ae-zoom">' +
            '<button data-act="zin" aria-label="Zoom in">' + ICO.zin + "</button>" +
            '<button data-act="zout" aria-label="Zoom out">' + ICO.zout + "</button>" +
            '<button data-act="zreset" aria-label="Reset zoom">' + ICO.zreset + "</button>" +
          "</div>" +
          '<button class="ae-fab" data-act="hint" aria-label="Show hint">' + ICO.hint + "</button>" +
        "</div>" +
        '<div class="ae-loading" data-el="loading" hidden><div class="ae-spin"></div><p data-el="loadMsg">Setting the board</p></div>' +
      "</div>" +
      '<div class="ae-overlay" data-el="overlay"></div>' +
      '<div class="ae-toast" data-el="toast"></div>';

    var homeEl = root.querySelector('[data-screen="home"]');
    var playEl = root.querySelector('[data-screen="play"]');
    var overlayEl = root.querySelector("[data-el=overlay]");
    var toastEl = root.querySelector("[data-el=toast]");
    var titleEl = root.querySelector("[data-el=title]");
    var subEl = root.querySelector("[data-el=sub]");
    var heartsEl = root.querySelector("[data-el=hearts]");
    var clockEl = root.querySelector("[data-el=clock]");
    var loadingEl = root.querySelector("[data-el=loading]");
    var loadMsgEl = root.querySelector("[data-el=loadMsg]");
    var boardWrap = root.querySelector("[data-el=boardWrap]");
    var canvas = boardWrap.querySelector("canvas");

    function setLoading(on, msg) {
      if (msg) loadMsgEl.textContent = msg;
      state.loading = !!on;
      loadingEl.hidden = !on;
      loadingEl.setAttribute("aria-hidden", on ? "false" : "true");
      if (on) loadingEl.classList.add("is-on");
      else loadingEl.classList.remove("is-on");
      loadingEl.style.setProperty("display", on ? "flex" : "none", "important");
      canvas.hidden = !!on;
    }

    board = new Board(boardWrap);
    board.onTap = onTap;
    board.onFlyEnd = onFlyEnd;

    function stopTimer() {
      if (timerRaf) cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }

    function startTimer() {
      stopTimer();
      startStamp = performance.now();
      state.elapsed = 0;
      var tick = function (ts) {
        state.elapsed = ts - startStamp;
        clockEl.textContent = formatTime(state.elapsed) + " · " + state.score;
        timerRaf = requestAnimationFrame(tick);
      };
      timerRaf = requestAnimationFrame(tick);
    }

    function flash(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.classList.remove("is-on");
      }, 1800);
    }

    function commit(fn) {
      save = fn(save);
      persistSave(save);
    }

    function showScreen(name) {
      state.screen = name;
      homeEl.classList.toggle("is-on", name === "home");
      playEl.classList.toggle("is-on", name === "play");
    }

    function totalStars() {
      var n = 0, k;
      for (k in save.stars) if (Object.prototype.hasOwnProperty.call(save.stars, k)) n += save.stars[k] | 0;
      return n;
    }

    function completedCount() {
      var n = 0, k;
      for (k in save.stars) if ((save.stars[k] | 0) > 0) n++;
      return n;
    }

    function renderHome() {
      var done = completedCount();
      var pct = Math.round((done / TOTAL) * 100);
      var todayStars = save.daily[state.date] | 0;
      var html = "";
      html += '<header class="ae-home-head"><div></div><div>';
      html += "<h2>Arrow Escape</h2>";
      html += '<p class="ae-lede">Tap every arrow whose exit is clear. Empty the silhouette.</p>';
      html += '</div><div class="ae-head-actions">';
      html += '<button class="ae-icon-btn" data-act="help" aria-label="How to play">' + ICO.help + "</button>";
      html += '<button class="ae-icon-btn" data-act="sound" aria-label="' + (save.sound ? "Mute" : "Unmute") + '">' + (save.sound ? ICO.vol : ICO.mute) + "</button>";
      html += "</div></header>";
      html += '<div class="ae-stats"><div class="ae-progress"><div class="ae-progress-fill" style="width:' + pct + '%"></div>';
      html += '<span class="ae-progress-label">' + done + " / " + TOTAL + "</span></div>";
      html += '<div class="ae-star-chip">' + ICO.star + " " + totalStars() + "</div></div>";
      html += '<div class="ae-feats">';
      html += '<button class="ae-feat ae-feat-daily" data-act="daily"><span class="ae-feat-ico">' + ICO.cal + "</span><span><span class=\"ae-feat-title\">Daily challenge</span><span class=\"ae-feat-sub\">";
      html += todayStars ? "Solved · " + todayStars + " star" + (todayStars === 1 ? "" : "s") : "Extreme · random 50–80 board";
      html += "</span></span></button>";
      html += '<button class="ae-feat ae-feat-streak" data-act="streak"><span><span class="ae-feat-title">' + save.perfect.cur + ' perfect</span><span class="ae-feat-sub">Best ' + save.perfect.best + "</span></span></button>";
      html += '<button class="ae-feat ae-feat-cal" data-act="cal" aria-label="Open daily calendar">' + ICO.cal + "</button>";
      html += "</div>";
      html += '<div class="ae-levels">';
      var n, locked, stars, current, cls;
      for (n = 1; n <= TOTAL; n++) {
        locked = n > save.unlocked;
        stars = save.stars[String(n)] | 0;
        current = n === save.unlocked && !stars;
        cls = "ae-lvl" + (locked ? " is-locked" : stars ? " is-done" : current ? " is-current" : "");
        html += '<button class="' + cls + '" data-act="lvl" data-n="' + n + '" aria-label="' + (locked ? "Level " + n + " locked" : "Level " + n + ", " + shapeName(E.shapeFor(n))) + '">' + n;
        if (!locked && stars) {
          html += '<span class="ae-mini">';
          html += '<i' + (stars > 0 ? ' class="on"' : "") + "></i>";
          html += '<i' + (stars > 1 ? ' class="on"' : "") + "></i>";
          html += '<i' + (stars > 2 ? ' class="on"' : "") + "></i>";
          html += "</span>";
        }
        html += "</button>";
      }
      html += "</div>";
      html += '<footer class="ae-foot"><button class="ae-link" data-act="reset">Reset progress</button></footer>';
      homeEl.innerHTML = html;
    }

    function paintHearts() {
      var h = "", i;
      for (i = 0; i < state.maxLives; i++) {
        h += ICO.heart.replace("<svg", i < state.lives ? "<svg" : '<svg class="off"');
      }
      heartsEl.innerHTML = h;
    }

    function paintHud() {
      if (state.mode === "daily") {
        titleEl.textContent = "Daily Extreme";
        subEl.textContent = state.puzzle
          ? state.puzzle.W + "×" + state.puzzle.H + " · " + state.puzzle.shapeName
          : "Challenge";
      } else {
        titleEl.textContent = difficultyName(state.level);
        subEl.textContent = state.puzzle ? "Level " + state.level + " · " + state.puzzle.shapeName : "Level " + state.level;
      }
      paintHearts();
      clockEl.textContent = formatTime(state.elapsed) + " · " + state.score;
    }

    function beginPuzzle(p, mode, lvl, key) {
      var list = hydrate(p);
      state.puzzle = Object.assign({}, p, { arrows: list });
      state.arrows = list;
      state.mode = mode;
      state.level = lvl;
      state.date = key;
      state.lives = p.lives || 3;
      state.maxLives = p.lives || 3;
      state.mistakes = 0;
      state.score = 0;
      state.busy = false;
      state.denyId = null;
      state.hintId = null;
      state.remaining = list.length;
      state.departing = {};
      state.winning = false;
      state.loading = false;
      state.overlay = null;
      hideOverlay();
      showScreen("play");
      setLoading(false);
      paintHud();
      board.resetView();
      board.clearFlights();
      board.setState(state.puzzle, state.arrows, null, null);
      startTimer();
    }

    function loadLevel(n) {
      setLoading(true, "Composing " + shapeName(E.shapeFor(n)));
      showScreen("play");
      hideOverlay();
      setTimeout(function () {
        try {
          beginPuzzle(E.generateLevel(n), "campaign", n, dateKey());
        } catch (err) {
          showError(String((err && err.message) || err));
        }
      }, 40);
    }

    function loadDaily(key) {
      key = key || dateKey();
      var preview = E.dailyConfig ? E.dailyConfig(key) : null;
      var msg = preview
        ? "Composing " + preview.W + "×" + preview.H + " " + preview.shapeName
        : "Today's silhouette";
      setLoading(true, msg);
      showScreen("play");
      hideOverlay();
      setTimeout(function () {
        try {
          beginPuzzle(E.generateDaily(key), "daily", 0, key);
        } catch (err) {
          showError(String((err && err.message) || err));
        }
      }, 40);
    }

    function goHome() {
      stopTimer();
      state.overlay = null;
      state.puzzle = null;
      hideOverlay();
      renderHome();
      showScreen("home");
      audio.tap();
    }

    function finishWin() {
      stopTimer();
      var stars = starCountFor(state.mistakes);
      if (state.mode === "daily") {
        commit(function (s) {
          var prev = s.daily[state.date] | 0;
          var daily = Object.assign({}, s.daily);
          daily[state.date] = Math.max(prev, stars);
          return Object.assign({}, s, { daily: daily });
        });
      } else {
        commit(function (s) {
          var prev = s.stars[String(state.level)] | 0;
          var starsMap = Object.assign({}, s.stars);
          starsMap[String(state.level)] = Math.max(prev, stars);
          var unlocked = s.unlocked;
          if (state.level < TOTAL && state.level + 1 > unlocked) unlocked = state.level + 1;
          var perfect = Object.assign({}, s.perfect);
          if (stars === 3) {
            perfect.cur += 1;
            if (perfect.cur > perfect.best) perfect.best = perfect.cur;
          } else {
            perfect.cur = 0;
          }
          return Object.assign({}, s, { stars: starsMap, unlocked: unlocked, perfect: perfect });
        });
      }
      audio.win();
      showWin(stars);
    }

    function onFlyEnd(id) {
      if (id != null) delete state.departing[id];
      if (state.remaining <= 0 && board.flying.length === 0 && !state.winning) {
        state.winning = true;
        state.busy = true;
        setTimeout(finishWin, 120);
      }
    }

    function onTap(a) {
      if (!state.puzzle || state.lives <= 0 || !a.alive) return;
      if (state.departing[a.id]) return;
      if (rayBlocked(state.puzzle, state.arrows, a)) {
        audio.err();
        state.mistakes += 1;
        state.denyId = a.id;
        board.setState(state.puzzle, state.arrows, a.id, state.hintId);
        setTimeout(function () {
          state.denyId = null;
          if (state.puzzle) board.setState(state.puzzle, state.arrows, null, state.hintId);
        }, 420);
        state.lives -= 1;
        paintHearts();
        if (state.lives <= 0) {
          stopTimer();
          setTimeout(function () {
            audio.lose();
            showLose();
          }, 380);
        }
        state.busy = true;
        setTimeout(function () {
          state.busy = false;
        }, 280);
        return;
      }
      audio.swoosh();
      state.departing[a.id] = 1;
      state.remaining -= 1;
      state.score += arrowScore(a, state.mistakes, state.puzzle.W);
      clockEl.textContent = formatTime(state.elapsed) + " · " + state.score;
      a.alive = false;
      board.setState(state.puzzle, state.arrows, null, state.hintId);
      board.fly(a);
    }

    function hint() {
      if (!state.puzzle || state.lives <= 0) return;
      var now = Date.now();
      if (now < hintLock) return;
      hintLock = now + 800;
      var id = null, i, target;
      for (i = 0; i < state.puzzle.solutionOrder.length; i++) {
        target = state.arrows.filter(function (a) {
          return a.id === state.puzzle.solutionOrder[i] && a.alive;
        })[0];
        if (target) {
          id = target.id;
          break;
        }
      }
      if (id == null) {
        flash("Nothing left to hint");
        return;
      }
      audio.hint();
      state.hintId = id;
      board.setState(state.puzzle, state.arrows, state.denyId, id, null);
      setTimeout(function () {
        state.hintId = null;
        if (state.puzzle) board.setState(state.puzzle, state.arrows, state.denyId, null, null);
      }, 1800);
    }

    function hideOverlay() {
      overlayEl.classList.remove("is-on");
      overlayEl.innerHTML = "";
    }

    function openCard(inner, wide) {
      overlayEl.innerHTML = '<div class="ae-card' + (wide ? " is-wide" : "") + '" role="dialog" aria-modal="true">' + inner + "</div>";
      overlayEl.classList.add("is-on");
    }

    function showWin(stars) {
      var title =
        state.mode === "daily"
          ? "Daily complete"
          : state.level === TOTAL
            ? "All silhouettes cleared"
            : "Level cleared";
      var sub =
        (state.mistakes === 0 ? "Perfect run" : "Mistakes: " + state.mistakes) +
        " · " +
        formatTime(state.elapsed) +
        " · " +
        state.score +
        " pts";
      var s = "";
      s += "<h3>" + title + "</h3><p class=\"ae-sub\">" + sub + "</p>";
      s += '<div class="ae-stars">';
      s += ICO.star.replace("<svg", stars > 0 ? '<svg class="on"' : "<svg");
      s += ICO.star.replace("<svg", stars > 1 ? '<svg class="on"' : "<svg");
      s += ICO.star.replace("<svg", stars > 2 ? '<svg class="on"' : "<svg");
      s += "</div><div class=\"ae-row\">";
      s += '<button class="ae-btn" data-act="map">Map</button>';
      s += '<button class="ae-btn" data-act="replay">Replay</button>';
      if (state.mode === "campaign") {
        s += '<button class="ae-btn ae-btn-primary" data-act="next">' + (state.level >= TOTAL ? "Finish" : "Next") + "</button>";
      }
      s += "</div>";
      openCard(s);
    }

    function showLose() {
      openCard(
        "<h3>Out of lives</h3><p class=\"ae-sub\">The board is unchanged. Try a different order.</p>" +
          '<div class="ae-row" style="margin-top:1.5rem"><button class="ae-btn" data-act="map">Map</button>' +
          '<button class="ae-btn ae-btn-primary" data-act="replay">Try again</button></div>'
      );
    }

    function showHelp() {
      openCard(
        "<h3>How to play</h3><ol class=\"ae-help\">" +
          "<li><b>1. </b>Each arrow points the way it leaves the board — from its head, along that ray, to the edge.</li>" +
          "<li><b>2. </b>Tap an arrow only if nothing else sits on that exit ray. The head shoots straight off; an L, U, or multi-turn uncoils into a long straight line behind it.</li>" +
          "<li><b>3. </b>Wrong taps cost a life. Clear every arrow to finish the silhouette.</li>" +
          "<li><b>4. </b>Hint lights a legal move. Pinch or scroll to zoom on denser boards.</li>" +
          "</ol><div class=\"ae-row\" style=\"margin-top:1.5rem\"><button class=\"ae-btn ae-btn-primary\" data-act=\"close\">Got it</button></div>"
      );
    }

    function showReset() {
      openCard(
        "<h3>Reset progress?</h3><p class=\"ae-sub\">Stars, unlocks, and the daily log will be wiped on this device.</p>" +
          '<div class="ae-row" style="margin-top:1.5rem"><button class="ae-btn" data-act="close">Cancel</button>' +
          '<button class="ae-btn ae-btn-danger" data-act="do-reset">Reset</button></div>'
      );
    }

    function showError(msg) {
      showScreen("home");
      renderHome();
      openCard(
        "<h3>Could not build that board</h3><p class=\"ae-sub\"></p>" +
          '<div class="ae-row" style="margin-top:1.5rem"><button class="ae-btn ae-btn-primary" data-act="close">Back</button></div>'
      );
      overlayEl.querySelector(".ae-sub").textContent = msg || "Generation failed.";
    }

    function showCal() {
      var y = state.cal.y, m = state.cal.m;
      var first = new Date(y, m, 1);
      var start = first.getDay();
      var days = new Date(y, m + 1, 0).getDate();
      var label = first.toLocaleString("en", { month: "long", year: "numeric" });
      var today = dateKey();
      var html = '<div class="ae-cal-head">';
      html += '<button class="ae-icon-btn" data-act="cal-prev" aria-label="Previous month">' + ICO.back + "</button>";
      html += "<span>" + label + "</span>";
      html += '<button class="ae-icon-btn" data-act="cal-next" aria-label="Next month">' + ICO.back.replace("<svg", '<svg style="transform:rotate(180deg)"') + "</button>";
      html += '</div><div class="ae-cal-grid">';
      var wds = ["S", "M", "T", "W", "T", "F", "S"], i, d, key, stars, future, cls;
      for (i = 0; i < 7; i++) html += '<div class="ae-cal-wd">' + wds[i] + "</div>";
      for (i = 0; i < start; i++) html += '<div class="ae-cal-d is-empty"></div>';
      for (d = 1; d <= days; d++) {
        key = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        stars = save.daily[key] | 0;
        future = key > today;
        cls = "ae-cal-d" + (future ? " is-future" : stars ? " is-done" : "") + (key === today ? " is-today" : "");
        html += '<button class="' + cls + '" data-act="cal-day" data-key="' + key + '"' + (future ? " disabled" : "") + ">" + d + "</button>";
      }
      html += '</div><div class="ae-row" style="margin-top:1.25rem"><button class="ae-btn" data-act="close">Close</button></div>';
      openCard(html, true);
    }

    function onAct(act, el) {
      audio.unlock();
      if (act === "help") {
        audio.tap();
        showHelp();
        return;
      }
      if (act === "sound") {
        commit(function (s) {
          var next = Object.assign({}, s, { sound: !s.sound });
          audio.setOn(next.sound);
          if (next.sound) audio.tap();
          return next;
        });
        renderHome();
        return;
      }
      if (act === "daily") {
        audio.tap();
        loadDaily();
        return;
      }
      if (act === "streak") {
        flash(save.perfect.cur + " in a row · best " + save.perfect.best);
        return;
      }
      if (act === "cal") {
        audio.tap();
        showCal();
        return;
      }
      if (act === "cal-prev") {
        state.cal = state.cal.m === 0 ? { y: state.cal.y - 1, m: 11 } : { y: state.cal.y, m: state.cal.m - 1 };
        showCal();
        return;
      }
      if (act === "cal-next") {
        state.cal = state.cal.m === 11 ? { y: state.cal.y + 1, m: 0 } : { y: state.cal.y, m: state.cal.m + 1 };
        showCal();
        return;
      }
      if (act === "cal-day") {
        var key = el.getAttribute("data-key");
        if (!key || key > dateKey()) return;
        hideOverlay();
        loadDaily(key);
        return;
      }
      if (act === "lvl") {
        var n = el.getAttribute("data-n") | 0;
        if (n > save.unlocked) {
          el.classList.add("is-deny");
          setTimeout(function () {
            el.classList.remove("is-deny");
          }, 320);
          flash("Clear the previous level first");
          return;
        }
        audio.tap();
        loadLevel(n);
        return;
      }
      if (act === "reset") {
        showReset();
        return;
      }
      if (act === "do-reset") {
        var keepSound = save.sound;
        save = defaults();
        save.sound = keepSound;
        persistSave(save);
        hideOverlay();
        renderHome();
        flash("Progress reset");
        return;
      }
      if (act === "close") {
        hideOverlay();
        return;
      }
      if (act === "back" || act === "map") {
        goHome();
        return;
      }
      if (act === "restart" || act === "replay") {
        audio.tap();
        if (state.mode === "daily") loadDaily(state.date);
        else loadLevel(state.level);
        return;
      }
      if (act === "next") {
        if (state.level >= TOTAL) {
          goHome();
          flash("You finished all 100 puzzles");
        } else loadLevel(state.level + 1);
        return;
      }
      if (act === "hint") {
        hint();
        return;
      }
      if (act === "zin") {
        board.zoomBy(1.25);
        return;
      }
      if (act === "zout") {
        board.zoomBy(1 / 1.25);
        return;
      }
      if (act === "zreset") {
        board.resetView();
      }
    }

    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-act]");
      if (!el || !root.contains(el)) return;
      onAct(el.getAttribute("data-act"), el);
    });

    global.addEventListener("keydown", function (e) {
      if (state.screen !== "play") return;
      if (e.key === "Escape") goHome();
      else if (e.key === "h" || e.key === "H") hint();
      else if (e.key === "r" || e.key === "R") {
        if (state.mode === "daily") loadDaily(state.date);
        else loadLevel(state.level);
      }
    });

    global.addEventListener("pointerdown", function () {
      audio.unlock();
    }, { once: true });

    document.addEventListener("visibilitychange", function () {
      persistSave(save);
    });

    renderHome();
    showScreen("home");

    var start = root.getAttribute("data-start") || "home";
    if (start === "daily") loadDaily();
  }

  function init() {
    var nodes = document.querySelectorAll("[data-arrow-escape]");
    for (var i = 0; i < nodes.length; i++) boot(nodes[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.ArrowEscapeWP = { init: init };
})(window);
