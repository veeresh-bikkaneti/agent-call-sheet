// Copy buttons only. Without this file every command is still plain, selectable text.
(function () {
  'use strict';
  var blocks = document.querySelectorAll('pre > code');
  if (!blocks.length) { return; }

  var status = document.getElementById('copy-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'copy-status';
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    document.body.appendChild(status);
  }

  function selectText(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function announce(btn, message, ok) {
    status.textContent = '';
    window.setTimeout(function () { status.textContent = message; }, 30);
    btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
    btn.setAttribute('data-state', ok ? 'done' : 'select');
    window.setTimeout(function () {
      btn.textContent = 'Copy';
      btn.removeAttribute('data-state');
    }, 2200);
  }

  Array.prototype.forEach.call(blocks, function (code, i) {
    var pre = code.parentNode;
    var wrap = pre.parentNode;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy command ' + (i + 1));
    pre.classList.add('has-copy');
    wrap.appendChild(btn);

    btn.addEventListener('click', function () {
      var text = code.textContent.replace(/\s+$/, '');
      var fallback = function () {
        selectText(code);
        var ok = false;
        try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
        announce(btn, ok ? 'Command copied.' : 'Command selected. Press Ctrl+C or Cmd+C to copy it.', !!ok);
      };
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () {
          announce(btn, 'Command copied.', true);
        }, fallback);
      } else {
        fallback();
      }
    });
  });
})();
