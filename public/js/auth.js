// Auth guard - redirects to login page if no token found
(function() {
  const token = localStorage.getItem('authToken');
  if (!token && !window.location.pathname.endsWith('login.html')) {
    window.location.href = '/login.html';
  }
})();
