// Builds the ambient .sky layer that sits behind every page (see css/style.css).
// Deliberately restrained: sparse, slow, low-opacity - background texture,
// not a feature in its own right. Purely decorative and aria-hidden, and
// skips animation entirely if the visitor has "reduce motion" turned on.
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

    // Two faint color blobs - just enough to keep the dark background from
    // feeling flat, low enough opacity that no one consciously notices them.
    var glowSpots = [
      { color: 'var(--gold)', size: 320, top: '10%', left: '10%' },
      { color: 'var(--star-code)', size: 340, top: '70%', left: '85%' }
    ];
    glowSpots.forEach(function (spot) {
      var glow = document.createElement('div');
      glow.className = 'glow';
      glow.style.background = spot.color;
      glow.style.width = spot.size + 'px';
      glow.style.height = spot.size + 'px';
      glow.style.top = spot.top;
      glow.style.left = spot.left;
      glow.style.opacity = '0.06';
      sky.appendChild(glow);
    });

    // A sparse scatter of small, mostly-still stars.
    var starCount = 60;
    for (var i = 0; i < starCount; i++) {
      var star = document.createElement('span');
      star.className = 'star';
      var size = Math.random() < 0.85 ? 1 : 2;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.top = (Math.random() * 100).toFixed(2) + '%';
      star.style.left = (Math.random() * 100).toFixed(2) + '%';
      star.style.opacity = (0.2 + Math.random() * 0.35).toFixed(2);
      if (!reduceMotion) {
        // Slow, subtle opacity drift only - no scaling, no bounce.
        star.style.animation = 'sky-drift ' + (8 + Math.random() * 10).toFixed(1) + 's ease-in-out infinite';
        star.style.animationDelay = (Math.random() * 8).toFixed(1) + 's';
      }
      sky.appendChild(star);
    }

    document.body.prepend(sky);
  });
})();
