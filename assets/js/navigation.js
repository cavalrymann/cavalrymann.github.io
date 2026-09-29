(() => {
  const root = document.getElementById('tashi-website');
  root.querySelectorAll('.corner').forEach(corner => {
    for (let i = 1; i <= 10; i++) {
      const piece = document.createElement('i');
      piece.className = 'p' + i;
      corner.appendChild(piece);
    }
  });
  const links = root.querySelectorAll('a[href^="#tp-"]');
  links.forEach(link => { link.dataset.section = link.getAttribute('href').replace(/^#tp-/, ''); });
  root.querySelectorAll('.copy a[href^="https://"]').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
  const navLinks = root.querySelectorAll('nav [data-section]');
  const panels = root.querySelectorAll('[data-panel]');
  const aboutOnly = root.querySelectorAll('[data-about-only]');
  const siteTitle = root.querySelector('[data-site-title]');
  const pageTitles = Object.fromEntries([...panels].map(panel => [panel.dataset.panel, panel.dataset.panel === 'about' ? root.dataset.siteName : panel.dataset.title]));
  function selectPage(name) {
    if (!Object.prototype.hasOwnProperty.call(pageTitles, name)) name = 'about';
    aboutOnly.forEach(element => { element.hidden = name !== 'about'; });
    root.classList.toggle('is-subpage', name !== 'about');
    siteTitle.textContent = pageTitles[name];
    navLinks.forEach(item => {
      if (item.dataset.section === name) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  }
  function pageFromAddress() {
    return location.hash.replace(/^#tp-/, '') || 'about';
  }
  links.forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    selectPage(link.dataset.section);
    if (location.hash !== link.getAttribute('href')) {
      history.pushState(null, '', link.getAttribute('href'));
    }
  }));
  window.addEventListener('popstate', () => selectPage(pageFromAddress()));
  window.addEventListener('hashchange', () => selectPage(pageFromAddress()));
  selectPage(pageFromAddress());
})();
