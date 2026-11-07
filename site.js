// Small touches only. The site works without this file.
document.querySelectorAll('.glow').forEach(function (el) {
  el.addEventListener('pointermove', function (e) {
    var r = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - r.left) + 'px');
    el.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true });
});

// Depth: cards lean toward the pointer, and the header layers shift at different speeds
if (matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.card, .bay').forEach(function (el) {
    el.classList.add('tilt');
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5;
      var y = (e.clientY - r.top) / r.height - .5;
      el.classList.add('tilting');
      el.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (x * 7).toFixed(2) + 'deg');
    }, { passive: true });
    el.addEventListener('pointerleave', function () {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
  var waves = document.querySelector('.waves');
  if (waves) {
    addEventListener('pointermove', function (e) {
      waves.style.setProperty('--px', ((e.clientX / innerWidth - .5) * -1).toFixed(3));
      waves.style.setProperty('--py', ((e.clientY / innerHeight - .5) * -1).toFixed(3));
    }, { passive: true });
  }
}

// Home gauge: the needle follows whichever section you are about to open
var dial = document.getElementById('dial');
if (dial) {
  var ANG = { cars: -108, code: -54, creative: 0, outdoors: 54, career: 108 };
  var read = document.getElementById('read');
  var needle = dial.querySelector('.needle');
  var point = function (key, label) {
    needle.style.setProperty('--ang', ANG[key] + 'deg');
    read.textContent = label;
    dial.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.dataset.dial === key); });
  };
  document.querySelectorAll('[data-dial]').forEach(function (el) {
    var label = el.dataset.dial.charAt(0).toUpperCase() + el.dataset.dial.slice(1);
    ['pointerenter', 'focus'].forEach(function (t) {
      el.addEventListener(t, function () { point(el.dataset.dial, label); });
    });
  });
  needle.addEventListener('animationend', function () { needle.style.animation = 'none'; });
  if (matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    document.querySelector('.read-s').textContent = 'Scroll to move it';
    var live = new IntersectionObserver(function (items) {
      items.forEach(function (i) {
        i.target.classList.toggle('live', i.isIntersecting);
        if (i.isIntersecting) point(i.target.dataset.dial, i.target.dataset.dial.charAt(0).toUpperCase() + i.target.dataset.dial.slice(1));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('.card').forEach(function (c) { live.observe(c); });
  }
}

// Documentation pages: highlight the section being read
var toc = document.querySelectorAll('.toc a');
if (toc.length && 'IntersectionObserver' in window) {
  var mark = function (id) {
    toc.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  var seen = new IntersectionObserver(function (items) {
    items.forEach(function (i) { if (i.isIntersecting) mark(i.target.id); });
  }, { rootMargin: '-20% 0px -70% 0px' });
  toc.forEach(function (a) {
    var t = document.querySelector(a.getAttribute('href'));
    if (t) seen.observe(t);
  });
}

var printBtn = document.querySelector('[data-print]');
if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
