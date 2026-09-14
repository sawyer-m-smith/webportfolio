// Computes a live "N projects shown" line from the actual project cards on
// the page. The "sold" count only appears if there are any .sold-badge
// elements present, so this same script works on every room, not just Cars.
(function () {
  var grid = document.querySelector('.project-grid');
  var statsEl = document.getElementById('roomStats');
  if (!grid || !statsEl) return;

  var total = grid.querySelectorAll('.project-card').length;
  var sold = grid.querySelectorAll('.sold-badge').length;

  var text = total + (total === 1 ? ' project shown' : ' projects shown');
  if (sold > 0) {
    text += ' · ' + sold + (sold === 1 ? ' sold' : ' sold');
  }
  statsEl.textContent = text;
})();
