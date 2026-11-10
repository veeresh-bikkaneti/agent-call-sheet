// The Oasis quest log: Mark done toggles, progress text and Copy buttons. Vanilla JS, no imports.
// Progress is kept in localStorage under "acs-oasis."; every access is wrapped because storage can throw.
(function () {
  'use strict';
  var PREFIX = 'acs-oasis.done.';

  function store(op, key, val) {
    try {
      if (op === 'get') return window.localStorage.getItem(PREFIX + key);
      if (op === 'set') window.localStorage.setItem(PREFIX + key, val);
      if (op === 'del') window.localStorage.removeItem(PREFIX + key);
    } catch (e) { /* storage blocked: the page still works for this visit */ }
    return null;
  }

  var buttons = Array.prototype.slice.call(document.querySelectorAll('button.done'));
  var progress = document.getElementById('progress');
  var bar = document.getElementById('progress-bar');
  var status = document.getElementById('copy-status');

  function update() {
    var n = buttons.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).length;
    var total = buttons.length;
    var text = n + ' of ' + total + ' quests done' + (n === total && total > 0 ? '. The oasis is yours.' : '');
    if (progress) progress.textContent = text;
    if (bar) { bar.max = total; bar.value = n; bar.textContent = n + ' of ' + total; }
  }

  buttons.forEach(function (b) {
    var id = b.getAttribute('data-quest');
    if (store('get', id) === '1') b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) store('set', id, '1'); else store('del', id);
      update();
    });
  });
  update();

  function say(msg) { if (status) status.textContent = msg; }

  Array.prototype.forEach.call(document.querySelectorAll('button.gcopy'), function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.parentNode.querySelector('code');
      if (!code) return;
      var text = code.textContent;
      function fallback() {
        var ok = false;
        try {
          var range = document.createRange();
          range.selectNodeContents(code);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          ok = !!(document.execCommand && document.execCommand('copy'));
        } catch (e) { ok = false; }
        say(ok ? 'Command copied.' : 'Command selected. Press Ctrl+C or Cmd+C to copy it.');
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say('Command copied.'); }, fallback);
      } else {
        fallback();
      }
    });
  });
})();
