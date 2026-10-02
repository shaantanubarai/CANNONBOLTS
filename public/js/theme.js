// Theme toggle - dark/light mode
(function() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Set initial icon
    toggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    toggle.addEventListener('click', function() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      toggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  });
})();
