// Builds the ambient .sky layer that sits behind every page (see css/style.css).
// Runs on every page that includes this script. Purely decorative, aria-hidden,
// and skips animation entirely if the visitor has "reduce motion" turned on.
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var sky = document.createElement('div');
    sky.className = 'sky';
    sky.setAttribute('aria-hidden', 'true');

    // A few large, soft, blurred color blobs for atmosphere - very low opacity,
    // just enough to make the dark background feel like deep space instead of
    // a flat color. Colors match the site's accent palette.
    var glowSpots = [
      { color: 'var(--gold)', size: 340, top: '8%', left: '12%' },
      { color: 'var(--star-code)', size: 300, top: '55%', left: '85%' },
      { color: 'var(--star-creative)', size: 380, top: '80%', left: '20%' }
    ];
    glowSpots.forEach(function (spot) {
      var glow = document.createElement('div');
      glow.className = 'glow';
      glow.style.background = spot.color;
      glow.style.width = spot.size + 'px';
      glow.style.height = spot.size + 'px';
      glow.style.top = spot.top;
      glow.style.left = spot.left;
      sky.appendChild(glow);
    });

    // A dense scatter of small stars across the whole viewport.
    var starCount = 160;
    for (var i = 0; i < starCount; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      var size = Math.random() < 0.8 ? 1 : Math.random() < 0.95 ? 2 : 3;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.top = (Math.random() * 100).toFixed(2) + '%';
      star.style.left = (Math.random() * 100).toFixed(2) + '%';
      star.style.opacity = (0.25 + Math.random() * 0.65).toFixed(2);
      if (reduceMotion) {
        star.style.animation = 'none';
      } else {
        star.style.setProperty('--dur', (3 + Math.random() * 5).toFixed(1) + 's');
        star.style.setProperty('--delay', (Math.random() * 6).toFixed(1) + 's');
      }
      sky.appendChild(star);
    }

    document.body.prepend(sky);
  });
})();
