/* Arrow Escape — puzzle generator (classic script for WordPress). */
(function (global) {
"use strict";
/**
 * Arrow Escape — puzzle generator and rules.
 * Head = terminal cell; direction = last body segment.
 * Masks are exact silhouettes (Y-up, no row-convex smear).
 */
'use strict';

var DR = [-1, 0, 1, 0];
var DC = [0, 1, 0, -1];
var TOTAL_LEVELS = 100;
var DIFF_NAMES = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Expert', 'Super Hard', 'Insane', 'Extreme'];

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashCode(value) {
  var h = 2166136261 >>> 0;
  var s = String(value);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function shuffle(rng, values) {
  for (var i = values.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1)), t = values[i];
    values[i] = values[j];
    values[j] = t;
  }
  return values;
}

function exitCorridorClearOfOwnBody(cells, W, H, dir) {
  if (!cells || !cells.length) return false;
  var own = new Uint8Array(W * H);
  for (var i = 0; i < cells.length; i++) own[cells[i]] = 1;
  var head = cells[cells.length - 1];
  var r = Math.floor(head / W) + DR[dir];
  var c = head % W + DC[dir];
  while (r >= 0 && r < H && c >= 0 && c < W) {
    if (own[r * W + c]) return false;
    r += DR[dir];
    c += DC[dir];
  }
  return true;
}

function isContiguousPath(cells, W, H) {
  if (!cells || cells.length < 2) return false;
  for (var i = 1; i < cells.length; i++) {
    var a = cells[i - 1], b = cells[i];
    var ar = Math.floor(a / W), ac = a % W;
    var br = Math.floor(b / W), bc = b % W;
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return false;
  }
  return true;
}

function dirFrom(r1, c1, r2, c2) {
  var dr = r2 - r1, dc = c2 - c1;
  if (dr === -1) return 0;
  if (dr === 1) return 2;
  if (dc === -1) return 3;
  if (dc === 1) return 1;
  return 0;
}

function dirFromPath(path, W) {
  if (!path || path.length < 2) return 0;
  var p = path[path.length - 2], h = path[path.length - 1];
  return dirFrom(Math.floor(p / W), p % W, Math.floor(h / W), h % W);
}

function countTurns(arrow, boardW) {
  var cells = arrow.cells;
  if (cells.length < 3) return 0;
  var turns = 0;
  for (var i = 1; i < cells.length - 1; i++) {
    var d1 = dirFrom(Math.floor(cells[i - 1] / boardW), cells[i - 1] % boardW, Math.floor(cells[i] / boardW), cells[i] % boardW);
    var d2 = dirFrom(Math.floor(cells[i] / boardW), cells[i] % boardW, Math.floor(cells[i + 1] / boardW), cells[i + 1] % boardW);
    if (d1 !== d2) turns++;
  }
  return turns;
}

function exitDistance(dir, cx, cy, W, H) {
  var distToEdge;
  if (dir === 0) distToEdge = cy;
  else if (dir === 1) distToEdge = W - cx;
  else if (dir === 2) distToEdge = H - cy;
  else distToEdge = cx;
  return distToEdge;
}

/* Shape tests use math coordinates: x right, y up. */
function pointInPoly(x, y, pts) {
  var n = pts.length, inside = false;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    var inter = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}

function SH() {
  var S = {};
  function add(id, name, fn) { S[id] = { name: name, test: fn }; }
  add('rect', 'Classic', function () { return true; });
  add('round', 'Round', function (x, y) { return x * x + y * y <= 0.92; });
  add('diamond', 'Diamond', function (x, y) { return Math.abs(x) + Math.abs(y) <= 1.02; });
  add('heart', 'Heart', function (x, y) {
    var lobeL = (x + 0.36) * (x + 0.36) + (y - 0.42) * (y - 0.42) <= 0.168;
    var lobeR = (x - 0.36) * (x - 0.36) + (y - 0.42) * (y - 0.42) <= 0.168;
    var point = y <= 0.42 && y >= -0.96 && Math.abs(x) <= (y + 0.96) * 0.70;
    return lobeL || lobeR || point;
  });
  add('star', 'Star', function (x, y) {
    var a = Math.atan2(y, x);
    var r = Math.sqrt(x * x + y * y);
    var ang = a - Math.PI / 2;
    while (ang < 0) ang += Math.PI * 2;
    var sector = ang / (Math.PI * 2 / 5);
    var local = Math.abs((sector % 1) - 0.5) * 2;
    var rad = 0.44 + 0.54 * Math.pow(Math.max(0, 1 - local), 1.2);
    return r <= rad;
  });
  add('cross', 'Cross', function (x, y) { return Math.abs(x) < 0.28 || Math.abs(y) < 0.28; });
  add('triangle', 'Triangle', function (x, y) { return y <= 0.92 && y >= -0.88 && Math.abs(x) <= (0.92 - y) * 0.58; });
  add('wave', 'Wave', function (x, y) { return Math.abs(y - 0.22 * Math.sin(x * 5.2)) < 0.52; });
  add('leaf', 'Leaf', function (x, y) {
    var xx = x, yy = y - 0.06;
    return xx * xx / 0.42 + yy * yy / 0.92 <= 1 && yy > -0.95;
  });
  add('hexagon', 'Hexagon', function (x, y) { return Math.abs(x) <= 0.88 && Math.abs(y) <= 0.92 && Math.abs(x) * 0.58 + Math.abs(y) <= 1.02; });
  add('flower', 'Flower', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return r <= 0.42 + 0.38 * Math.abs(Math.cos(3 * a));
  });
  add('crescent', 'Crescent', function (x, y) { return x * x + y * y <= 0.90 && (x + 0.38) * (x + 0.38) + y * y >= 0.38; });
  add('clover', 'Clover', function (x, y) {
    var d = function (cx, cy) { return (x - cx) * (x - cx) + (y - cy) * (y - cy); };
    return Math.min(d(0, 0.52), d(0, -0.52), d(0.52, 0), d(-0.52, 0)) <= 0.122 || (x * x + y * y <= 0.055);
  });
  add('drop', 'Drop', function (x, y) {
    if (y > 0.18) return x * x + Math.pow(y - 0.18, 2) <= 0.38;
    return Math.abs(x) <= (y + 0.95) * 0.42;
  });
  add('kite', 'Kite', function (x, y) { return Math.abs(x) <= (y > 0 ? (1.05 - y) : (y + 1.05)) * 0.72; });
  add('shield', 'Shield', function (x, y) { return y > 0.15 ? Math.abs(x) < 0.72 : Math.abs(x) < (y + 1) * 0.95 && y > -0.95; });
  add('crown', 'Crown', function (x, y) {
    if (y < -0.15) return Math.abs(x) < 0.82 && y > -0.7;
    return y < 0.85 && (Math.abs(x) < 0.82) && (y < 0.22 || Math.abs(Math.abs(x) - 0.55) < 0.16 || Math.abs(x) < 0.16);
  });
  add('lightning', 'Lightning', function (x, y) { return Math.abs(x - 0.28 * Math.sign(y) * (1 - Math.abs(y))) < 0.30; });
  add('apple', 'Apple', function (x, y) {
    return x * x + Math.pow(y + 0.05, 2) < 0.68 && !(y > 0.42 && Math.abs(x) > 0.20);
  });
  add('butterfly', 'Butterfly', function (x, y) {
    return Math.pow(Math.abs(x) - 0.40, 2) / 0.22 + y * y / 0.68 < 1 || (Math.abs(x) < 0.14 && Math.abs(y) < 0.82);
  });
  add('fish', 'Fish', function (x, y) {
    return (x * x / 0.72 + y * y / 0.32 < 1) || (x < -0.52 && Math.abs(y) < 0.50 + x * 0.50);
  });
  add('arrow', 'Arrow', function (x, y) {
    var shaft = Math.abs(y) < 0.30 && x < 0.32;
    var head = x >= -0.05 && Math.abs(y) <= 0.88 * (1.02 - x) && x < 0.96;
    return shaft || head;
  });
  add('pyramid', 'Pyramid', function (x, y) { return y <= 0.92 && y >= -0.88 && Math.abs(x) <= (0.92 - y) * 0.58; });
  add('mango', 'Mango', function (x, y) { var xx = x - 0.12 * y; return xx * xx / 0.78 + (y + 0.04) * (y + 0.04) / 0.92 < 1; });
  add('strawberry', 'Strawberry', function (x, y) {
    return x * x / 0.62 + Math.pow(y + 0.08, 2) / 0.88 < 1 && !(y < -0.55 && Math.abs(x) > 0.42);
  });
  add('pineapple', 'Pineapple', function (x, y) {
    return (x * x / 0.42 + Math.pow(y + 0.12, 2) / 0.72 < 1) || (y > 0.42 && Math.abs(x) < 0.62 * (1.05 - y));
  });
  add('tree', 'Tree', function (x, y) {
    return (y > -0.12 && Math.abs(x) < 0.70 * (0.95 - y)) || (y <= -0.12 && Math.abs(x) < 0.16 && y > -0.95);
  });
  add('cloud', 'Cloud', function (x, y) {
    return Math.min(
      (x + 0.42) * (x + 0.42) + (y + 0.02) * (y + 0.02),
      x * x + (y - 0.18) * (y - 0.18),
      (x - 0.42) * (x - 0.42) + (y + 0.02) * (y + 0.02)
    ) < 0.42;
  });
  add('snowflake', 'Snowflake', function (x, y) {
    var r = Math.sqrt(x * x + y * y);
    if (r > 0.96) return false;
    var a = Math.atan2(y, x);
    var sector = Math.PI / 3;
    var ang = ((a % sector) + sector) % sector;
    var d = Math.min(ang, sector - ang);
    var arm = 0.18 + 0.10 * (1 - r);
    return r < 0.28 || d < arm || (Math.abs(Math.cos(3 * a)) < 0.22 && r < 0.72);
  });
  add('feather', 'Feather', function (x, y) {
    var yy = y + 0.12 * x;
    return x * x / 0.95 + yy * yy / 0.55 < 1 && y < 0.82;
  });
  add('flame', 'Flame', function (x, y) {
    return x * x / (0.38 + 0.22 * (y + 1)) + Math.pow(y + 0.05, 2) / 0.95 < 1 && y < 0.92;
  });
  add('lotus', 'Lotus', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return r < 0.40 + 0.42 * Math.abs(Math.sin(2.5 * a + 0.4));
  });
  add('tulip', 'Tulip', function (x, y) {
    if (y < 0.05) return Math.abs(x) < 0.16 && y > -0.92;
    return Math.abs(x) < 0.55 * (1.05 - y) && y < 0.92;
  });
  add('car', 'Car', function (x, y) {
    return (Math.abs(x) < 0.88 && y < 0.18 && y > -0.42) || (Math.abs(x) < 0.58 && y >= 0.18 && y < 0.52);
  });
  add('airplane', 'Airplane', function (x, y) {
    return Math.abs(y) < 0.14 || Math.abs(x) < 0.14 || (Math.abs(x) < 0.72 && Math.abs(y) < 0.42 && y > -0.08);
  });
  add('helicopter', 'Helicopter', function (x, y) {
    return (Math.abs(y + 0.02) < 0.18 && Math.abs(x) < 0.70) || (Math.abs(x) < 0.14 && Math.abs(y) < 0.62) || Math.abs(y - 0.72) < 0.10;
  });
  add('bicycle', 'Bicycle', function (x, y) {
    var l = Math.abs(Math.sqrt((x - 0.46) * (x - 0.46) + (y + 0.22) * (y + 0.22)) - 0.28);
    var r = Math.abs(Math.sqrt((x + 0.46) * (x + 0.46) + (y + 0.22) * (y + 0.22)) - 0.28);
    return l < 0.12 || r < 0.12 || (Math.abs(y + 0.18) < 0.10 && Math.abs(x) < 0.50);
  });
  add('motorcycle', 'Motorcycle', function (x, y) {
    return (Math.abs(x) < 0.82 && y < 0.12 && y > -0.42) || (Math.abs(x) < 0.22 && y < 0.42 && y > -0.1);
  });
  add('boat', 'Boat', function (x, y) {
    return (y < 0.15 && y > -0.55 && Math.abs(x) < 0.82 - 0.25 * (y + 0.55)) || (y >= 0.15 && Math.abs(x) < 0.12 && y < 0.78);
  });
  add('submarine', 'Submarine', function (x, y) {
    return x * x / 0.92 + y * y / 0.32 < 1 || (Math.abs(x) < 0.12 && y > 0 && y < 0.72);
  });
  add('rocket', 'Rocket', function (x, y) {
    return (y > -0.2 && Math.abs(x) < 0.28 * (0.95 - y)) || (y <= -0.2 && Math.abs(x) < 0.42 + 0.4 * (y + 0.2) && y > -0.85);
  });
  add('train', 'Train', function (x, y) {
    return (Math.abs(x) < 0.88 && y < 0.22 && y > -0.38) || (x > 0.35 && y >= 0.22 && y < 0.55 && x < 0.88);
  });
  add('bird', 'Bird', function (x, y) {
    return Math.abs(y - 0.18 * Math.sin(x * 4)) < 0.28 + 0.18 * (1 - Math.abs(x)) || (x > 0.35 && Math.abs(y) < 0.22);
  });
  add('cat', 'Cat', function (x, y) {
    var head = x * x / 0.68 + Math.pow(y + 0.12, 2) / 0.50 < 1;
    var earL = (x + 0.32) * (x + 0.32) / 0.10 + Math.pow(y - 0.48, 2) / 0.22 <= 1 && y > 0.18;
    var earR = (x - 0.32) * (x - 0.32) / 0.10 + Math.pow(y - 0.48, 2) / 0.22 <= 1 && y > 0.18;
    return head || earL || earR;
  });
  add('dog', 'Dog', function (x, y) {
    return x * x / 0.72 + Math.pow(y + 0.05, 2) / 0.58 < 1 || (x > 0.35 && Math.abs(y + 0.15) < 0.18);
  });
  add('elephant', 'Elephant', function (x, y) {
    return x * x / 0.78 + Math.pow(y + 0.08, 2) / 0.62 < 1 || (x < -0.35 && y < 0.05 && y > -0.85 && Math.abs(x + 0.55) < 0.18);
  });
  add('turtle', 'Turtle', function (x, y) {
    return x * x / 0.72 + y * y / 0.48 < 1 || (Math.abs(x) > 0.55 && Math.abs(y) < 0.18) || (Math.abs(y) > 0.42 && Math.abs(x) < 0.18);
  });
  add('paw', 'Paw Print', function (x, y) {
    var d = function (cx, cy, rr) { return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr; };
    return d(0, -0.28, 0.22) || d(-0.38, 0.22, 0.10) || d(-0.14, 0.42, 0.10) || d(0.14, 0.42, 0.10) || d(0.38, 0.22, 0.10);
  });
  add('horseshoe', 'Horseshoe', function (x, y) {
    var r = Math.sqrt(x * x + (y + 0.05) * (y + 0.05));
    return r <= 0.82 && r >= 0.48 && !(y < -0.05 && Math.abs(x) < 0.28);
  });
  add('whale', 'Whale', function (x, y) {
    return x * x / 0.85 + Math.pow(y + 0.12, 2) / 0.38 < 1 || (x > 0.45 && y > 0.05 && y < 0.55 && Math.abs(x - 0.55) < 0.28);
  });
  add('dolphin', 'Dolphin', function (x, y) {
    return x * x / 0.78 + y * y / 0.32 < 1 || (x > 0.2 && y > 0.1 && y < 0.62 && Math.abs(x - 0.15) < 0.22);
  });
  add('snake', 'Snake', function (x, y) { return Math.abs(y - 0.28 * Math.sin(x * 6)) < 0.22; });
  add('bear', 'Bear', function (x, y) {
    var head = x * x + Math.pow(y + 0.08, 2) < 0.52;
    var earL = (x + 0.38) * (x + 0.38) + (y - 0.42) * (y - 0.42) < 0.08;
    var earR = (x - 0.38) * (x - 0.38) + (y - 0.42) * (y - 0.42) < 0.08;
    return head || earL || earR;
  });
  add('rabbit', 'Rabbit', function (x, y) {
    var head = x * x + Math.pow(y + 0.18, 2) < 0.38;
    var earL = Math.abs(x + 0.18) < 0.12 && y > 0.15 && y < 0.92;
    var earR = Math.abs(x - 0.18) < 0.12 && y > 0.15 && y < 0.92;
    return head || earL || earR;
  });
  add('bat', 'Bat', function (x, y) {
    return Math.abs(y) < 0.22 + 0.42 * Math.pow(1 - Math.abs(x), 0.7) && Math.abs(x) < 0.95;
  });
  add('spider', 'Spider', function (x, y) {
    var body = x * x / 0.22 + y * y / 0.18 < 1;
    var legs = (Math.abs(Math.abs(y) - 0.42 * Math.abs(x)) < 0.10 && Math.abs(x) < 0.92);
    return body || legs;
  });
  add('crab', 'Crab', function (x, y) {
    return x * x / 0.72 + Math.pow(y + 0.12, 2) / 0.32 < 1 || (Math.abs(x) > 0.45 && y > 0.05 && y < 0.55);
  });
  add('octopus', 'Octopus', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return (y > -0.05 && r < 0.42) || (y <= 0.1 && Math.abs(Math.sin(4 * a)) < 0.35 && r < 0.92);
  });
  add('dragonfly', 'Dragonfly', function (x, y) {
    return Math.abs(x) < 0.12 || (Math.abs(y - 0.22) < 0.18 && Math.abs(x) < 0.85) || (Math.abs(y + 0.22) < 0.18 && Math.abs(x) < 0.85);
  });
  add('snail', 'Snail', function (x, y) {
    var shell = Math.abs(Math.sqrt((x - 0.12) * (x - 0.12) + y * y) - 0.38) < 0.16;
    var body = y < -0.15 && Math.abs(x) < 0.72 && y > -0.55;
    return shell || body;
  });
  add('penguin', 'Penguin', function (x, y) {
    return x * x / 0.42 + Math.pow(y + 0.05, 2) / 0.88 < 1 && !(y > 0.45 && Math.abs(x) > 0.22);
  });
  add('duck', 'Duck', function (x, y) {
    return x * x / 0.62 + Math.pow(y + 0.12, 2) / 0.42 < 1 || (x > 0.25 && Math.abs(y - 0.22) < 0.16);
  });
  add('frog', 'Frog', function (x, y) {
    return x * x / 0.72 + Math.pow(y + 0.1, 2) / 0.48 < 1 || (Math.abs(x) > 0.35 && y > 0.18 && y < 0.52);
  });
  add('jellyfish', 'Jellyfish', function (x, y) {
    return (y > 0 && x * x / 0.62 + y * y / 0.42 < 1) || (y <= 0 && Math.abs(Math.sin(x * 8)) * 0.55 > -y && Math.abs(x) < 0.62);
  });
  add('eagle', 'Eagle', function (x, y) {
    return Math.abs(y - 0.12 * Math.sin(x * 3)) < 0.22 + 0.28 * (1 - Math.abs(x));
  });
  add('key', 'Key', function (x, y) {
    return (x * x + Math.pow(y - 0.42, 2) < 0.16) || (Math.abs(x) < 0.12 && y < 0.42 && y > -0.85) || (y < -0.55 && x > 0 && x < 0.42 && Math.abs(y + 0.62) < 0.12);
  });
  add('anchor', 'Anchor', function (x, y) {
    return Math.abs(x) < 0.12 || (y < -0.35 && Math.abs(Math.abs(x) + (y + 0.2)) < 0.22 && Math.abs(x) < 0.72) || (y > 0.45 && x * x + Math.pow(y - 0.55, 2) < 0.12);
  });
  add('bell', 'Bell', function (x, y) {
    return (y > -0.15 && x * x / 0.55 + Math.pow(y - 0.15, 2) / 0.62 < 1) || (Math.abs(x) < 0.42 && y <= -0.15 && y > -0.55);
  });
  add('umbrella', 'Umbrella', function (x, y) {
    return (y > 0.05 && x * x / 0.92 + Math.pow(y - 0.15, 2) / 0.42 < 1) || (Math.abs(x) < 0.10 && y < 0.2 && y > -0.85);
  });
  add('lightbulb', 'Lightbulb', function (x, y) {
    return (y > -0.15 && x * x + Math.pow(y - 0.15, 2) < 0.48) || (Math.abs(x) < 0.22 && y <= -0.15 && y > -0.72);
  });
  add('lock', 'Lock', function (x, y) {
    return (y < 0.12 && Math.abs(x) < 0.48 && y > -0.72) || (y >= 0.12 && Math.abs(Math.sqrt(x * x + Math.pow(y - 0.38, 2)) - 0.28) < 0.12);
  });
  add('bottle', 'Bottle', function (x, y) {
    return (y < 0.22 && Math.abs(x) < 0.38 && y > -0.88) || (y >= 0.22 && Math.abs(x) < 0.16 && y < 0.85);
  });
  add('guitar', 'Guitar', function (x, y) {
    return (y < 0.05 && x * x / 0.42 + Math.pow(y + 0.28, 2) / 0.55 < 1) || (Math.abs(x) < 0.12 && y > 0 && y < 0.92);
  });
  add('mug', 'Coffee Mug', function (x, y) {
    return (Math.abs(x) < 0.42 && Math.abs(y) < 0.55) || (x > 0.32 && Math.abs(Math.sqrt((x - 0.48) * (x - 0.48) + y * y) - 0.22) < 0.10);
  });
  add('gem', 'Gem', function (x, y) { return Math.abs(x) + Math.abs(y) <= 0.95 && Math.abs(y) < 0.72; });
  add('house', 'House', function (x, y) {
    return (y < 0.05 && Math.abs(x) < 0.62 && y > -0.72) || (y >= 0.05 && Math.abs(x) <= (0.95 - y) * 0.95 && y < 0.85);
  });
  add('clock', 'Clock', function (x, y) { return x * x + y * y <= 0.82 && (x * x + y * y >= 0.55 || Math.abs(x) < 0.08 || (y > 0 && Math.abs(x) < 0.08)); });
  add('gear', 'Gear', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return r <= 0.52 + 0.22 * Math.pow(Math.abs(Math.cos(4 * a)), 3) && r >= 0.18;
  });
  add('sun', 'Sun', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return r < 0.50 || (r < 0.94 && Math.cos(8 * a) > 0.34);
  });
  add('moon', 'Moon', function (x, y) {
    return (x + 0.10) * (x + 0.10) + y * y <= 0.86 && (x - 0.36) * (x - 0.36) + y * y >= 0.48;
  });
  add('pentagon', 'Pentagon', function (x, y) {
    return Math.abs(x) < 0.80 && y > -0.82 && y < 0.90 && Math.abs(x) <= 0.80 - 0.32 * Math.max(0, y - 0.12);
  });
  add('octagon', 'Octagon', function (x, y) {
    return Math.abs(x) <= 0.86 && Math.abs(y) <= 0.86 && Math.abs(x) + Math.abs(y) <= 1.24;
  });
  add('ring', 'Ring', function (x, y) {
    var r2 = x * x + y * y;
    return r2 <= 0.90 && r2 >= 0.26;
  });
  add('hourglass', 'Hourglass', function (x, y) {
    return Math.abs(x) <= 0.20 + 0.62 * Math.abs(y) && Math.abs(y) < 0.88;
  });
  add('spade', 'Spade', function (x, y) {
    var lobe = Math.pow(Math.abs(x) - 0.20, 2) / 0.20 + Math.pow(y - 0.22, 2) / 0.32 < 1;
    var tip = y < 0.18 && Math.abs(x) <= Math.max(0.08, (0.22 - y) * 0.85) && y > -0.48;
    var stem = y <= -0.42 && Math.abs(x) < 0.16 && y > -0.92;
    return lobe || tip || stem;
  });
  add('balloon', 'Balloon', function (x, y) {
    return x * x + Math.pow(y - 0.22, 2) < 0.46 || (y < -0.38 && Math.abs(x) < 0.10 && y > -0.95);
  });
  add('mushroom', 'Mushroom', function (x, y) {
    return (y > 0.02 && x * x / 0.84 + Math.pow(y - 0.30, 2) / 0.44 < 1) || (y <= 0.10 && Math.abs(x) < 0.24 && y > -0.85);
  });
  add('cactus', 'Cactus', function (x, y) {
    var stem = Math.abs(x) < 0.20 && y > -0.88 && y < 0.88;
    var armL = x < 0 && x > -0.68 && ((Math.abs(y - 0.22) < 0.16 && x > -0.58) || (x < -0.36 && y > 0.16 && y < 0.70));
    var armR = x > 0 && x < 0.64 && ((Math.abs(y + 0.06) < 0.16 && x < 0.54) || (x > 0.30 && y > -0.08 && y < 0.46));
    return stem || armL || armR;
  });
  add('mountain', 'Mountain', function (x, y) {
    var left = Math.abs(x + 0.28) <= (0.58 - y) * 0.62 && y < 0.58 && y > -0.82;
    var right = Math.abs(x - 0.34) <= (0.38 - y) * 0.58 && y < 0.38 && y > -0.82;
    var base = y < -0.42 && Math.abs(x) < 0.90 && y > -0.88;
    return left || right || base;
  });
  add('pear', 'Pear', function (x, y) {
    return x * x / (y > 0.12 ? 0.28 : 0.62) + Math.pow(y + 0.08, 2) / 0.88 < 1;
  });
  add('cherry', 'Cherry', function (x, y) {
    var fruit = Math.pow(x + 0.22, 2) + Math.pow(y + 0.22, 2) < 0.22 || Math.pow(x - 0.26, 2) + Math.pow(y + 0.18, 2) < 0.20;
    var stem = y > 0.05 && Math.abs(x - 0.08 * y) < 0.10 && y < 0.82;
    return fruit || stem;
  });
  add('hat', 'Hat', function (x, y) {
    return (y > 0.02 && y < 0.62 && Math.abs(x) < 0.48) || (Math.abs(y + 0.02) < 0.12 && Math.abs(x) < 0.88);
  });
  add('boot', 'Boot', function (x, y) {
    return (x < 0.18 && Math.abs(x + 0.10) < 0.32 && y > -0.55 && y < 0.82) || (y < -0.38 && x > -0.42 && x < 0.82 && y > -0.72);
  });
  add('glasses', 'Glasses', function (x, y) {
    var lens = Math.pow(Math.abs(x) - 0.38, 2) / 0.16 + y * y / 0.14 < 1;
    var bridge = Math.abs(y) < 0.08 && Math.abs(x) < 0.22;
    return lens || bridge;
  });
  add('bone', 'Bone', function (x, y) {
    var shaft = Math.abs(y) < 0.16 && Math.abs(x) < 0.62;
    var knob = Math.pow(Math.abs(x) - 0.62, 2) / 0.12 + Math.pow(Math.abs(y) - 0.16, 2) / 0.12 < 1;
    return shaft || knob;
  });
  add('comet', 'Comet', function (x, y) {
    var head = Math.pow(x - 0.38, 2) + Math.pow(y - 0.32, 2) < 0.22;
    var tail = y < 0.38 && x < 0.38 && Math.abs(y - x) < 0.28 && x > -0.88 && y > -0.88;
    return head || tail;
  });
  add('arch', 'Arch', function (x, y) {
    var r = Math.sqrt(x * x + Math.pow(Math.max(y, 0), 2));
    return (r <= 0.88 && r >= 0.42 && y > -0.12) || (y <= 0 && Math.abs(Math.abs(x) - 0.65) < 0.23 && y > -0.82);
  });
  add('chevron', 'Chevron', function (x, y) {
    return Math.abs(Math.abs(x) - 0.22 + 0.55 * y) < 0.22 && Math.abs(y) < 0.82;
  });
  add('acorn', 'Acorn', function (x, y) {
    var cap = y > 0.18 && y < 0.62 && Math.abs(x) < 0.52;
    var nut = y <= 0.28 && x * x / 0.48 + Math.pow(y + 0.18, 2) / 0.62 < 1;
    return cap || nut;
  });
  add('maple', 'Maple', function (x, y) {
    var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
    return r < 0.42 || (r < 0.92 && Math.abs(Math.cos(5 * a)) > 0.28);
  });
  add('vest', 'Vest', function (x, y) {
    return Math.abs(x) < 0.58 && y < 0.72 && y > -0.82 && !(y > 0.28 && Math.abs(x) < 0.16) && Math.abs(x) <= 0.42 + 0.16 * (y + 0.82);
  });
  return S;
}
var SHAPES = SH();
var CAMPAIGN_SHAPES = [
  'heart', 'star', 'diamond', 'arrow', 'pyramid', 'apple', 'mango', 'strawberry',
  'pineapple', 'leaf', 'tree', 'flower', 'cloud', 'snowflake', 'feather', 'flame',
  'drop', 'clover', 'lotus', 'tulip',
  'round', 'triangle', 'hexagon', 'crescent', 'kite', 'shield', 'crown', 'lightning',
  'butterfly', 'fish', 'sun', 'moon', 'pentagon', 'octagon', 'ring', 'hourglass',
  'spade', 'balloon', 'mushroom', 'cactus',
  'cross', 'wave', 'mountain', 'pear', 'cherry', 'hat', 'boot', 'glasses',
  'bone', 'comet', 'arch', 'chevron', 'acorn', 'maple', 'vest', 'car',
  'airplane', 'rocket', 'boat', 'train', 'bicycle', 'helicopter', 'motorcycle', 'submarine',
  'bird', 'cat', 'dog', 'rabbit', 'bear', 'turtle', 'elephant', 'whale',
  'dolphin', 'penguin', 'duck', 'frog', 'eagle', 'bat', 'snake', 'paw',
  'horseshoe', 'spider', 'crab', 'octopus', 'dragonfly', 'snail', 'jellyfish', 'key',
  'anchor', 'bell', 'umbrella', 'lightbulb', 'lock', 'bottle', 'guitar', 'mug',
  'gem', 'house', 'clock', 'gear'
];
var SHAPE_IDS = Object.keys(SHAPES);

function largestComponent(raw, W, H) {
  var seen = new Uint8Array(W * H), best = [], bestN = 0;
  for (var i = 0; i < raw.length; i++) {
    if (!raw[i] || seen[i]) continue;
    var stack = [i], comp = [];
    seen[i] = 1;
    while (stack.length) {
      var cur = stack.pop();
      comp.push(cur);
      var r = Math.floor(cur / W), c = cur % W;
      for (var d = 0; d < 4; d++) {
        var nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
        var ni = nr * W + nc;
        if (!raw[ni] || seen[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (comp.length > bestN) { bestN = comp.length; best = comp; }
  }
  var out = new Uint8Array(W * H);
  for (i = 0; i < best.length; i++) out[best[i]] = 1;
  return out;
}

function makeMask(W, H, shapeId) {
  var shape = SHAPES[shapeId] || SHAPES.diamond;
  var raw = new Uint8Array(W * H);
  var r, c;
  for (r = 0; r < H; r++) {
    for (c = 0; c < W; c++) {
      var x = (c + 0.5) / W * 2 - 1;
      var y = 1 - (r + 0.5) / H * 2;
      if (shape.test(x, y)) raw[r * W + c] = 1;
    }
  }
  var mask = largestComponent(raw, W, H);
  var count = 0;
  for (r = 0; r < mask.length; r++) if (mask[r]) count++;
  var minCells = Math.min(18, W * H - 2);
  var pass;
  for (pass = 0; pass < 3 && count < minCells; pass++) {
    var grown = mask.slice();
    for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
      if (mask[r * W + c]) continue;
      var hit = 0;
      for (var d = 0; d < 4 && !hit; d++) {
        var nr = r + DR[d], nc = c + DC[d];
        if (nr >= 0 && nr < H && nc >= 0 && nc < W && mask[nr * W + nc]) hit = 1;
      }
      if (hit) grown[r * W + c] = 1;
    }
    mask = largestComponent(grown, W, H);
    count = 0;
    for (r = 0; r < mask.length; r++) if (mask[r]) count++;
  }
  var play = new Array(W * H);
  for (r = 0; r < mask.length; r++) play[r] = !!mask[r];
  return play;
}

function shapeFor(level) {
  var i = Math.max(1, Math.min(TOTAL_LEVELS, level | 0)) - 1;
  return CAMPAIGN_SHAPES[i];
}

function getLevelDimensions(level) {
  var l = Math.max(1, Math.min(TOTAL_LEVELS, level | 0));
  var w = 12, h = 12, n;
  for (n = 2; n <= l; n++) {
    if ((n % 2) === 0) w = Math.min(32, w + 1);
    else h = Math.min(32, h + 1);
  }
  return { W: w, H: h };
}

function getDensity(level) {
  var l = level | 0;
  if (l <= 5) return 1;
  if (l <= 15) return 1;
  return 1;
}

function getArrowMix(level) {
  var l = level | 0;
  if (l <= 10) return { small: 0.46, medium: 0.40, long: 0.14, turn: 0.78 };
  if (l <= 30) return { small: 0.38, medium: 0.42, long: 0.20, turn: 0.82 };
  if (l <= 50) return { small: 0.32, medium: 0.42, long: 0.26, turn: 0.86 };
  if (l <= 75) return { small: 0.28, medium: 0.40, long: 0.32, turn: 0.88 };
  return { small: 0.24, medium: 0.40, long: 0.36, turn: 0.90 };
}

function difficultyName(level) {
  var l = Math.max(1, level | 0);
  if (l <= 8) return DIFF_NAMES[0];
  if (l <= 20) return DIFF_NAMES[1];
  if (l <= 36) return DIFF_NAMES[2];
  if (l <= 52) return DIFF_NAMES[3];
  if (l <= 68) return DIFF_NAMES[4];
  if (l <= 80) return DIFF_NAMES[5];
  if (l <= 92) return DIFF_NAMES[6];
  return DIFF_NAMES[7];
}

function getLevelConfig(level) {
  var dims = getLevelDimensions(level);
  var shapeId = shapeFor(level);
  var mask = makeMask(dims.W, dims.H, shapeId);
  var density = getDensity(level), usableCells = 0, i;
  for (i = 0; i < mask.length; i++) if (mask[i]) usableCells++;
  var mix = getArrowMix(level);
  var avgLen = 3 * mix.small + 7 * mix.medium + 16 * mix.long;
  var targetCells = Math.floor(usableCells * density);
  var N = Math.max(3, Math.min(650, Math.floor(targetCells / Math.max(3, avgLen))));
  return {
    W: dims.W, H: dims.H, N: N, lives: 3, len: [2, 32], isExtreme: level > 90,
    tier: 0, name: 'Level ' + level, level: level, shapeId: shapeId,
    shapeName: SHAPES[shapeId].name, mask: mask, density: density,
    targetCells: targetCells, arrowMix: mix, diffName: difficultyName(level)
  };
}

function dailyConfig(dateKey) {
  var key = dateKey || '1970-01-01';
  var rng = mulberry32(hashCode('arrow-daily-cfg:' + key));
  var W = 50 + Math.floor(rng() * 31);
  var H = 50 + Math.floor(rng() * 31);
  var pool = SHAPE_IDS.filter(function (id) { return id !== 'rect'; });
  var shapeId = pool[Math.floor(rng() * pool.length)] || 'star';
  var mask = makeMask(W, H, shapeId);
  var mix = { small: 0.18, medium: 0.34, long: 0.48, turn: 0.92 };
  var usableCells = 0, i;
  for (i = 0; i < mask.length; i++) if (mask[i]) usableCells++;
  var avgLen = 3 * mix.small + 7 * mix.medium + 18 * mix.long;
  var targetCells = usableCells;
  var N = Math.max(12, Math.min(900, Math.floor(targetCells / Math.max(3, avgLen))));
  return {
    W: W, H: H, N: N, lives: 3, len: [2, 48], isExtreme: true,
    tier: 0, name: 'Daily', level: 100, shapeId: shapeId,
    shapeName: (SHAPES[shapeId] && SHAPES[shapeId].name) || 'Star', mask: mask, density: 1,
    targetCells: targetCells, arrowMix: mix, diffName: 'Extreme'
  };
}

function difficultyFor(level) { return getLevelConfig(level); }

function arrowBlocked(puzzle, alive, arrow) {
  var own = {}, occupied = {}, i, j, head = arrow.cells[arrow.cells.length - 1];
  for (i = 0; i < arrow.cells.length; i++) own[arrow.cells[i]] = true;
  for (i = 0; i < alive.length; i++) if (alive[i].id !== arrow.id)
    for (j = 0; j < alive[i].cells.length; j++) occupied[alive[i].cells[j]] = true;
  for (var r = Math.floor(head / puzzle.W) + DR[arrow.dir], c = head % puzzle.W + DC[arrow.dir];
    r >= 0 && r < puzzle.H && c >= 0 && c < puzzle.W; r += DR[arrow.dir], c += DC[arrow.dir]) {
    if (occupied[r * puzzle.W + c] && !own[r * puzzle.W + c]) return true;
  }
  return false;
}

function simulateSolution(puzzle) {
  var alive = puzzle.arrows.slice();
  for (var i = 0; i < puzzle.solutionOrder.length; i++) {
    var arrow = null;
    for (var k = 0; k < alive.length; k++) if (alive[k].id === puzzle.solutionOrder[i]) { arrow = alive[k]; break; }
    if (!arrow || arrowBlocked(puzzle, alive, arrow)) return false;
    alive.splice(alive.indexOf(arrow), 1);
  }
  return alive.length === 0;
}

function findSolutionOrder(arrows, W, H) {
  var n = arrows.length, owner = new Int32Array(W * H), i, j;
  for (i = 0; i < owner.length; i++) owner[i] = -1;
  for (i = 0; i < n; i++) for (j = 0; j < arrows[i].cells.length; j++) owner[arrows[i].cells[j]] = i;
  var deps = [], dependents = [];
  for (i = 0; i < n; i++) {
    deps[i] = {}; dependents[i] = [];
    var head = arrows[i].cells[arrows[i].cells.length - 1];
    var row = Math.floor(head / W) + DR[arrows[i].dir], col = head % W + DC[arrows[i].dir];
    while (row >= 0 && row < H && col >= 0 && col < W) {
      var blocker = owner[row * W + col];
      if (blocker !== -1 && blocker !== i) deps[i][blocker] = true;
      row += DR[arrows[i].dir]; col += DC[arrows[i].dir];
    }
  }
  var depCount = [], ready = [], order = [];
  for (i = 0; i < n; i++) {
    depCount[i] = Object.keys(deps[i]).length;
    for (var key in deps[i]) dependents[+key].push(i);
    if (depCount[i] === 0) ready.push(i);
  }
  while (ready.length) {
    var current = ready.pop();
    order.push(arrows[current].id);
    for (j = 0; j < dependents[current].length; j++) {
      var next = dependents[current][j];
      if (--depCount[next] === 0) ready.push(next);
    }
  }
  return order.length === n ? order : null;
}

function calculateDifficultyMetrics(arrows, W, H, mask, solutionOrder) {
  var n = arrows.length, total = 0, maxPathLength = 0, numberOfTurns = 0, i, j;
  for (i = 0; i < n; i++) {
    total += arrows[i].cells.length;
    maxPathLength = Math.max(maxPathLength, arrows[i].cells.length);
    numberOfTurns += countTurns(arrows[i], W);
  }
  var owner = new Int32Array(W * H);
  for (i = 0; i < owner.length; i++) owner[i] = -1;
  for (i = 0; i < n; i++) for (j = 0; j < arrows[i].cells.length; j++) owner[arrows[i].cells[j]] = i;
  var dependencyCount = 0, availableFirstMoves = 0;
  for (i = 0; i < n; i++) {
    var deps = {}, h = arrows[i].cells[arrows[i].cells.length - 1];
    var r = Math.floor(h / W) + DR[arrows[i].dir], c = h % W + DC[arrows[i].dir];
    while (r >= 0 && r < H && c >= 0 && c < W) {
      var b = owner[r * W + c];
      if (b >= 0 && b !== i) deps[b] = 1;
      r += DR[arrows[i].dir]; c += DC[arrows[i].dir];
    }
    var dk = Object.keys(deps).length;
    dependencyCount += dk;
    if (dk === 0) availableFirstMoves++;
  }
  var maskCells = 0;
  for (i = 0; i < mask.length; i++) if (mask[i]) maskCells++;
  var density = maskCells ? total / maskCells : 0;
  var score = Math.round(Math.max(8, Math.min(96,
    density * 18 + Math.min(40, n) * 0.7 + numberOfTurns * 1.4 + (n - availableFirstMoves) * 0.8
  )));
  return {
    arrowCount: n, density: density, averagePathLength: n ? total / n : 0,
    maxPathLength: maxPathLength, numberOfTurns: numberOfTurns,
    blockingDepth: 0, dependencyCount: dependencyCount, branchingFactor: 0,
    decoyMoves: Math.max(0, n - availableFirstMoves),
    solutionLength: solutionOrder ? solutionOrder.length : 0,
    shapeComplexity: numberOfTurns, availableFirstMoves: availableFirstMoves,
    difficultyScore: score
  };
}

var CORE_PATTERNS = [[[8,3,4],[9,14,19,24,23,18],[13,12,17,22,21,20,15],[16,11,10,5,0,1,6,7,2]],[[4,9,14,19,24,23],[18,13,8,3,2,7],[12,17,22,21,20,15,16],[11,10,5,6,1,0]],[[10,15,20,21],[22,23,24,19,18],[17,16,11,12,13,14,9],[4,3,8,7,2,1,0,5,6]],[[14,9,4,3],[2,1,0,5,6],[7,8,13,12,11,10,15],[20,21,16,17,22,23,24,19,18]],[[24,19,14,9,4,3],[2,1,0,5,6],[7,8,13,12,11,10,15],[20,21,16,17,18,23,22]],[[12,11,10,15],[20,21,16,17],[22,23,24,19,18,13],[14,9,4,3,8,7,2,1,6,5,0]],[[12,17,22,23],[24,19,18,13],[14,9,4,3,8,7],[2,1,0,5,6,11,10,15,20,21,16]],[[6,1,0],[5,10,15,20,21,16],[11,12,7,2,3,4,9],[8,13,14,19,24,23,22,17,18]],[[16,21,20],[15,10,11,12,17],[22,23,24,19,18,13],[14,9,4,3,8,7,2,1,0,5,6]],[[16,15,20],[21,22,23,24,19,14,9,4,3],[8,13,18,17,12,11],[10,5,0,1,6,7,2]],[[6,1,0],[5,10,11,16],[15,20,21,22,23,24,19,14,9,4,3],[2,7,8,13,18,17,12]],[[16,15,20],[21,22,23,24,19,14,9,4,3],[2,1,0,5,10,11,6],[7,8,13,12,17,18]],[[16,21,20],[15,10,5,0,1,2,3,4,9],[14,19,24,23,22,17,18],[13,8,7,12,11,6]],[[2,1,0,5],[10,15,20,21,22,23,24,19],[14,9,4,3,8,7],[6,11,16,17,12,13,18]],[[22,23,24,19],[14,9,4,3,2,1,0,5],[10,15,20,21,16,17],[18,13,8,7,12,11,6]],[[6,5,0],[1,2,7,8],[3,4,9,14,13,12,11,10,15],[20,21,16,17,22,23,18,19,24]],[[12,7,2,3],[4,9,8,13],[14,19,24,23,18,17],[22,21,20,15,16,11,10,5,0,1,6]],[[16,21,20],[15,10,5,0,1,6],[11,12,17,22,23,24,19],[18,13,14,9,4,3,2,7,8]],[[22,21,20,15],[10,5,0,1,2,3,4,9],[8,7,6,11,16,17,12],[13,14,19,18,23,24]],[[12,17,22,21],[20,15,16,11],[10,5,0,1,6,7],[2,3,4,9,8,13,14,19,18,23,24]]];

function walkStyledPath(mask, blocked, W, H, start, targetTurns, minLen, maxLen, rng) {
  var path = [start], used = new Uint8Array(W * H), lastDir = -1, turns = 0, guard = 0;
  used[start] = 1;
  while (path.length < maxLen && guard++ < 120) {
    var cur = path[path.length - 1], r = Math.floor(cur / W), c = cur % W, opts = [];
    for (var d = 0; d < 4; d++) {
      var nr = r + DR[d], nc = c + DC[d];
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      var ni = nr * W + nc;
      if (!mask[ni] || blocked[ni] || used[ni]) continue;
      var isTurn = lastDir >= 0 && d !== lastDir;
      if (turns + (isTurn ? 1 : 0) > targetTurns) continue;
      opts.push({ d: d, ni: ni, turn: isTurn });
    }
    if (!opts.length) break;
    var preferTurn = turns < targetTurns;
    var ranked = [];
    for (var i = 0; i < opts.length; i++) {
      if (preferTurn ? opts[i].turn : !opts[i].turn) ranked.push(opts[i]);
    }
    if (!ranked.length) ranked = opts;
    var pick = ranked[Math.floor(rng() * ranked.length)];
    if (lastDir >= 0 && pick.d !== lastDir) turns++;
    path.push(pick.ni);
    used[pick.ni] = 1;
    lastDir = pick.d;
    if (turns >= targetTurns && path.length >= minLen) break;
  }
  if (path.length < minLen || turns < targetTurns) return null;
  var dir = dirFromPath(path, W);
  if (exitCorridorClearOfOwnBody(path, W, H, dir) && isContiguousPath(path, W, H)) return { cells: path, dir: dir };
  var rev = path.slice().reverse();
  var rd = dirFromPath(rev, W);
  if (exitCorridorClearOfOwnBody(rev, W, H, rd) && isContiguousPath(rev, W, H)) return { cells: rev, dir: rd };
  return null;
}

var STYLE_TEMPLATES = {
  L: [
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [1, 1]]
  ],
  U: [
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]],
    [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]],
    [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1]]
  ],
  R: [
    [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [0, 3]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [2, 3]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [2, 3]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [0, 3]]
  ],
  M: [
    [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [0, 2], [0, 3], [1, 3]],
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [1, 2], [1, 3]],
    [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 1], [3, 1], [3, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1], [2, 0], [3, 0], [3, 1], [3, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [2, 1], [2, 2], [2, 3]]
  ]
};

function rotateDelta(dc, dr, rot) {
  for (var i = 0; i < rot; i++) { var t = dc; dc = -dr; dr = t; }
  return [dc, dr];
}

function tryPlaceTemplate(mask, used, W, H, deltas, rng) {
  var origins = [];
  for (var i = 0; i < mask.length; i++) if (mask[i] && !used[i]) origins.push(i);
  shuffle(rng, origins);
  if (origins.length > 72) origins.length = 72;
  var rots = [0, 1, 2, 3];
  shuffle(rng, rots);
  var flips = [false, true];
  shuffle(rng, flips);
  for (var oi = 0; oi < origins.length; oi++) {
    var or = Math.floor(origins[oi] / W), oc = origins[oi] % W;
    for (var fi = 0; fi < flips.length; fi++) {
      for (var ri = 0; ri < rots.length; ri++) {
        var cells = [], ok = true;
        for (var k = 0; k < deltas.length && ok; k++) {
          var dc = deltas[k][0], dr = deltas[k][1];
          if (flips[fi]) dc = -dc;
          var p = rotateDelta(dc, dr, rots[ri]);
          var r = or + p[1], c = oc + p[0];
          if (r < 0 || r >= H || c < 0 || c >= W) { ok = false; break; }
          var ni = r * W + c;
          if (!mask[ni] || used[ni]) { ok = false; break; }
          cells.push(ni);
        }
        if (!ok) continue;
        var seen = {};
        for (k = 0; k < cells.length; k++) {
          if (seen[cells[k]]) { ok = false; break; }
          seen[cells[k]] = 1;
        }
        if (!ok || !isContiguousPath(cells, W, H)) continue;
        var dir = dirFromPath(cells, W);
        if (exitCorridorClearOfOwnBody(cells, W, H, dir)) return { cells: cells, dir: dir };
        var rev = cells.slice().reverse();
        var rd = dirFromPath(rev, W);
        if (exitCorridorClearOfOwnBody(rev, W, H, rd)) return { cells: rev, dir: rd };
      }
    }
  }
  return null;
}

function permuteFour(arr) {
  var out = [], a = arr.slice();
  function rec(s) {
    if (s === a.length) { out.push(a.slice()); return; }
    for (var i = s; i < a.length; i++) {
      var t = a[s]; a[s] = a[i]; a[i] = t;
      rec(s + 1);
      t = a[s]; a[s] = a[i]; a[i] = t;
    }
  }
  rec(0);
  return out;
}

function placeIndependentStyles(mask, blocked, W, H, rng) {
  var specs = {
    M: { turns: 4, min: 6, max: 11 },
    R: { turns: 3, min: 5, max: 9 },
    U: { turns: 2, min: 4, max: 8 },
    L: { turns: 1, min: 3, max: 7 }
  };
  var orders = permuteFour(['L', 'U', 'R', 'M']);
  shuffle(rng, orders);
  for (var oi = 0; oi < orders.length; oi++) {
    var used = blocked.slice();
    var placed = [], ok = true;
    for (var t = 0; t < orders[oi].length && ok; t++) {
      var key = orders[oi][t];
      var found = null;
      var variants = STYLE_TEMPLATES[key];
      for (var vi = 0; vi < variants.length && !found; vi++) {
        found = tryPlaceTemplate(mask, used, W, H, variants[vi], rng);
      }
      if (!found) {
        var starts = [];
        for (var i = 0; i < mask.length; i++) if (mask[i] && !used[i]) starts.push(i);
        shuffle(rng, starts);
        for (var s = 0; s < starts.length && !found; s++) {
          found = walkStyledPath(mask, used, W, H, starts[s], specs[key].turns, specs[key].min, specs[key].max, rng);
        }
      }
      if (!found) { ok = false; break; }
      for (var k = 0; k < found.cells.length; k++) used[found.cells[k]] = 1;
      placed.push(found);
    }
    if (ok && placed.length === 4) return placed;
  }
  return extractStylesFromSnake(mask, blocked, W, H, rng);
}

function greedySnake(mask, blocked, W, H, start) {
  var path = [start], seen = new Uint8Array(W * H), lastDir = -1;
  seen[start] = 1;
  var guard = 0;
  while (guard++ < W * H) {
    var cur = path[path.length - 1], r = Math.floor(cur / W), c = cur % W;
    var opts = [];
    for (var d = 0; d < 4; d++) {
      var nr = r + DR[d], nc = c + DC[d];
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      var ni = nr * W + nc;
      if (!mask[ni] || blocked[ni] || seen[ni]) continue;
      opts.push({ d: d, ni: ni });
    }
    if (!opts.length) break;
    var pick = null;
    for (var i = 0; i < opts.length; i++) if (opts[i].d === lastDir) { pick = opts[i]; break; }
    if (!pick) pick = opts[0];
    path.push(pick.ni);
    seen[pick.ni] = 1;
    lastDir = pick.d;
  }
  return path;
}

function manhattanCell(a, b, W) {
  return Math.abs(Math.floor(a / W) - Math.floor(b / W)) + Math.abs((a % W) - (b % W));
}

function orientArrow(cells, W, H) {
  if (!cells || cells.length < 2) return null;
  if (!isContiguousPath(cells, W, H)) return null;
  var dir = dirFromPath(cells, W);
  if (exitCorridorClearOfOwnBody(cells, W, H, dir)) return { cells: cells.slice(), dir: dir };
  var rev = cells.slice().reverse();
  var rd = dirFromPath(rev, W);
  if (exitCorridorClearOfOwnBody(rev, W, H, rd) && isContiguousPath(rev, W, H)) return { cells: rev, dir: rd };
  return null;
}

function greedyMixSnake(mask, blocked, W, H, start, maxLen, rng, turnBias) {
  var path = [start], seen = new Uint8Array(W * H), lastDir = -1;
  seen[start] = 1;
  if (turnBias == null) turnBias = 0.78;
  var guard = 0;
  while (path.length < maxLen && guard++ < W * H) {
    var cur = path[path.length - 1], r = Math.floor(cur / W), c = cur % W;
    var turns = [], straights = [];
    for (var d = 0; d < 4; d++) {
      var nr = r + DR[d], nc = c + DC[d];
      if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
      var ni = nr * W + nc;
      if (!mask[ni] || blocked[ni] || seen[ni]) continue;
      if (lastDir >= 0 && d === lastDir) straights.push({ d: d, ni: ni });
      else turns.push({ d: d, ni: ni });
    }
    if (!turns.length && !straights.length) break;
    var preferTurn = lastDir >= 0 && rng() < turnBias;
    var pool;
    if (preferTurn && turns.length) pool = turns;
    else if (!preferTurn && straights.length) pool = straights;
    else pool = turns.concat(straights);
    var pick = pool[Math.floor(rng() * pool.length)];
    path.push(pick.ni);
    seen[pick.ni] = 1;
    lastDir = pick.d;
  }
  return path;
}

function cellDegree(cell, mask, used, W, H) {
  var r = Math.floor(cell / W), c = cell % W, n = 0, d;
  for (d = 0; d < 4; d++) {
    var nr = r + DR[d], nc = c + DC[d];
    if (nr < 0 || nr >= H || nc < 0 || nc >= W) continue;
    var ni = nr * W + nc;
    if (mask[ni] && !used[ni]) n++;
  }
  return n;
}

function pickLeftoverStart(mask, used, W, H, rng) {
  var ends = [], rest = [], i;
  for (i = 0; i < mask.length; i++) {
    if (!mask[i] || used[i]) continue;
    if (cellDegree(i, mask, used, W, H) <= 1) ends.push(i);
    else rest.push(i);
  }
  var pool = ends.length ? ends : rest;
  if (!pool.length) return -1;
  return pool[Math.floor(rng() * pool.length)];
}

function chopSnake(snake, W, H, rng, mix, deficit) {
  var pieces = [], i = 0;
  function wantTurns() {
    if (deficit && deficit.length) {
      var k = deficit[Math.floor(rng() * deficit.length)];
      if (k === 'L') return 1;
      if (k === 'U') return 2;
      if (k === 'R') return 3;
      if (k === 'M') return 4;
    }
    var u = rng();
    if (u < 0.34) return 1;
    if (u < 0.56) return 2;
    if (u < 0.70) return 3;
    if (u < 0.82) return 4;
    return 0;
  }
  while (i < snake.length) {
    var remain = snake.length - i;
    if (remain === 1) {
      if (pieces.length) {
        var prev = pieces[pieces.length - 1];
        if (prev.cells && prev.cells.length) {
          var last = prev.cells[prev.cells.length - 1];
          var first = prev.cells[0];
          var trial = null;
          if (manhattanCell(last, snake[i], W) === 1) trial = prev.cells.concat([snake[i]]);
          else if (manhattanCell(first, snake[i], W) === 1) trial = [snake[i]].concat(prev.cells);
          var ori = trial && orientArrow(trial, W, H);
          if (ori) { pieces[pieces.length - 1] = ori; i++; continue; }
        }
      }
      pieces.push({ cells: [snake[i]], dir: -1, single: true });
      i++;
      continue;
    }
    var targetT = wantTurns();
    var wantLen = pickPathLength(rng, mix);
    if (targetT === 1) wantLen = Math.max(3, Math.min(wantLen, 7));
    else if (targetT === 2) wantLen = Math.max(4, Math.min(wantLen, 9));
    else if (targetT === 3) wantLen = Math.max(5, Math.min(wantLen, 11));
    else if (targetT >= 4) wantLen = Math.max(6, Math.min(wantLen, 12));
    else wantLen = Math.max(2, Math.min(wantLen, 8));
    wantLen = Math.min(wantLen, remain, 12);
    var minLen = targetT === 0 ? 2 : Math.min(remain, Math.max(2, targetT + 1));
    var maxLen = Math.min(remain, 12);
    var best = null, bestScore = -1e9, len;
    for (len = maxLen; len >= minLen; len--) {
      var oriented = orientArrow(snake.slice(i, i + len), W, H);
      if (!oriented) continue;
      var t = countTurns({ cells: oriented.cells }, W);
      var score = 0;
      if (targetT === 0) score = t === 0 ? 22 : -t * 3;
      else if (t === targetT) score = 44;
      else if (t > 0 && targetT > 0) score = 14 - Math.abs(t - targetT) * 4;
      else score = -10;
      score -= Math.abs(len - wantLen) * 0.7;
      if (len >= 3) score += 3;
      if (t > 0) score += 2;
      if (score > bestScore) { bestScore = score; best = oriented; }
      if (t === targetT && Math.abs(len - wantLen) <= 1) break;
    }
    if (!best) {
      for (len = Math.min(8, remain); len >= 2 && !best; len--) {
        best = orientArrow(snake.slice(i, i + len), W, H);
      }
    }
    if (!best) {
      pieces.push({ cells: [snake[i]], dir: -1, single: true });
      i++;
      continue;
    }
    pieces.push(best);
    i += best.cells.length;
  }
  return pieces;
}

function extractStylesFromSnake(mask, blocked, W, H, rng) {
  var starts = [];
  for (var i = 0; i < mask.length; i++) if (mask[i] && !blocked[i]) starts.push(i);
  shuffle(rng, starts);
  var need = [
    { turns: 4, min: 6 },
    { turns: 3, min: 5 },
    { turns: 2, min: 4 },
    { turns: 1, min: 3 }
  ];
  for (var si = 0; si < Math.min(starts.length, 24); si++) {
    var snake = greedySnake(mask, blocked, W, H, starts[si]);
    if (snake.length < 18) continue;
    var used = blocked.slice(), placed = [], ok = true;
    for (var t = 0; t < need.length && ok; t++) {
      var found = null;
      for (var a = 0; a < snake.length && !found; a++) {
        for (var b = a + need[t].min; b <= snake.length && !found; b++) {
          var sl = snake.slice(a, b);
          var blockedSlice = false;
          for (var k = 0; k < sl.length; k++) if (used[sl[k]]) { blockedSlice = true; break; }
          if (blockedSlice || !isContiguousPath(sl, W, H)) continue;
          var turns = countTurns({ cells: sl }, W);
          if (need[t].turns === 4 ? turns < 4 : turns !== need[t].turns) continue;
          var dir = dirFromPath(sl, W);
          if (exitCorridorClearOfOwnBody(sl, W, H, dir)) found = { cells: sl, dir: dir };
          else {
            var rev = sl.slice().reverse();
            var rd = dirFromPath(rev, W);
            if (exitCorridorClearOfOwnBody(rev, W, H, rd)) found = { cells: rev, dir: rd };
          }
        }
      }
      if (!found) { ok = false; break; }
      for (k = 0; k < found.cells.length; k++) used[found.cells[k]] = 1;
      placed.push(found);
    }
    if (ok && placed.length === 4) return placed;
  }
  return null;
}

function styleTargetsFor(n) {
  var L = Math.max(3, Math.min(Math.floor(n * 0.28), 16));
  var U = Math.max(2, Math.min(Math.floor(n * 0.20), 12));
  var R = Math.max(1, Math.min(Math.floor(n * 0.14), 10));
  var M = Math.max(1, Math.min(Math.floor(n * 0.12), 8));
  return { L: L, U: U, R: R, M: M };
}

function pickPathLength(rng, mix) {
  var u = rng();
  if (u < mix.small) return 3 + Math.floor(rng() * 2);
  if (u < mix.small + mix.medium) return 5 + Math.floor(rng() * 3);
  return 8 + Math.floor(rng() * 5);
}

function tryCarveStyle(mask, used, W, H, key, rng) {
  var specs = {
    L: { turns: 1, min: 3, max: 8 },
    U: { turns: 2, min: 4, max: 10 },
    R: { turns: 3, min: 5, max: 12 },
    M: { turns: 4, min: 6, max: 14 }
  };
  var spec = specs[key];
  var variants = STYLE_TEMPLATES[key].slice();
  shuffle(rng, variants);
  var found = null;
  for (var vi = 0; vi < variants.length && !found; vi++) {
    found = tryPlaceTemplate(mask, used, W, H, variants[vi], rng);
  }
  if (found) return found;
  var starts = [];
  for (var i = 0; i < mask.length; i++) if (mask[i] && !used[i]) starts.push(i);
  shuffle(rng, starts);
  var lim = Math.min(starts.length, 28);
  for (var s = 0; s < lim && !found; s++) {
    found = walkStyledPath(mask, used, W, H, starts[s], spec.turns, spec.min, spec.max, rng);
  }
  return found;
}

function tryCarveAny(mask, used, W, H, rng, mix) {
  var start = pickLeftoverStart(mask, used, W, H, rng);
  if (start < 0) return null;
  var leftover = 0, i;
  for (i = 0; i < mask.length; i++) if (mask[i] && !used[i]) leftover++;
  var maxLen = Math.min(leftover, 4 + Math.floor(rng() * 9));
  var snake = greedyMixSnake(mask, used, W, H, start, maxLen, rng, 0.78);
  if (snake.length < 2) return null;
  var pieces = chopSnake(snake, W, H, rng, mix, null);
  for (i = 0; i < pieces.length; i++) {
    if (pieces[i] && pieces[i].cells && pieces[i].cells.length >= 2 && !pieces[i].single) return pieces[i];
  }
  return orientArrow(snake, W, H);
}

function canRemoveNowList(alive, a, W, H) {
  var own = {}, i;
  for (i = 0; i < a.cells.length; i++) own[a.cells[i]] = 1;
  var h = a.cells[a.cells.length - 1], r = Math.floor(h / W) + DR[a.dir], c = h % W + DC[a.dir];
  while (r >= 0 && r < H && c >= 0 && c < W) {
    var cell = r * W + c, blocked = false;
    for (i = 0; i < alive.length; i++) {
      if (alive[i].id === a.id) continue;
      if (alive[i].cells.indexOf(cell) >= 0) { blocked = true; break; }
    }
    if (blocked && !own[cell]) return false;
    r += DR[a.dir];
    c += DC[a.dir];
  }
  return true;
}

function drainSolve(arrows, W, H) {
  var remaining = arrows.slice();
  var order = [];
  var guard = 0;
  while (remaining.length && guard++ < arrows.length * 10) {
    var moved = false, i, a;
    for (i = 0; i < remaining.length; i++) {
      a = remaining[i];
      if (canRemoveNowList(remaining, a, W, H)) {
        order.push(a.id);
        remaining.splice(i, 1);
        moved = true;
        i--;
      }
    }
    if (moved) continue;
    var flipped = false;
    for (i = 0; i < remaining.length && !flipped; i++) {
      a = remaining[i];
      if (a.cells.length < 2) continue;
      var rev = a.cells.slice().reverse();
      var rd = dirFromPath(rev, W);
      if (!exitCorridorClearOfOwnBody(rev, W, H, rd)) continue;
      var trial = { id: a.id, cells: rev, dir: rd };
      if (canRemoveNowList(remaining, trial, W, H)) {
        a.cells = rev;
        a.dir = rd;
        flipped = true;
      }
    }
    if (!flipped) break;
  }
  if (remaining.length) {
    var topo = findSolutionOrder(remaining, W, H);
    if (!topo) return null;
    for (var ti = 0; ti < topo.length; ti++) order.push(topo[ti]);
  }
  return order;
}

function buildFastFallback(cfg, seedBase) {
  var W = cfg.W, H = cfg.H, mask = cfg.mask || makeMask(W, H, cfg.shapeId || 'diamond');
  var used = new Uint8Array(W * H);
  var arrows = [], id = 0, rng = mulberry32(seedBase >>> 0), level = cfg.level || 1;
  var mix = cfg.arrowMix || getArrowMix(level);
  function fail(why) { buildFastFallback.lastFail = why; return null; }
  function idx(r, c) { return r * W + c; }
  function clearRay(cell, dir) {
    var r = Math.floor(cell / W) + DR[dir], c = cell % W + DC[dir];
    while (r >= 0 && r < H && c >= 0 && c < W) {
      if (mask[idx(r, c)]) return false;
      r += DR[dir]; c += DC[dir];
    }
    return true;
  }
  function add(cells, dir, flags) {
    if (!cells || !cells.length) return false;
    if (cells.length > 1 && !isContiguousPath(cells, W, H)) return false;
    if (!exitCorridorClearOfOwnBody(cells, W, H, dir)) return false;
    for (var i = 0; i < cells.length; i++) if (!mask[cells[i]] || used[cells[i]]) return false;
    var a = { id: id++, cells: cells.slice(), dir: dir };
    if (flags) { if (flags.styleCore) a.styleCore = true; if (flags.fixedAnchor) a.fixedAnchor = true; }
    for (i = 0; i < cells.length; i++) used[cells[i]] = 1;
    arrows.push(a);
    return true;
  }

  var cand = [[], [], [], []];
  for (var d = 0; d < 4; d++) for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
    var cell = idx(r, c);
    if (mask[cell] && clearRay(cell, d)) cand[d].push(cell);
  }
  if (cand.some(function (x) { return !x.length; })) return fail('no-cand');

  var usable = 0, qi;
  for (qi = 0; qi < mask.length; qi++) if (mask[qi]) usable++;
  var avgLen = 3 * mix.small + 6 * mix.medium + 12 * mix.long;
  var estN = Math.max(8, Math.floor(usable / Math.max(3, avgLen)));
  var targets = styleTargetsFor(estN);
  var have = { L: 0, U: 0, R: 0, M: 0 };

  var styleCandidates = [];
  if (W * H >= 1600) {
    var sampleTries = 140;
    while (sampleTries-- > 0 && styleCandidates.length < 28) {
      var srS = Math.floor(rng() * Math.max(1, H - 4));
      var scS = Math.floor(rng() * Math.max(1, W - 4));
      if (srS > H - 5 || scS > W - 5) continue;
      var regionOkS = true;
      for (var rrS = srS; rrS < srS + 5 && regionOkS; rrS++)
        for (var ccS = scS; ccS < scS + 5; ccS++) {
          if (!mask[idx(rrS, ccS)]) { regionOkS = false; break; }
        }
      if (regionOkS) styleCandidates.push([srS, scS]);
    }
  } else {
    for (var sr0 = 0; sr0 <= H - 5; sr0++) for (var sc0 = 0; sc0 <= W - 5; sc0++) {
      var regionOk = true;
      for (var rr0 = sr0; rr0 < sr0 + 5 && regionOk; rr0++)
        for (var cc0 = sc0; cc0 < sc0 + 5; cc0++) {
          if (!mask[idx(rr0, cc0)]) { regionOk = false; break; }
        }
      if (regionOk) styleCandidates.push([sr0, sc0]);
    }
  }
  shuffle(rng, styleCandidates);
  function transformCorePath(path, rot, flip, sr, sc) {
    var out = [];
    for (var ti = 0; ti < path.length; ti++) {
      var base = path[ti], x = base % 5, y = Math.floor(base / 5);
      if (flip) x = 4 - x;
      for (var rr = 0; rr < rot; rr++) { var tx = 4 - y, ty = x; x = tx; y = ty; }
      out.push(idx(sr + y, sc + x));
    }
    return out;
  }
  if (styleCandidates.length) {
    var sci = Math.floor(rng() * Math.min(styleCandidates.length, 12));
    var sr0b = styleCandidates[sci][0], sc0b = styleCandidates[sci][1];
    var pat = CORE_PATTERNS[Math.floor(rng() * CORE_PATTERNS.length)];
    var rot = Math.floor(rng() * 4), flip = rng() < 0.5;
    var built = [], localOK = true, spi;
    for (spi = 0; spi < pat.length; spi++) {
      var pp = transformCorePath(pat[spi], rot, flip, sr0b, sc0b);
      if (!pp.every(function (x) { return mask[x] && !used[x]; }) || !isContiguousPath(pp, W, H)) {
        localOK = false; break;
      }
      built.push({ cells: pp, dir: dirFromPath(pp, W) });
    }
    if (localOK) {
      for (var bi2 = 0; bi2 < built.length; bi2++) {
        if (!add(built[bi2].cells, built[bi2].dir, { styleCore: true })) { localOK = false; break; }
      }
      if (localOK) {
        for (bi2 = 0; bi2 < built.length; bi2++) {
          var tt = countTurns({ cells: built[bi2].cells }, W);
          if (tt === 1) have.L++;
          else if (tt === 2) have.U++;
          else if (tt === 3) have.R++;
          else if (tt >= 4) have.M++;
        }
      }
    }
  }

  var bag = [];
  function pushKey(key, n) { for (var i = 0; i < n; i++) bag.push(key); }
  pushKey('L', Math.max(0, targets.L - have.L));
  pushKey('U', Math.max(0, targets.U - have.U));
  pushKey('R', Math.max(0, targets.R - have.R));
  pushKey('M', Math.max(0, targets.M - have.M));
  shuffle(rng, bag);
  for (var bi = 0; bi < bag.length; bi++) {
    var key = bag[bi];
    var carved = tryCarveStyle(mask, used, W, H, key, rng);
    if (!carved) continue;
    if (add(carved.cells, carved.dir, { styleCore: true })) have[key]++;
  }

  var leftoverGuard = 0;
  while (leftoverGuard++ < usable + 8) {
    var leftover = 0;
    for (qi = 0; qi < mask.length; qi++) if (mask[qi] && !used[qi]) leftover++;
    if (!leftover) break;
    var deficit = [];
    if (have.L < targets.L) deficit.push('L');
    if (have.U < targets.U) deficit.push('U');
    if (have.R < targets.R) deficit.push('R');
    if (have.M < targets.M) deficit.push('M');
    if (deficit.length) {
      var carvedDef = tryCarveStyle(mask, used, W, H, deficit[Math.floor(rng() * deficit.length)], rng);
      if (carvedDef && add(carvedDef.cells, carvedDef.dir, { styleCore: true })) {
        var td = countTurns({ cells: carvedDef.cells }, W);
        if (td === 1) have.L++;
        else if (td === 2) have.U++;
        else if (td === 3) have.R++;
        else if (td >= 4) have.M++;
        continue;
      }
    }
    var startCell = pickLeftoverStart(mask, used, W, H, rng);
    if (startCell < 0) break;
    var bias = 0.70 + mix.turn * 0.18;
    var snake = greedyMixSnake(mask, used, W, H, startCell, leftover, rng, bias);
    if (snake.length < 2) {
      var od = 1;
      for (d = 0; d < 4; d++) if (clearRay(startCell, d)) { od = d; break; }
      if (!add([startCell], od)) return fail('add-single-1');
      continue;
    }
    var pieces = chopSnake(snake, W, H, rng, mix, deficit.length ? deficit : null);
    var placedPiece = false, pi;
    for (pi = 0; pi < pieces.length; pi++) {
      var pc = pieces[pi];
      if (!pc || !pc.cells || pc.cells.length < 2 || pc.single) continue;
      if (add(pc.cells, pc.dir)) {
        placedPiece = true;
        var t3 = countTurns({ cells: pc.cells }, W);
        if (t3 === 1) have.L++;
        else if (t3 === 2) have.U++;
        else if (t3 === 3) have.R++;
        else if (t3 >= 4) have.M++;
      }
    }
    if (placedPiece) continue;
    var whole = orientArrow(snake, W, H);
    if (whole && add(whole.cells, whole.dir)) {
      var t4 = countTurns({ cells: whole.cells }, W);
      if (t4 === 1) have.L++;
      else if (t4 === 2) have.U++;
      else if (t4 === 3) have.R++;
      else if (t4 >= 4) have.M++;
      continue;
    }
    var got = false, slen;
    for (slen = Math.min(snake.length, 10); slen >= 2 && !got; slen--) {
      var pref = orientArrow(snake.slice(0, slen), W, H);
      if (pref && add(pref.cells, pref.dir)) {
        got = true;
        var t5 = countTurns({ cells: pref.cells }, W);
        if (t5 === 1) have.L++;
        else if (t5 === 2) have.U++;
        else if (t5 === 3) have.R++;
        else if (t5 >= 4) have.M++;
      }
    }
    if (got) continue;
    var od2 = 1;
    for (d = 0; d < 4; d++) if (clearRay(startCell, d)) { od2 = d; break; }
    if (!add([startCell], od2)) return fail('add-single-2');
  }
  for (qi = 0; qi < mask.length; qi++) {
    if (!mask[qi] || used[qi]) continue;
    var ld = 1;
    for (d = 0; d < 4; d++) if (clearRay(qi, d)) { ld = d; break; }
    if (!add([qi], ld)) return fail('add-leftover-cell');
  }
  function rewireSingles() {
    var changed = true, guard = 0, i, j;
    while (changed && guard++ < 64) {
      changed = false;
      for (i = 0; i < arrows.length; i++) {
        if (arrows[i].cells.length !== 1) continue;
        var sc = arrows[i].cells[0];
        for (j = 0; j < arrows.length; j++) {
          if (i === j || arrows[j].cells.length < 1) continue;
          var head = arrows[j].cells[arrows[j].cells.length - 1];
          var tail = arrows[j].cells[0];
          var trial = null;
          if (manhattanCell(sc, head, W) === 1) trial = arrows[j].cells.concat([sc]);
          else if (manhattanCell(sc, tail, W) === 1) trial = [sc].concat(arrows[j].cells);
          if (!trial) continue;
          var oriented = orientArrow(trial, W, H);
          if (!oriented) continue;
          arrows[j].cells = oriented.cells;
          arrows[j].dir = oriented.dir;
          arrows.splice(i, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
      if (changed) continue;
      for (i = 0; i < arrows.length; i++) {
        if (arrows[i].cells.length !== 1) continue;
        sc = arrows[i].cells[0];
        for (j = i + 1; j < arrows.length; j++) {
          if (arrows[j].cells.length !== 1) continue;
          if (manhattanCell(sc, arrows[j].cells[0], W) !== 1) continue;
          oriented = orientArrow([sc, arrows[j].cells[0]], W, H);
          if (!oriented) oriented = orientArrow([arrows[j].cells[0], sc], W, H);
          if (!oriented) continue;
          arrows[i].cells = oriented.cells;
          arrows[i].dir = oriented.dir;
          arrows.splice(j, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
  }
  rewireSingles();
  have.L = have.U = have.R = have.M = 0;
  for (qi = 0; qi < arrows.length; qi++) {
    var tr = countTurns(arrows[qi], W);
    if (tr === 1) have.L++;
    else if (tr === 2) have.U++;
    else if (tr === 3) have.R++;
    else if (tr >= 4) have.M++;
  }
  for (qi = 0; qi < mask.length; qi++) if (mask[qi] && !used[qi]) return fail('unfilled');

  function dirCounts() {
    var ds = [0, 0, 0, 0];
    for (var i = 0; i < arrows.length; i++) ds[arrows[i].dir]++;
    return ds;
  }
  function ensureDirections() {
    var counts = dirCounts();
    for (d = 0; d < 4; d++) {
      if (counts[d]) continue;
      var found = false;
      for (var i = 0; i < arrows.length && !found; i++) {
        var a = arrows[i];
        if (a.cells.length === 1 && clearRay(a.cells[0], d)) {
          a.dir = d;
          a.fixedAnchor = true;
          found = true;
        }
      }
      if (found) { counts = dirCounts(); continue; }
      for (i = 0; i < arrows.length && !found; i++) {
        a = arrows[i];
        if (a.cells.length < 2) continue;
        var jEnd = [0, a.cells.length - 1];
        for (var ji = 0; ji < 2 && !found; ji++) {
          var j = jEnd[ji];
          if (!clearRay(a.cells[j], d)) continue;
          var cell2 = a.cells[j];
          if (j === 0) a.cells = a.cells.slice(1);
          else a.cells = a.cells.slice(0, -1);
          if (a.cells.length >= 2) a.dir = dirFromPath(a.cells, W);
          else {
            a.dir = 1;
            for (var dd = 0; dd < 4; dd++) if (clearRay(a.cells[0], dd) && dd !== d) { a.dir = dd; break; }
          }
          arrows.push({ id: id++, cells: [cell2], dir: d, fixedAnchor: true });
          found = true;
        }
      }
    }
  }
  ensureDirections();
  if (dirCounts().some(function (x) { return x === 0; })) return fail('missing-dir');

  var solutionOrder = drainSolve(arrows, W, H);
  if (!solutionOrder) {
    var topoTry = findSolutionOrder(arrows, W, H);
    if (topoTry && simulateSolution({ W: W, H: H, arrows: arrows, solutionOrder: topoTry })) solutionOrder = topoTry;
    else return fail('unsolvable');
  }
  var puzzle = { W: W, H: H, arrows: arrows, solutionOrder: solutionOrder };
  if (!simulateSolution(puzzle)) return fail('sim-fail');
  return {
    W: W, H: H, lives: cfg.lives, targetN: cfg.N, placedN: arrows.length,
    tier: cfg.tier || 0, name: cfg.name || '', shapeId: cfg.shapeId || 'diamond',
    shapeName: cfg.shapeName || 'Diamond', mask: mask, arrows: arrows,
    solutionOrder: solutionOrder, fallback: true, level: level,
    diffName: cfg.diffName || difficultyName(level),
    isExtreme: !!cfg.isExtreme,
    metrics: calculateDifficultyMetrics(arrows, W, H, mask, solutionOrder)
  };
}

function requiredStyleCounts(p) {
  var n = (p && p.arrows && p.arrows.length) || 8;
  if (n < 10) return { L: 1, U: 1, R: 1, M: 1 };
  return {
    L: Math.max(2, Math.min(Math.floor(n * 0.20), 12)),
    U: Math.max(2, Math.min(Math.floor(n * 0.14), 10)),
    R: Math.max(1, Math.min(Math.floor(n * 0.08), 8)),
    M: Math.max(1, Math.min(Math.floor(n * 0.06), 6))
  };
}

function requiredArrowStyleCounts(p) {
  var c = { L: 0, U: 0, R: 0, M: 0 };
  for (var i = 0; i < (p.arrows || []).length; i++) {
    var t = countTurns(p.arrows[i], p.W);
    if (t === 1) c.L++;
    else if (t === 2) c.U++;
    else if (t === 3) c.R++;
    else if (t >= 4) c.M++;
  }
  return c;
}
function requiredArrowStyles(p) {
  var have = requiredArrowStyleCounts(p), need = requiredStyleCounts(p);
  return have.L >= need.L && have.U >= need.U && have.R >= need.R && have.M >= need.M;
}

function validateLevel(p, expectedLevel) {
  var errors = [];
  if (!p) return { ok: false, errors: ['missing puzzle'] };
  var W = p.W, H = p.H;
  if (!W || !H) errors.push('invalid dimensions');
  if (expectedLevel) {
    var expectedShape = shapeFor(expectedLevel);
    if (p.shapeId !== expectedShape) errors.push('wrong campaign shape: expected ' + expectedShape + ' got ' + p.shapeId);
    if (p.shapeName !== (SHAPES[p.shapeId] && SHAPES[p.shapeId].name)) errors.push('shape name mismatch');
  }
  var seen = new Uint8Array(Math.max(1, W * H));
  var dirs = [0, 0, 0, 0], bent = 0, turns = 0, singles = 0, i, j;
  for (i = 0; i < (p.arrows || []).length; i++) {
    var a = p.arrows[i];
    if (!a || !Array.isArray(a.cells) || a.cells.length < 1) { errors.push('arrow ' + i + ' too short'); continue; }
    if (a.cells.length === 1) singles++;
    if (a.dir < 0 || a.dir > 3) errors.push('arrow ' + i + ' invalid direction');
    else dirs[a.dir]++;
    if (a.cells.length > 1 && !isContiguousPath(a.cells, W, H)) errors.push('arrow ' + i + ' non-contiguous');
    if (!exitCorridorClearOfOwnBody(a.cells, W, H, a.dir)) errors.push('arrow ' + i + ' self-blocking exit');
    if (a.cells.length >= 2 && dirFromPath(a.cells, W) !== a.dir) errors.push('arrow ' + i + ' head/body direction mismatch');
    var t = countTurns(a, W); turns += t; if (t > 0) bent++;
    for (j = 0; j < a.cells.length; j++) {
      var cell = a.cells[j];
      if (cell < 0 || cell >= W * H) { errors.push('arrow ' + i + ' out of bounds'); continue; }
      if (!p.mask[cell]) errors.push('arrow ' + i + ' outside shape');
      if (seen[cell]) errors.push('overlap at ' + cell); else seen[cell] = 1;
    }
  }
  if ((p.arrows || []).length >= 4 && dirs.some(function (x) { return x === 0; })) errors.push('missing exit direction');
  var n = (p.arrows || []).length, bentFrac = n ? bent / n : 0;
  if (n >= 4 && !requiredArrowStyles(p)) errors.push('missing required arrow styles (L/U/repeated-turn/multi-turn)');
  if (expectedLevel && n >= 10 && bentFrac < 0.52) errors.push('too few bent arrows: ' + bentFrac.toFixed(2));
  if (expectedLevel && n >= 10 && singles / n > 0.28) errors.push('too many 1-cell arrows: ' + singles + '/' + n);
  if (!p.solutionOrder || p.solutionOrder.length !== n) errors.push('solution does not contain every arrow');
  if (!simulateSolution(p)) errors.push('solution simulation failed');
  var maskCells = 0, occupied = 0;
  for (i = 0; i < p.mask.length; i++) if (p.mask[i]) maskCells++;
  for (i = 0; i < n; i++) occupied += p.arrows[i].cells.length;
  var density = maskCells ? occupied / maskCells : 0;
  if (expectedLevel && density < 0.995) errors.push('arrow density too low: ' + density.toFixed(2));
  return {
    ok: errors.length === 0, errors: errors, shapeId: p.shapeId, shapeName: p.shapeName,
    directions: dirs, bentFraction: bentFrac, turns: turns, density: density,
    arrowCount: n, solutionLength: p.solutionOrder ? p.solutionOrder.length : 0
  };
}

function buildPeelPuzzle(cfg, seedBase) {
  var W = cfg.W, H = cfg.H, mask = cfg.mask || makeMask(W, H, cfg.shapeId || 'diamond');
  var remaining = new Uint8Array(mask.length);
  var i, usable = 0;
  for (i = 0; i < mask.length; i++) if (mask[i]) { remaining[i] = 1; usable++; }
  if (usable < 8) { buildPeelPuzzle.lastFail = 'tiny'; return null; }
  var arrows = [], id = 0, rng = mulberry32(seedBase >>> 0);
  var mix = cfg.arrowMix || getArrowMix(100);
  var have = { L: 0, U: 0, R: 0, M: 0 };
  var estN = Math.max(8, Math.floor(usable / 10));
  var targets = styleTargetsFor(estN);
  var solutionOrder = [];

  function usedFromRemaining() {
    var used = new Uint8Array(mask.length);
    for (var u = 0; u < mask.length; u++) used[u] = remaining[u] ? 0 : 1;
    return used;
  }
  function rayOpen(cell, dir) {
    var r = Math.floor(cell / W) + DR[dir], c = cell % W + DC[dir];
    while (r >= 0 && r < H && c >= 0 && c < W) {
      if (remaining[r * W + c]) return false;
      r += DR[dir]; c += DC[dir];
    }
    return true;
  }
  function addPath(cells, dir) {
    if (!cells || !cells.length) return false;
    if (cells.length > 1 && !isContiguousPath(cells, W, H)) return false;
    if (cells.length >= 2 && dirFromPath(cells, W) !== dir) return false;
    if (!exitCorridorClearOfOwnBody(cells, W, H, dir)) return false;
    var own = {}, k;
    for (k = 0; k < cells.length; k++) {
      if (!remaining[cells[k]]) return false;
      own[cells[k]] = 1;
    }
    var head = cells[cells.length - 1];
    var r = Math.floor(head / W) + DR[dir], c = head % W + DC[dir];
    while (r >= 0 && r < H && c >= 0 && c < W) {
      var cell = r * W + c;
      if (remaining[cell] && !own[cell]) return false;
      r += DR[dir]; c += DC[dir];
    }
    var a = { id: id++, cells: cells.slice(), dir: dir };
    for (k = 0; k < cells.length; k++) remaining[cells[k]] = 0;
    arrows.push(a);
    solutionOrder.push(a.id);
    var t = countTurns(a, W);
    if (t === 1) have.L++;
    else if (t === 2) have.U++;
    else if (t === 3) have.R++;
    else if (t >= 4) have.M++;
    return true;
  }
  function leftoverCount() {
    var n = 0, li;
    for (li = 0; li < remaining.length; li++) if (remaining[li]) n++;
    return n;
  }
  function edgeOpts() {
    var opts = [], ci, d;
    for (ci = 0; ci < remaining.length; ci++) {
      if (!remaining[ci]) continue;
      for (d = 0; d < 4; d++) if (rayOpen(ci, d)) opts.push({ cell: ci, dir: d });
    }
    return opts;
  }

  function wantTurnsFor(key) {
    if (key === 'L') return 1;
    if (key === 'U') return 2;
    if (key === 'R') return 3;
    if (key === 'M') return 4;
    return -1;
  }
  function inwardCell(E, D) {
    var back = (D + 2) % 4;
    var nr = Math.floor(E / W) + DR[back], nc = (E % W) + DC[back];
    if (nr < 0 || nr >= H || nc < 0 || nc >= W) return -1;
    var ni = nr * W + nc;
    return remaining[ni] ? ni : -1;
  }
  function peelEdge(E, D, wantKey) {
    var ni = inwardCell(E, D);
    if (ni < 0) return addPath([E], D);
    var used = usedFromRemaining();
    used[E] = 1;
    var left = leftoverCount();
    var maxLen = Math.min(left - 1, 12 + Math.floor(rng() * 16));
    var snake = greedyMixSnake(mask, used, W, H, ni, Math.max(4, maxLen), rng, 0.88);
    var cells = snake.slice().reverse();
    cells.push(E);
    var want = wantTurnsFor(wantKey);
    var best = null, bestScore = -1e9, s, sub, t, score;
    for (s = 0; s < cells.length - 1; s++) {
      sub = cells.slice(s);
      if (sub.length < 2) continue;
      if (dirFromPath(sub, W) !== D) continue;
      if (!isContiguousPath(sub, W, H)) continue;
      t = countTurns({ cells: sub }, W);
      score = sub.length * 1.2;
      if (want >= 0 && t === want) score += 90;
      else if (t > 0) score += 16;
      if (sub.length >= 4) score += 8;
      if (score > bestScore) { bestScore = score; best = sub; }
    }
    if (best && addPath(best, D)) return true;
    return addPath([ni, E], D);
  }

  var seedDir, seedOpts, seedPick;
  for (seedDir = 0; seedDir < 4; seedDir++) {
    seedOpts = [];
    for (i = 0; i < remaining.length; i++) if (remaining[i] && rayOpen(i, seedDir) && inwardCell(i, seedDir) >= 0) seedOpts.push(i);
    if (!seedOpts.length) {
      for (i = 0; i < remaining.length; i++) if (remaining[i] && rayOpen(i, seedDir)) seedOpts.push(i);
    }
    if (!seedOpts.length) { buildPeelPuzzle.lastFail = 'seed-dir'; return null; }
    seedPick = seedOpts[Math.floor(rng() * seedOpts.length)];
    if (!peelEdge(seedPick, seedDir, seedDir === 0 ? 'L' : seedDir === 1 ? 'U' : seedDir === 2 ? 'R' : 'M')) {
      buildPeelPuzzle.lastFail = 'seed-add';
      return null;
    }
  }

  var guard = 0;
  while (guard++ < usable + 12) {
    var left = leftoverCount();
    if (!left) break;
    var deficit = [];
    if (have.L < targets.L) deficit.push('L');
    if (have.U < targets.U) deficit.push('U');
    if (have.R < targets.R) deficit.push('R');
    if (have.M < targets.M) deficit.push('M');
    var opts = edgeOpts();
    if (!opts.length) { buildPeelPuzzle.lastFail = 'no-edge'; return null; }
    var growable = opts.filter(function (op) { return inwardCell(op.cell, op.dir) >= 0; });
    if (growable.length) opts = growable;
    var o = opts[Math.floor(rng() * opts.length)];
    var wantKey = deficit.length ? deficit[Math.floor(rng() * deficit.length)] : null;
    if (!peelEdge(o.cell, o.dir, wantKey)) { buildPeelPuzzle.lastFail = 'peel'; return null; }
  }
  if (leftoverCount()) { buildPeelPuzzle.lastFail = 'leftover'; return null; }
  if ([0, 1, 2, 3].some(function (d) {
    return !arrows.some(function (a) { return a.dir === d; });
  })) { buildPeelPuzzle.lastFail = 'dirs'; return null; }
  var puzzle = { W: W, H: H, arrows: arrows, solutionOrder: solutionOrder.slice() };
  if (!simulateSolution(puzzle)) { buildPeelPuzzle.lastFail = 'sim'; return null; }
  return {
    W: W, H: H, lives: cfg.lives, targetN: cfg.N, placedN: arrows.length,
    tier: cfg.tier || 0, name: cfg.name || 'Daily', shapeId: cfg.shapeId || 'diamond',
    shapeName: cfg.shapeName || 'Diamond', mask: mask, arrows: arrows,
    solutionOrder: solutionOrder.slice(), fallback: true, level: cfg.level || 100,
    diffName: cfg.diffName || 'Extreme', isExtreme: true,
    metrics: calculateDifficultyMetrics(arrows, W, H, mask, solutionOrder)
  };
}

function generateLevel(level) {
  var cfg = getLevelConfig(level);
  var seedBase = (Math.imul(level, 2654435761) ^ 0x9e3779b9) >>> 0;
  for (var fb = 0; fb < 400; fb++) {
    var fp = buildFastFallback(cfg, (seedBase ^ Math.imul(fb + 1, 0x27d4eb2d)) >>> 0);
    if (!fp) continue;
    var fv = validateLevel(fp, level);
    if (fv.ok && requiredArrowStyles(fp) && fv.density >= 0.995 && fv.solutionLength === fv.arrowCount && fv.directions.every(function (x) { return x > 0; }))
      return fp;
  }
  throw new Error('validated generation failed for level ' + level);
}

function generateDaily(dateKey) {
  var cfg = dailyConfig(dateKey);
  var base = hashCode('arrow-daily:' + dateKey);
  for (var a = 0; a < 16; a++) {
    var fp = buildPeelPuzzle(cfg, (base ^ Math.imul(a + 1, 0x85ebca6b)) >>> 0);
    if (!fp) continue;
    var v = validateLevel(fp, null);
    if (v.ok && requiredArrowStyles(fp) && v.density >= 0.995 && v.solutionLength === v.arrowCount && v.directions.every(function (x) { return x > 0; }))
      return fp;
  }
  throw new Error('generate failed for daily ' + dateKey);
}

function buildDenseStripPuzzle() { return null; }
function buildFullFillSnakePuzzle() { return null; }

var api = {
  mulberry32: mulberry32,
  difficultyFor: difficultyFor,
  dailyConfig: dailyConfig,
  generateLevel: generateLevel,
  generateDaily: generateDaily,
  buildPeelPuzzle: buildPeelPuzzle,
  simulateSolution: simulateSolution,
  arrowBlocked: arrowBlocked,
  makeMask: makeMask,
  shapeFor: shapeFor,
  SHAPES: SHAPES,
  DIFF_NAMES: DIFF_NAMES,
  TOTAL_LEVELS: TOTAL_LEVELS,
  getLevelDimensions: getLevelDimensions,
  getLevelConfig: getLevelConfig,
  buildDenseStripPuzzle: buildDenseStripPuzzle,
  buildFullFillSnakePuzzle: buildFullFillSnakePuzzle,
  buildFastFallback: buildFastFallback,
  exitCorridorClearOfOwnBody: exitCorridorClearOfOwnBody,
  isContiguousPath: isContiguousPath,
  validateLevel: validateLevel,
  requiredArrowStyles: requiredArrowStyles,
  requiredArrowStyleCounts: requiredArrowStyleCounts,
  countTurns: countTurns,
  exitDistance: exitDistance,
  CAMPAIGN_SHAPES: CAMPAIGN_SHAPES,
};


global.ArrowEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
