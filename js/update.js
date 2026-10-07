// A notice when the site has a newer version than the page that is open. Now and then the page asks the server for
// its version; when a newer one is out, a bar offers to load it. Nothing is lost by updating: everything is saved
// in the browser as it is done.
'use strict';

const UPDATE_EVERY = 10 * 60 * 1000;  // how often an open page asks
const UPDATE_GAP = 5 * 60 * 1000;     // and the least time between two questions, however often the page comes back into view
let updateAsked = 0;                  // when the server was last asked
let updateLater = '';                 // the version the visitor chose to leave for later

// "4.10" is newer than "4.9": the versions are compared number by number.
function versionNewer(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}
function updateNotice(version) {
  if (!version || version === updateLater) return;
  let bar = $('#update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<p><b>${t('The site was updated')}</b>${t('Version {v} is out; this page is still on {old}. Your builds and parties stay as they are.', { v: esc(version), old: APP_VERSION })}</p>
    <button class="btn primary" data-act="update-now">${t('Click here to update')}</button>
    <button class="icon x" data-act="update-later" data-v="${esc(version)}" title="${t('Later')}">×</button>`;
  bar.hidden = false;
}
// The version the server has now, read from the file that states it; nothing when it cannot be reached.
async function updateVersion() {
  const text = await (await fetch('js/core.js?now=' + Date.now(), { cache: 'no-store' })).text();
  return (/APP_VERSION = '([\d.]+)'/.exec(text) || [])[1] || '';
}
async function updateCheck() {
  if (location.protocol === 'file:' || window.BG3_TEST || document.hidden || Date.now() - updateAsked < UPDATE_GAP) return;
  updateAsked = Date.now();
  try {
    const version = await updateVersion();
    if (versionNewer(version, APP_VERSION)) updateNotice(version);
  } catch (err) { /* offline: it is asked again later */ }
}

Object.assign(actions, {
  async 'update-now'(el) {
    el.disabled = true;
    el.textContent = t('Updating…');
    try {
      // the page and every file it names are fetched again, past the copy the browser keeps, so that the reload finds the new ones
      const html = await (await fetch(location.pathname, { cache: 'reload' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const urls = Array.from(doc.querySelectorAll('script[src], link[rel="stylesheet"][href]')).map((x) => x.getAttribute('src') || x.getAttribute('href')).filter((u) => !/^(https?:)?\/\//.test(u));
      await Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
    } catch (err) { /* the reload still tries */ }
    location.reload();
    return false;
  },
  'update-later'(el) {
    updateLater = el.dataset.v;
    $('#update-bar').hidden = true;
    return false;
  },
});

if (!window.BG3_TEST && location.protocol !== 'file:') {
  setTimeout(updateCheck, 4000);
  setInterval(updateCheck, UPDATE_EVERY);
  document.addEventListener('visibilitychange', updateCheck);
}
