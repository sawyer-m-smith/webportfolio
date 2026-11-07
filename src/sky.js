// The home page sky, written directly on WebGL2 with no 3D library, so it stays tiny.
// Everything is a flat layer at some depth: moving layers at different speeds is what
// creates the 3D feel, and it costs almost nothing to draw.
(function () {
  var canvas = document.getElementById('sky');
  var gl = canvas && canvas.getContext('webgl2', { alpha: false, antialias: innerWidth > 760, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var FIG = JSON.parse(document.getElementById('sky-figures').textContent);
  var links = {};
  document.querySelectorAll('.z-label').forEach(function (a) { links[a.dataset.k] = a; });

  function rgb(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }

  function program(vs, fs) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var o = gl.createShader(s[0]);
      gl.shaderSource(o, '#version 300 es\nprecision highp float;\n' + s[1]);
      gl.compileShader(o);
      gl.attachShader(p, o);
    });
    gl.linkProgram(p);
    var u = {};
    for (var i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      var name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, u: u };
  }

  var MOVE = 'uniform vec2 uS,uCam,uF;uniform float uZ,uZoom;vec2 place(vec2 p){p+=uCam*uZ;p=uF+(p-uF)*(1.+uZoom*(.5+uZ*3.2));return p*uS;}';
  var skyP = program('layout(location=0) in vec2 a;out float y;uniform float uH;void main(){y=a.y-uH;gl_Position=vec4(a,0,1);}',
    'in float y;out vec4 o;void main(){vec3 g=vec3(.93,.52,.40),m=vec3(.30,.07,.13),t=vec3(.075,.028,.048);vec3 c=mix(g,m,smoothstep(-.04,.22,y));c=mix(c,t,smoothstep(.1,.85,y));float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);o=vec4(c+(n-.5)/190.,1);}');
  var flatP = program('layout(location=0) in vec2 a;' + MOVE + 'uniform float uT,uB;void main(){vec2 p=a;p.y+=uB*sin(a.x*1.7+uT*.22+uZ*11.)*.018*step(-1.4,a.y);gl_Position=vec4(place(p),0,1);}',
    'uniform vec4 uC;out vec4 o;void main(){o=uC;}');
  var lineP = program('layout(location=0) in vec2 a;layout(location=1) in float t;out float v;' + MOVE + 'void main(){v=t;gl_Position=vec4(place(a),0,1);}',
    'in float v;uniform vec4 uC;uniform float uR;out vec4 o;void main(){if(v>uR)discard;o=uC;}');
  var starP = program('layout(location=0) in vec2 a;layout(location=1) in float s;layout(location=2) in float ph;out float l;' + MOVE + 'uniform float uT,uPx,uG;void main(){l=.62+.38*sin(uT*(.5+ph*.11)+ph);gl_PointSize=s*uPx*uG;gl_Position=vec4(place(a),0,1);}',
    'in float l;uniform vec3 uC;out vec4 o;void main(){vec2 c=gl_PointCoord-.5;float d=max(1.-dot(c,c)*4.,0.);d*=d;o=vec4(uC*d*l,1);}');

  function buffer(data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return b; }
  function vao(attrs) {
    var v = gl.createVertexArray();
    gl.bindVertexArray(v);
    attrs.forEach(function (a, i) {
      gl.bindBuffer(gl.ARRAY_BUFFER, a[0]);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, a[1], gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);
    return v;
  }

  var quad = vao([[buffer([-1, -1, 3, -1, -1, 3]), 2]]);

  // Hills: far ones are light, and they darken toward you
  var HILLS = [
    { y: .02, a: .08, f: 1.3, p: 1.2, c: '#e58a6c', z: .10 },
    { y: -.11, a: .09, f: 1.7, p: 3.4, c: '#d8694f', z: .18 },
    { y: -.25, a: .09, f: 2.0, p: 5.3, c: '#c44f3f', z: .28 },
    { y: -.39, a: .08, f: 2.4, p: 2.1, c: '#a83a38', z: .42 },
    { y: -.53, a: .07, f: 2.8, p: 4.4, c: '#8b2733', z: .60 },
    { y: -.66, a: .07, f: 3.4, p: .7, c: '#64192b', z: .80 },
    { y: -.84, a: .06, f: 4.1, p: 2.8, c: '#3a0f1c', z: 1.05 },
  ];
  var stars, figures, hillVao = [], aspect = 1, W = 1, H = 1, S = [1, 1], dpr = 1, horizon = 0;

  // Each hill only reaches down to where the next one covers it, and its shadow is a thin
  // ribbon rather than a whole copy, which removes most of the overdraw
  function makeHills(shift) {
    var X = aspect + .7, step = .025;
    hillVao.forEach(function (h) { gl.deleteVertexArray(h.fill); gl.deleteVertexArray(h.edge); });
    hillVao = HILLS.map(function (h, i) {
      var next = HILLS[i + 1];
      var bottom = next ? next.y + shift - next.a * 1.5 - .06 : -3;
      var d = [], e = [];
      for (var x = -X; x <= X + step * .5; x += step) {
        var y = h.y + shift + h.a * Math.sin(x * h.f + h.p) + h.a * .34 * Math.sin(x * h.f * 2.3 + h.p * 2);
        d.push(x, y, x, bottom);
        e.push(x, y + .014, x, y - .01);
      }
      return { fill: vao([[buffer(d), 2]]), edge: vao([[buffer(e), 2]]), n: d.length / 2 };
    });
  }

  function makeStars() {
    var n = coarse || innerWidth < 760 ? 500 : 1100;
    var p = [], s = [], ph = [];
    for (var i = 0; i < n; i++) {
      p.push((Math.random() - .5) * (aspect + .6) * 2, horizon - .1 + Math.random() * 1.3);
      s.push(1.2 + Math.pow(Math.random(), 5) * 3.4);
      ph.push(Math.random() * 6.28);
    }
    stars = { v: vao([[buffer(p), 2], [buffer(s), 1], [buffer(ph), 1]]), n: n };
  }

  // Constellations: thin strips for the lines, and a star at every point
  function makeFigures() {
    var tall = aspect < 1;
    var spots = tall
      ? { cars: [-.2, .78, .13], code: [.2, .78, .13], creative: [0, .56, .13], outdoors: [-.2, .34, .13], career: [.2, .34, .13] }
      : { cars: [-.74, .5, .15], code: [-.38, .68, .15], creative: [0, .8, .15], outdoors: [.38, .68, .15], career: [.74, .5, .15] };
    figures = FIG.map(function (f) {
      var sp = spots[f.k], fx = (tall ? 1 : aspect / 1.7), cx = sp[0] * fx, cy = sp[1], sc = sp[2] * (tall ? aspect * 1.6 : Math.min(fx, 1.1));
      var w = .0034, tris = [], ts = [], pts = [], seen = {}, total = 0, run = 0;
      f.s.forEach(function (st) { for (var i = 1; i < st.length; i++) total += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]); });
      f.s.forEach(function (st) {
        st.forEach(function (q) {
          var key = q[0] + ',' + q[1];
          if (!seen[key]) { seen[key] = 1; pts.push(cx + q[0] * sc, cy + q[1] * sc); }
        });
        for (var i = 1; i < st.length; i++) {
          var ax = cx + st[i - 1][0] * sc, ay = cy + st[i - 1][1] * sc, bx = cx + st[i][0] * sc, by = cy + st[i][1] * sc;
          var dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
          var t0 = run / total;
          run += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
          var t1 = run / total;
          tris.push(ax + nx, ay + ny, ax - nx, ay - ny, bx + nx, by + ny, bx + nx, by + ny, ax - nx, ay - ny, bx - nx, by - ny);
          ts.push(t0, t0, t1, t1, t0, t1);
        }
      });
      var sizes = [], ph = [];
      for (var i = 0; i < pts.length / 2; i++) { sizes.push(7); ph.push(Math.random() * 6.28); }
      var a = links[f.k];
      var pxW = sc * 2.5 * H * .5, px = (cx * S[0] + 1) * .5 * W, py = (1 - cy * S[1]) * .5 * H;
      a.style.width = Math.max(pxW, 96) + 'px';
      a.style.height = sc * 2.05 * H * .5 + 44 + 'px';
      return {
        k: f.k, cx: cx, cy: cy, px: px, py: py, a: a,
        lines: vao([[buffer(tris), 2], [buffer(ts), 1]]), ln: ts.length,
        dots: vao([[buffer(pts), 2], [buffer(sizes), 1], [buffer(ph), 1]]), dn: pts.length / 2,
        c: rgb(f.c), h: 0,
      };
    });
  }

  var cap = coarse || innerWidth < 760 ? 1.5 : 2, ceiling = Infinity;
  function pickDpr() { return Math.max(.6, Math.min(devicePixelRatio, cap, ceiling, Math.sqrt((coarse ? 1.2e6 : 2.2e6) / (innerWidth * innerHeight)))); }

  function resize() {
    dpr = pickDpr();
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  function layout() {
    W = innerWidth; H = innerHeight;
    aspect = W / H;
    S = [1 / aspect, 1];
    resize();
    var shift = aspect < 1 ? -.1 : 0;
    horizon = .02 + shift;
    makeHills(shift);
    makeStars();
    makeFigures();
  }

  /* ---------- Interaction ---------- */
  var hover = null, leaving = null, tx = 0, ty = 0, cx = 0, cy = 0;
  addEventListener('pointermove', function (e) { tx = -((e.clientX / W) * 2 - 1); ty = (e.clientY / H) * 2 - 1; touched = performance.now(); }, { passive: true });
  var touched = 0;
  Object.keys(links).forEach(function (k) {
    var a = links[k];
    function on() { hover = k; touched = performance.now(); }
    function off() { if (hover === k) hover = null; }
    a.addEventListener('pointerenter', on); a.addEventListener('focus', on);
    a.addEventListener('pointerleave', off); a.addEventListener('blur', off);
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || reduced) return;
      e.preventDefault();
      var f = figures.filter(function (g) { return g.k === k; })[0];
      leaving = { f: f, t: 0, href: a.href };
    });
  });
  // Coming back with the browser's back button should show a fresh sky
  addEventListener('pageshow', function (e) { if (e.persisted) { leaving = null; document.body.style.setProperty('--fade', 0); } });

  /* ---------- Draw ---------- */
  gl.disable(gl.DEPTH_TEST);
  var last = 0, t = 0, intro = reduced ? 9 : 0, zoom = 0, F = [0, 0], begin = performance.now();
  var gov = { at: 0, n: 0 };

  function common(pr, z) {
    gl.uniform2fv(pr.u.uS, S);
    gl.uniform2f(pr.u.uCam, cx * .16, cy * .1);
    gl.uniform2fv(pr.u.uF, F);
    gl.uniform1f(pr.u.uZ, z);
    gl.uniform1f(pr.u.uZoom, zoom);
  }

  function draw(now) {
    requestAnimationFrame(draw);
    // Full speed while someone is interacting, half speed when the page is just sitting there
    var busy = now - touched < 2500 || intro < 3 || leaving;
    if (now - last < (busy ? 15.5 : 32)) return;
    var dt = Math.min((now - last) / 1000, .1);
    last = now;
    t += dt;
    intro = reduced ? 9 : (now - begin) / 1000;
    var d = 1 - Math.exp(-3 * dt);
    cx += (tx - cx) * d;
    cy += (ty - cy) * d;

    if (leaving) {
      leaving.t = Math.min(1, leaving.t + dt / .7);
      var e = leaving.t * leaving.t * (3 - 2 * leaving.t);
      F = [leaving.f.cx, leaving.f.cy];
      zoom = e * 2.6;
      document.body.style.setProperty('--fade', e * e);
      if (leaving.t >= 1) { var h = leaving.href; leaving = null; location.href = h; return; }
    }

    gl.disable(gl.BLEND);
    gl.useProgram(skyP.p);
    gl.uniform1f(skyP.u.uH, (horizon + zoom * -.2) * S[1]);
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(starP.p);
    common(starP, .04);
    gl.uniform1f(starP.u.uT, t);
    gl.uniform1f(starP.u.uPx, Math.max(dpr, .85));
    gl.uniform1f(starP.u.uG, 1);
    gl.uniform3f(starP.u.uC, 1, .93, .84);
    gl.bindVertexArray(stars.v);
    gl.drawArrays(gl.POINTS, 0, stars.n);

    figures.forEach(function (f, i) {
      var goal = hover === f.k ? 1 : 0;
      f.h += (goal - f.h) * (1 - Math.exp(-7 * dt));
      var reveal = reduced ? 1 : Math.min(1, Math.max(0, (intro - .15 - i * .12) / .8));
      gl.useProgram(lineP.p);
      common(lineP, .07);
      var A = .5 + f.h * .5;
      gl.uniform4f(lineP.u.uC, f.c[0] * A, f.c[1] * A, f.c[2] * A, 1);
      gl.uniform1f(lineP.u.uR, reveal);
      gl.bindVertexArray(f.lines);
      gl.drawArrays(gl.TRIANGLES, 0, f.ln);
      gl.useProgram(starP.p);
      common(starP, .07);
      gl.uniform1f(starP.u.uT, t * 1.4);
      gl.uniform1f(starP.u.uPx, Math.max(dpr, .85));
      gl.uniform1f(starP.u.uG, (1 + f.h * .9) * Math.min(1, reveal * 1.6));
      gl.uniform3f(starP.u.uC, .6 + f.c[0] * .5, .6 + f.c[1] * .5, .6 + f.c[2] * .5);
      gl.bindVertexArray(f.dots);
      gl.drawArrays(gl.POINTS, 0, f.dn);
      // The clickable label follows the same drift as its constellation
      var mx = cx * .16 * .07 * S[0] * .5 * W, my = -cy * .1 * .07 * .5 * H;
      f.a.style.transform = 'translate3d(' + (f.px + mx).toFixed(1) + 'px,' + (f.py + my).toFixed(1) + 'px,0) translate(-50%,-44%)';
      f.a.classList.toggle('on', hover === f.k);
    });

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(flatP.p);
    gl.uniform1f(flatP.u.uT, t);
    gl.uniform1f(flatP.u.uB, reduced ? 0 : 1);
    HILLS.forEach(function (h, i) {
      common(flatP, h.z);
      var v = hillVao[i];
      if (i) {
        // A soft edge of shadow, like one sheet of paper resting on another
        gl.bindVertexArray(v.edge);
        gl.uniform4f(flatP.u.uC, 0, 0, 0, .22);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, v.n);
      }
      gl.bindVertexArray(v.fill);
      var c = h.rgb || (h.rgb = rgb(h.c));
      gl.uniform4f(flatP.u.uC, c[0], c[1], c[2], 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, v.n);
    });

    // Speed governor: trade sharpness for smoothness, invisibly
    gov.n++;
    if (!gov.at) gov.at = now;
    var spent = now - gov.at;
    if (spent > 1200) {
      var fps = gov.n / spent * 1000;
      window.SKY_FPS = Math.round(fps);
      gov.at = now; gov.n = 0;
      var floor = busy ? 44 : 24;
      if (fps < floor && dpr > .61) { ceiling = Math.max(.6, dpr * Math.max(.65, Math.sqrt(fps / (floor + 8)))); resize(); }
    }
  }
  document.addEventListener('visibilitychange', function () { gov.at = 0; gov.n = 0; });

  addEventListener('resize', layout);
  layout();
  document.documentElement.classList.add('z-on');
  requestAnimationFrame(draw);
})();
