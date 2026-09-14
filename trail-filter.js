// Filters the Trail by category. Waypoints without a data-category (general
// milestones, not tied to one room) always stay visible regardless of filter.
(function () {
  var buttons = document.querySelectorAll('.filter-btn');
  var waypoints = document.querySelectorAll('.waypoint');
  if (!buttons.length || !waypoints.length) return;

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      var filter = btn.getAttribute('data-filter');
      waypoints.forEach(function (wp) {
        var category = wp.getAttribute('data-category');
        var show = filter === 'all' || category === filter || !category;
        wp.style.display = show ? '' : 'none';
      });
    });
  });
})();
