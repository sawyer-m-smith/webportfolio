// A soft light follows the pointer across home cards. Everything else works without this file.
document.querySelectorAll('.card').forEach(function (c) {
  c.addEventListener('pointermove', function (e) {
    var r = c.getBoundingClientRect();
    c.style.setProperty('--x', (e.clientX - r.left) + 'px');
    c.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true });
});
var printBtn = document.querySelector('[data-print]');
if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
