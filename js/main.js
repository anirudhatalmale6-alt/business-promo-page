/* ==========================================================================
   main.js  —  vanilla JavaScript, no libraries, no build step
   --------------------------------------------------------------------------
   Contents
     1. CONFIG            — the only part you normally need to edit
     2. Mobile navigation
     3. Header shadow on scroll
     4. Scroll-reveal animations
     5. Contact form: validation, spam traps, submit, feedback
     6. Footer year
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONFIG
     ------------------------------------------------------------------------ */
  var CONFIG = {

    /* Where the form posts to.
       Leave it as null to use the <form action="..."> attribute in index.html. */
    endpoint: null,

    /* DEMO MODE
       true  = nothing is actually sent anywhere; the form validates and then
               shows the success message. This is how the page ships, so you
               can open index.html locally and see the whole flow work.
       false = the form really POSTs to the endpoint above (or the form's
               action attribute) and shows the error message if that fails.
       Switch this to false the day you plug in a real endpoint — Formspree,
       Basin, Netlify Forms, a PHP script, anything that accepts a POST. */
    demoMode: true,

    /* Send the data as JSON rather than classic form fields.
       Most no-code form services accept both; JSON suits a custom API. */
    sendAsJson: false,

    /* Anything submitted faster than this many milliseconds after the page
       loaded is treated as a bot. Humans do not type a message in 3 seconds. */
    minFillSeconds: 3,

    messages: {
      success: {
        title: 'Thank you — your message is on its way.',
        body:  'We have received your enquiry and will reply within one working day.'
      },
      error: {
        title: 'Sorry, that did not send.',
        body:  'Something went wrong on our side. Please try again in a moment, or email us directly at hello@example.com.'
      }
    }
  };

  /* Small helpers */
  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /* ------------------------------------------------------------------------
     2. MOBILE NAVIGATION
     ------------------------------------------------------------------------ */
  (function nav() {
    var toggle = $('.nav-toggle');
    var menu = $('#primary-nav');
    if (!toggle || !menu) { return; }

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    /* Tapping a link closes the drawer so the target section is visible */
    $all('.nav__link, .nav__cta', menu).forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    /* Escape closes it, and focus returns to the button */
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    /* If the window is widened past the desktop breakpoint while the drawer
       is open, reset it so the state cannot get stuck. */
    var desktop = window.matchMedia('(min-width: 880px)');
    var onChange = function (event) { if (event.matches) { setOpen(false); } };
    if (desktop.addEventListener) { desktop.addEventListener('change', onChange); }
    else if (desktop.addListener) { desktop.addListener(onChange); }   /* older Safari */
  }());

  /* ------------------------------------------------------------------------
     3. HEADER SHADOW ON SCROLL
     ------------------------------------------------------------------------ */
  (function header() {
    var el = $('.site-header');
    if (!el) { return; }
    var ticking = false;

    function update() {
      el.classList.toggle('is-scrolled', window.pageYOffset > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  }());

  /* ------------------------------------------------------------------------
     4. SCROLL-REVEAL ANIMATIONS
     Elements with .reveal fade up once when they first enter the viewport.
     ------------------------------------------------------------------------ */
  (function reveal() {
    var items = $all('.reveal');
    if (!items.length) { return; }

    /* No IntersectionObserver (very old browser)? Just show everything. */
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);   /* animate once, then stop watching */
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { observer.observe(el); });
  }());

  /* ------------------------------------------------------------------------
     5. CONTACT FORM
     ------------------------------------------------------------------------ */
  (function contactForm() {
    var form = $('#contact-form');
    if (!form) { return; }

    var alertBox = $('#form-alert');
    var submitBtn = $('#submit-btn');
    var loadedAt = $('#form-loaded-at');
    var counter = $('#message-count');
    var messageField = $('#message');

    /* Stamp the load time for the timing trap */
    if (loadedAt) { loadedAt.value = String(Date.now()); }

    /* ---- Live character counter on the message box ---- */
    if (messageField && counter) {
      var max = messageField.getAttribute('maxlength') || 2000;
      var updateCount = function () {
        counter.textContent = messageField.value.length + ' / ' + max;
      };
      messageField.addEventListener('input', updateCount);
      updateCount();
    }

    /* ---- Validation rules -------------------------------------------------
       One entry per field. Each test returns an error string, or '' if the
       value is fine. Adding a field later means adding one entry here. */
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    var rules = {
      name: function (value) {
        if (!value.trim()) { return 'Please tell us your name.'; }
        if (value.trim().length < 2) { return 'That looks a little short — please enter your full name.'; }
        return '';
      },
      email: function (value) {
        if (!value.trim()) { return 'We need an email address to reply to.'; }
        if (!EMAIL_RE.test(value.trim())) { return 'That email address does not look right — please check it.'; }
        return '';
      },
      message: function (value) {
        if (!value.trim()) { return 'Please add a short message.'; }
        if (value.trim().length < 20) { return 'Please give us a little more detail (at least 20 characters).'; }
        return '';
      },
      consent: function (value, field) {
        if (!field.checked) { return 'Please tick the box so we can reply to you.'; }
        return '';
      }
    };

    /* ---- Show / clear an error under one field ---- */
    function setError(field, message) {
      var wrapper = field.closest('.field');
      var errorEl = document.getElementById(field.id + '-error');
      if (wrapper) { wrapper.classList.toggle('has-error', Boolean(message)); }
      if (errorEl) { errorEl.textContent = message || ''; }
      if (message) { field.setAttribute('aria-invalid', 'true'); }
      else { field.removeAttribute('aria-invalid'); }
    }

    function validateField(field) {
      var rule = rules[field.name];
      if (!rule) { return true; }
      var error = rule(field.value, field);
      setError(field, error);
      return !error;
    }

    /* Validate as the visitor leaves a field, and clear the error as soon as
       they start fixing it — nagging while someone is still typing is rude. */
    Object.keys(rules).forEach(function (name) {
      var field = form.elements[name];
      if (!field) { return; }
      field.addEventListener('blur', function () { validateField(field); });
      field.addEventListener('input', function () {
        if (field.closest('.field').classList.contains('has-error')) { validateField(field); }
      });
      field.addEventListener('change', function () {
        if (field.type === 'checkbox') { validateField(field); }
      });
    });

    /* ---- Success / failure banner ---- */
    var ICONS = {
      success: '<svg class="form-alert__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
      error:   '<svg class="form-alert__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16.2h.01"/></svg>'
    };

    function showAlert(type, title, body) {
      if (!alertBox) { return; }
      alertBox.className = 'form-alert form-alert--' + type;
      alertBox.innerHTML = ICONS[type] + '<span><strong>' + title + '</strong>' + body + '</span>';
      alertBox.hidden = false;
      /* Bring it into view on a small screen where it may be below the fold */
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideAlert() {
      if (alertBox) { alertBox.hidden = true; }
    }

    function setSending(sending) {
      if (!submitBtn) { return; }
      submitBtn.disabled = sending;
      submitBtn.classList.toggle('is-sending', sending);
      $('.btn__label', submitBtn).textContent = sending ? 'Sending…' : 'Send enquiry';
    }

    /* ---- Submit ---- */
    form.addEventListener('submit', function (event) {
      event.preventDefault();          /* never let the browser navigate away */
      hideAlert();

      /* --- Spam trap 1: the honeypot.
         A human never sees this field, so anything in it is a bot. We show a
         normal success message rather than an error: telling a bot it failed
         only teaches it to try again. Nothing is sent. */
      var honeypot = form.elements.company_website;
      if (honeypot && honeypot.value.trim() !== '') {
        showAlert('success', CONFIG.messages.success.title, CONFIG.messages.success.body);
        form.reset();
        return;
      }

      /* --- Spam trap 2: submitted implausibly fast. Same silent treatment. */
      var stamp = parseInt(loadedAt && loadedAt.value, 10);
      if (stamp && (Date.now() - stamp) < CONFIG.minFillSeconds * 1000) {
        showAlert('success', CONFIG.messages.success.title, CONFIG.messages.success.body);
        form.reset();
        return;
      }

      /* --- Validate every field, then focus the first one with a problem */
      var firstBad = null;
      Object.keys(rules).forEach(function (name) {
        var field = form.elements[name];
        if (field && !validateField(field) && !firstBad) { firstBad = field; }
      });
      if (firstBad) {
        firstBad.focus();
        showAlert('error', 'Please check the highlighted fields.', ' A couple of details are missing or need correcting.');
        return;
      }

      /* --- Everything is valid: send it --- */
      setSending(true);

      /* DEMO MODE: no request is made. A short pause makes the button state
         visible, then the confirmation appears. */
      if (CONFIG.demoMode) {
        window.setTimeout(function () {
          setSending(false);
          showAlert('success', CONFIG.messages.success.title, ' ' + CONFIG.messages.success.body);
          form.reset();
          if (counter) { counter.textContent = '0 / 2000'; }
          if (loadedAt) { loadedAt.value = String(Date.now()); }
        }, 900);
        return;
      }

      /* LIVE MODE: real POST to the endpoint. */
      var url = CONFIG.endpoint || form.getAttribute('action');
      var data = new FormData(form);
      data.delete('company_website');
      data.delete('form_loaded_at');

      var options = { method: 'POST', headers: { Accept: 'application/json' } };
      if (CONFIG.sendAsJson) {
        var payload = {};
        data.forEach(function (value, key) { payload[key] = value; });
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(payload);
      } else {
        options.body = data;
      }

      fetch(url, options)
        .then(function (response) {
          if (!response.ok) { throw new Error('HTTP ' + response.status); }
          setSending(false);
          showAlert('success', CONFIG.messages.success.title, ' ' + CONFIG.messages.success.body);
          form.reset();
          if (counter) { counter.textContent = '0 / 2000'; }
          if (loadedAt) { loadedAt.value = String(Date.now()); }
        })
        .catch(function () {
          setSending(false);
          showAlert('error', CONFIG.messages.error.title, ' ' + CONFIG.messages.error.body);
        });
    });
  }());

  /* ------------------------------------------------------------------------
     6. FOOTER YEAR  —  so the copyright line never goes stale
     ------------------------------------------------------------------------ */
  (function year() {
    var el = $('#year');
    if (el) { el.textContent = String(new Date().getFullYear()); }
  }());

}());
