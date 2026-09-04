/* ==========================================================================
   Albany Merinsky — site behavior
   Typewriter hero, scroll reveals, portfolio tabs, carousel lightbox,
   contact drawer.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- scroll lock -- */

  var lockCount = 0;

  function lockScroll() {
    if (lockCount++ > 0) return;
    var gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingRight = gap + 'px';
    document.body.classList.add('is-locked');
  }

  function unlockScroll() {
    if (--lockCount > 0) return;
    lockCount = 0;
    document.body.classList.remove('is-locked');
    document.body.style.paddingRight = '';
  }

  /* ------------------------------------------------- hero typewriter + sfx -- */

  var HERO_TEXT = 'Albany Merinsky';
  var TYPE_MS = 145;

  var heroTitle = document.getElementById('heroTitle');
  var typedEl = document.getElementById('typedText');
  var audioCtx = null;
  var typeTimer = null;
  var audioUnlockedOnce = false;

  // A dry typebar strike: a short filtered noise burst for the snap, plus a
  // faint square-wave ring for the metallic tail.
  function playKeyClick() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    var t = audioCtx.currentTime;

    var len = Math.floor(audioCtx.sampleRate * 0.022);
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 9);
    }

    var src = audioCtx.createBufferSource();
    src.buffer = buf;

    var band = audioCtx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 4200 + Math.random() * 1400;
    band.Q.value = 0.7;

    var high = audioCtx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1400;

    var snap = audioCtx.createGain();
    snap.gain.setValueAtTime(0.6, t);
    snap.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    src.connect(band); band.connect(high); high.connect(snap); snap.connect(audioCtx.destination);
    src.start(t);

    var ring = audioCtx.createOscillator();
    ring.type = 'square';
    ring.frequency.value = 2600 + Math.random() * 700;

    var ringGain = audioCtx.createGain();
    ringGain.gain.setValueAtTime(0.05, t);
    ringGain.gain.exponentialRampToValueAtTime(0.0004, t + 0.028);

    ring.connect(ringGain); ringGain.connect(audioCtx.destination);
    ring.start(t);
    ring.stop(t + 0.03);
  }

  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
    return audioCtx;
  }

  function runTyping() {
    if (!typedEl) return;
    if (typeTimer) clearInterval(typeTimer);

    if (reduceMotion) {
      typedEl.textContent = HERO_TEXT;
      heroTitle.classList.remove('is-typing');
      return;
    }

    var i = 0;
    typedEl.textContent = '';
    heroTitle.classList.add('is-typing');

    typeTimer = setInterval(function () {
      i += 1;
      if (HERO_TEXT[i - 1] !== ' ') playKeyClick();
      typedEl.textContent = HERO_TEXT.slice(0, i);
      if (i >= HERO_TEXT.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        heroTitle.classList.remove('is-typing');
      }
    }, TYPE_MS);
  }

  function replayTyping() {
    var ctx = ensureAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(runTyping).catch(runTyping);
    } else {
      runTyping();
    }
  }

  // Browsers block audio until a gesture. On the first one, if the visitor is
  // still up at the hero, replay so the typing is actually heard.
  function initAudioUnlock() {
    function unlock() {
      var ctx = ensureAudioCtx();
      if (!ctx) return;

      function afterResume() {
        if (audioUnlockedOnce) return;
        if (window.scrollY > window.innerHeight * 0.6) return;
        audioUnlockedOnce = true;
        runTyping();
      }

      if (ctx.state === 'suspended') ctx.resume().then(afterResume).catch(function () {});
      else afterResume();
    }

    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, unlock, { passive: true });
    });
  }

  if (heroTitle && typedEl) {
    runTyping();
    initAudioUnlock();

    heroTitle.addEventListener('click', replayTyping);
    heroTitle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        replayTyping();
      }
    });

    // Retype when the visitor scrolls back up to the hero.
    var wasAtTop = true;
    window.addEventListener('scroll', function () {
      var atTop = window.scrollY < 60;
      if (atTop && !wasAtTop) runTyping();
      wasAtTop = atTop;
    }, { passive: true });
  }

  /* ------------------------------------------------------- scroll reveals -- */

  function reveal(el) {
    if (el) el.classList.add('is-revealed');
  }

  var revealTargets = [document.getElementById('about'), document.getElementById('process')]
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -30% 0px' });

    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    revealTargets.forEach(reveal);
  }

  // Safety net: content must never stay hidden, whatever the observer does.
  setTimeout(function () { revealTargets.forEach(reveal); }, 3000);

  /* ---------------------------------------------------------------- tabs -- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var selected = t === tab;
      var panel = document.getElementById(t.getAttribute('aria-controls'));

      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      if (!panel) return;

      panel.hidden = !selected;
      if (!selected) {
        // Stop anything playing in a panel the visitor just left.
        panel.querySelectorAll('video').forEach(function (v) { v.pause(); });
      }
    });
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { selectTab(tab, false); });

    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      selectTab(next, true);
    });
  });

  /* ------------------------------------------------------------ lightbox -- */

  var POSTS = {
    frizz: {
      label: 'How to Lose Your Frizz',
      slides: Array.from({ length: 11 }, function (_, i) {
        return 'assets/hv/frizz-' + String(i + 1).padStart(2, '0') + '.png';
      })
    },
    espresso: {
      label: 'Espresso Formula',
      slides: ['assets/hv/espresso-01.png', 'assets/hv/espresso-02.png', 'assets/hv/espresso-03.png']
    },
    s1: { label: 'Client Reviews',   slides: ['assets/hv/static-01.png'] },
    s2: { label: 'Process',          slides: ['assets/hv/static-02.png'] },
    s3: { label: 'You Look Happier', slides: ['assets/hv/static-03.png'] }
  };

  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxCounter = document.getElementById('lightboxCounter');
  var lightboxPrev = document.getElementById('lightboxPrev');
  var lightboxNext = document.getElementById('lightboxNext');

  var activePost = null;
  var slideIdx = 0;
  var lastFocused = null;

  function renderSlide() {
    if (!activePost) return;
    var slides = activePost.slides;
    lightboxImg.src = slides[slideIdx];
    lightboxImg.alt = activePost.label + ' — slide ' + (slideIdx + 1) + ' of ' + slides.length;
    lightboxCounter.textContent = (slideIdx + 1) + ' / ' + slides.length;

    var single = slides.length < 2;
    lightboxPrev.hidden = single;
    lightboxNext.hidden = single;
    lightboxCounter.hidden = single;
  }

  function openPost(id) {
    var post = POSTS[id];
    if (!post) return;
    activePost = post;
    slideIdx = 0;
    lastFocused = document.activeElement;
    renderSlide();
    lightbox.hidden = false;
    lockScroll();
    if (lightboxNext.hidden) lightbox.focus();
    else lightboxNext.focus();
  }

  function closePost() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    activePost = null;
    lightboxImg.src = '';
    unlockScroll();
    if (lastFocused) lastFocused.focus();
  }

  function step(delta) {
    if (!activePost) return;
    var n = activePost.slides.length;
    slideIdx = (slideIdx + delta + n) % n;
    renderSlide();
  }

  document.querySelectorAll('.post').forEach(function (btn) {
    btn.addEventListener('click', function () { openPost(btn.dataset.post); });
  });

  if (lightbox) {
    lightbox.tabIndex = -1;
    lightbox.addEventListener('click', closePost);

    // The control row is inside the overlay — keep its clicks from closing it.
    document.querySelector('.lightbox-controls').addEventListener('click', function (e) {
      e.stopPropagation();
    });

    lightboxPrev.addEventListener('click', function () { step(-1); });
    lightboxNext.addEventListener('click', function () { step(1); });
  }

  /* -------------------------------------------------------------- drawer -- */

  var drawer = document.getElementById('drawer');
  var drawerClose = document.getElementById('drawerClose');
  var contactForm = document.getElementById('contactForm');
  var drawerLastFocused = null;

  function openDrawer() {
    drawerLastFocused = document.activeElement;
    drawer.hidden = false;
    lockScroll();
    var first = drawer.querySelector('input');
    if (first) first.focus();
  }

  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    unlockScroll();
    if (drawerLastFocused) drawerLastFocused.focus();
  }

  document.querySelectorAll('[data-open-contact]').forEach(function (btn) {
    btn.addEventListener('click', openDrawer);
  });

  if (drawer) {
    drawerClose.addEventListener('click', closeDrawer);
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) closeDrawer();
    });
  }

  // No backend here: hand the inquiry to the visitor's mail client, prefilled.
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(contactForm);
      var name = (data.get('name') || '').trim();
      var business = (data.get('business') || '').trim();
      var email = (data.get('email') || '').trim();
      var message = (data.get('message') || '').trim();

      var subject = business ? 'Inquiry — ' + business : 'Inquiry from ' + (name || 'the website');
      var body = [
        'Name: ' + name,
        'Business: ' + business,
        'Email: ' + email,
        '',
        message
      ].join('\n');

      window.location.href = 'mailto:merinskyalbany@gmail.com'
        + '?subject=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);
    });
  }

  /* ----------------------------------------------------------- keyboard --- */

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closePost();
      closeDrawer();
      return;
    }
    if (lightbox && !lightbox.hidden) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    }
  });
}());
