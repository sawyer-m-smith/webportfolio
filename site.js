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
  document.querySelectorAll('.bay').forEach(function (el) {
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
  var hills = document.querySelector('.hills');
  if (hills) {
    addEventListener('pointermove', function (e) {
      hills.style.setProperty('--px', ((e.clientX / innerWidth - .5) * -1).toFixed(3));
    }, { passive: true });
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
