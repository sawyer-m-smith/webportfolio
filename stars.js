// Sizes each category star on the home page based on its data-count attribute
// (the number of projects in that room) instead of every star being an
// identical, arbitrary size. Edit data-count on each .star in index.html to
// keep it in sync as you add real projects - it's manual on purpose, since
// this is a static site with no shared backend across pages.
(function () {
  var MIN_SIZE = 10;
  var MAX_SIZE = 24;
  var MIN_COUNT = 1;
  var MAX_COUNT = 10; // counts at or above this render at MAX_SIZE

  var stars = document.querySelectorAll('.star[data-count]');
  stars.forEach(function (star) {
    var count = parseInt(star.getAttribute('data-count'), 10) || MIN_COUNT;
    var clamped = Math.max(MIN_COUNT, Math.min(MAX_COUNT, count));
    var ratio = (clamped - MIN_COUNT) / (MAX_COUNT - MIN_COUNT);
    var size = Math.round(MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE));

    var dot = star.querySelector('.star-dot');
    if (dot) {
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
    }

    var label = star.querySelector('.star-label');
    if (label && !label.dataset.countApplied) {
      label.textContent = label.textContent + ' · ' + count;
      label.dataset.countApplied = 'true';
    }
  });
})();
