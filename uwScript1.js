(function () {
  'use strict';

  if (typeof unitQuestions === 'undefined') {
    console.error('❌ unitQuestions not found! Make sure unitwiseQuestions.js is loaded.');
    window.UNIT_DATA = [];
    return;
  }

  const unitMap = {};

  unitQuestions.forEach(function (q) {
    const unitKey = q.unit;

    if (!unitMap[unitKey]) {
      unitMap[unitKey] = { name: unitKey, questions: [] };
    }

    const answerIndex = q.options.indexOf(q.answer);

    if (answerIndex === -1) {
      console.warn('⚠️ Question ID ' + q.id + ': Answer "' + q.answer + '" not found in options.');
    }

    unitMap[unitKey].questions.push({
      id:      q.id,
      q:       q.question,
      options: q.options,
      answer:  answerIndex === -1 ? 0 : answerIndex
    });
  });

  const units = Object.values(unitMap).sort(function (a, b) {
    const numA = parseInt((a.name.match(/\d+/) || ['0'])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || ['0'])[0], 10);
    return numA - numB;
  });

  window.UNIT_DATA = units;
  console.log('✅ Loaded ' + units.length + ' units with ' + unitQuestions.length + ' questions');
})();


/* ═══════════════════════════════════════════════════════════════
   QUIZ ENGINE
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────── */
  function $  (id)  { return document.getElementById(id); }
  function $$ (sel) { return document.querySelectorAll(sel); }

  /* ── Constants ────────────────────────────── */
  var UNITS = window.UNIT_DATA || [];
  var KEYS  = ['A', 'B', 'C', 'D'];

  /* ── Quiz state ───────────────────────────── */
  var state = {
    activeUnit : null,
    currentQ   : 0,
    answers    : [],
    statuses   : [],  // 'unanswered' | 'answered' | 'skipped'
    unitsDone  : {}
  };

  /* ══════════════════════════════════════════
     INITIALISE
  ══════════════════════════════════════════ */
  function init() {
    if (UNITS.length === 0) {
      console.warn('⚠️ No units available.');
      showEmptyState();
      return;
    }
    buildSidebar();
    attachQuizListeners();
    attachDrawerListeners();
    updateOverallProgress();
    console.log('✅ Quiz initialised');
  }

  /* ══════════════════════════════════════════
     SIDEBAR
  ══════════════════════════════════════════ */
  function buildSidebar() {
    var container = $('uwUnitList');
    if (!container) return;
    container.innerHTML = '';

    UNITS.forEach(function (unit, idx) {
      var li = document.createElement('li');
      li.className = 'uw-unit-item';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.unitIdx = idx;

      var qCount = unit.questions.length;
      var qLabel = qCount === 1 ? 'question' : 'questions';

      li.innerHTML =
        '<span class="uw-unit-num">' + (idx + 1) + '</span>' +
        '<span class="uw-unit-info">' +
          '<span class="uw-unit-name">' + escHtml(unit.name) + '</span>' +
          '<span class="uw-unit-count">' + qCount + ' ' + qLabel + '</span>' +
        '</span>' +
        '<svg class="uw-unit-arrow" width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
          '<path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/>' +
        '</svg>';

      li.addEventListener('click', function () {
        loadUnit(idx);
        closeSidebar();   // auto-close drawer on mobile
      });

      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadUnit(idx);
          closeSidebar();
        }
      });

      container.appendChild(li);
    });
  }

  function showEmptyState() {
    var title = $('uwWelcome') && $('uwWelcome').querySelector('.uw-welcome-title');
    if (title) title.textContent = 'No Units Available';
  }

  /* ══════════════════════════════════════════
     LOAD UNIT
  ══════════════════════════════════════════ */
  function loadUnit(idx) {
    var unit = UNITS[idx];
    if (!unit) return;

    state.activeUnit = idx;
    state.currentQ   = 0;

    var total        = unit.questions.length;
    state.answers    = new Array(total).fill(null);
    state.statuses   = new Array(total).fill('unanswered');

    /* Sidebar active state */
    $$('.uw-unit-item').forEach(function (el, i) {
      el.classList.toggle('is-active', i === idx);
    });

    /* Header labels */
    $('quizUnitTag').textContent  = 'Unit ' + (idx + 1);
    $('quizUnitName').textContent = unit.name;
    $('totalQNum').textContent    = total;

    /* Topbar unit tag (mobile) */
    var topTag = $('topbarUnitTag');
    if (topTag) {
      topTag.textContent = 'Unit ' + (idx + 1);
      topTag.classList.remove('uw-hidden');
    }

    /* Show palette open button on mobile */
    var paletteBtn = $('paletteOpenBtn');
    if (paletteBtn) paletteBtn.classList.remove('uw-hidden');

    /* Screen switching */
    $('uwWelcome').classList.add('uw-hidden');
    $('uwResult').classList.add('uw-hidden');
    $('uwQuiz').classList.remove('uw-hidden');

    if (total === 0) {
      showEmptyUnit();
      return;
    }

    $('nextBtn').disabled = false;
    $('skipBtn').disabled = false;

    buildPalette();
    renderQuestion();
    updateSummary();
  }

  function showEmptyUnit() {
    $('questionText').textContent  = 'No questions available in this unit yet.';
    $('optionsList').innerHTML     = '';
    $('feedbackBanner').className  = 'uw-feedback uw-hidden';
    $('qNumber').textContent       = 'Question —';
    $('currentQNum').textContent   = '—';
    $('prevBtn').disabled          = true;
    $('nextBtn').disabled          = true;
    $('skipBtn').disabled          = true;
    $('paletteGrid').innerHTML     = '';
    updateProgressBar(0, 0);
    updateSummary();
  }

  /* ══════════════════════════════════════════
     RENDER QUESTION
  ══════════════════════════════════════════ */
  function renderQuestion() {
    var unit  = UNITS[state.activeUnit];
    var idx   = state.currentQ;
    var total = unit.questions.length;
    var q     = unit.questions[idx];

    $('currentQNum').textContent = idx + 1;
    $('qNumber').textContent     = 'Question ' + (idx + 1);
    updateProgressBar(idx + 1, total);
    $('questionText').textContent = q.q;

    /* Build options */
    var list = $('optionsList');
    list.innerHTML = '';

    q.options.forEach(function (optText, oi) {
      var li = document.createElement('li');
      li.className = 'uw-opt';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.oi = oi;

      if (state.statuses[idx] === 'answered') {
        li.classList.add('is-disabled');
        if (oi === q.answer)               li.classList.add('is-correct');
        if (state.answers[idx] === oi) {
          li.classList.add('is-selected');
          if (oi !== q.answer)             li.classList.add('is-wrong');
        }
      }

      li.innerHTML =
        '<span class="uw-opt-key">' + KEYS[oi] + '</span>' +
        '<span class="uw-opt-val">' + escHtml(optText) + '</span>' +
        '<span class="uw-opt-dot"></span>';

      li.addEventListener('click', function () { selectOption(oi); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(oi); }
      });

      list.appendChild(li);
    });

    /* Feedback */
    var fb = $('feedbackBanner');
    if (state.statuses[idx] === 'answered') {
      var correct = state.answers[idx] === q.answer;
      fb.className   = 'uw-feedback ' + (correct ? 'is-correct-fb' : 'is-wrong-fb');
      fb.textContent = correct
        ? '✓ Correct! Well done.'
        : '✗ Wrong. Correct answer: ' + q.options[q.answer];
    } else {
      fb.className   = 'uw-feedback uw-hidden';
      fb.textContent = '';
    }

    /* Prev button */
    $('prevBtn').disabled = idx === 0;

    /* Next / Finish button */
    var nextBtn = $('nextBtn');
    if (idx === total - 1) {
      nextBtn.innerHTML = 'Finish';
    } else {
      nextBtn.innerHTML =
        'Next ' +
        '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
          '<path d="M6.22 12.78a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06L7.28 3.22a.75.75 0 00-1.06 1.06L9.94 8 6.22 11.72a.75.75 0 000 1.06z"/>' +
        '</svg>';
    }

    updatePaletteHighlight();
    syncMobilePalette();
  }

  /* ══════════════════════════════════════════
     PROGRESS BAR
  ══════════════════════════════════════════ */
  function updateProgressBar(current, total) {
    if (total === 0) {
      $('linearFill').style.width    = '0%';
      $('progressLabel').textContent = 'No questions';
      $('progressPct').textContent   = '0%';
      return;
    }
    var pct = Math.round((current / total) * 100);
    $('linearFill').style.width    = pct + '%';
    $('progressLabel').textContent = 'Question ' + current + ' of ' + total;
    $('progressPct').textContent   = pct + '%';
  }

  /* ══════════════════════════════════════════
     SELECT OPTION
  ══════════════════════════════════════════ */
  function selectOption(oi) {
    var idx = state.currentQ;
    if (state.statuses[idx] === 'answered') return;

    state.answers[idx]  = oi;
    state.statuses[idx] = 'answered';

    var q    = UNITS[state.activeUnit].questions[idx];
    var opts = $$('#optionsList .uw-opt');

    opts.forEach(function (el) { el.classList.add('is-disabled'); });

    opts.forEach(function (el, i) {
      if (i === q.answer)              el.classList.add('is-correct');
      else if (i === oi && oi !== q.answer) el.classList.add('is-wrong');
    });
    opts[oi].classList.add('is-selected');

    var fb      = $('feedbackBanner');
    var correct = oi === q.answer;
    fb.className   = 'uw-feedback ' + (correct ? 'is-correct-fb' : 'is-wrong-fb');
    fb.textContent = correct
      ? '✓ Correct! Well done.'
      : '✗ Wrong. Correct answer: ' + q.options[q.answer];

    updatePaletteHighlight();
    updateSummary();
    syncMobilePalette();
  }

  /* ══════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════ */
  function goPrevious() {
    if (state.currentQ > 0) {
      state.currentQ--;
      renderQuestion();
    }
  }

  function goNext() {
    var total = UNITS[state.activeUnit].questions.length;
    if (state.currentQ === total - 1) {
      submitQuiz();
    } else {
      state.currentQ++;
      renderQuestion();
    }
  }

  function skipQuestion() {
    var idx = state.currentQ;
    if (state.statuses[idx] === 'unanswered') {
      state.statuses[idx] = 'skipped';
    }
    var total = UNITS[state.activeUnit].questions.length;
    if (state.currentQ < total - 1) {
      state.currentQ++;
      renderQuestion();
    }
    updatePaletteHighlight();
    updateSummary();
    syncMobilePalette();
  }

  function resetQuiz() {
    if (confirm('Reset this unit? All progress will be lost.')) {
      loadUnit(state.activeUnit);
    }
  }

  /* ══════════════════════════════════════════
     OVERALL PROGRESS
  ══════════════════════════════════════════ */
  function updateOverallProgress() {
    var totalQ = 0, totalCorrect = 0;
    Object.values(state.unitsDone).forEach(function (u) {
      totalQ       += u.total;
      totalCorrect += u.correct;
    });
    var pct = totalQ === 0 ? 0 : Math.round((totalCorrect / totalQ) * 100);
    $('overallPct').textContent       = pct + '%';
    $('overallBar').style.width       = pct + '%';
  }

  /* ══════════════════════════════════════════
     PALETTE — DESKTOP
  ══════════════════════════════════════════ */
  function buildPalette() {
    var total = UNITS[state.activeUnit].questions.length;
    var grid  = $('paletteGrid');
    grid.innerHTML = '';

    for (var i = 0; i < total; i++) {
      (function (qi) {
        var btn = document.createElement('button');
        btn.className = 'uw-pg-btn';
        btn.textContent = qi + 1;
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('aria-label', 'Go to question ' + (qi + 1));
        btn.dataset.qi = qi;

        btn.addEventListener('click', function () {
          state.currentQ = qi;
          renderQuestion();
        });

        grid.appendChild(btn);
      })(i);
    }

    updatePaletteHighlight();
  }

  function updatePaletteHighlight() {
    $$('#paletteGrid .uw-pg-btn').forEach(function (btn, i) {
      btn.classList.remove('is-current', 'is-answered', 'is-skipped');
      if (i === state.currentQ)                   btn.classList.add('is-current');
      else if (state.statuses[i] === 'answered')  btn.classList.add('is-answered');
      else if (state.statuses[i] === 'skipped')   btn.classList.add('is-skipped');
    });
  }

  function updateSummary() {
    var answered  = state.statuses.filter(function (s) { return s === 'answered';  }).length;
    var skipped   = state.statuses.filter(function (s) { return s === 'skipped';   }).length;
    var remaining = state.statuses.filter(function (s) { return s === 'unanswered';}).length;

    $('sumAnswered').textContent  = answered;
    $('sumSkipped').textContent   = skipped;
    $('sumRemaining').textContent = remaining;
  }

  /* ══════════════════════════════════════════
     MOBILE PALETTE — sync from desktop
  ══════════════════════════════════════════ */
  function syncMobilePalette() {
    var mobileGrid = $('paletteGridMobile');
    var desktopGrid = $('paletteGrid');
    if (!mobileGrid || !desktopGrid) return;

    /* Rebuild mobile grid mirroring desktop */
    mobileGrid.innerHTML = '';
    var btns = desktopGrid.querySelectorAll('.uw-pg-btn');

    btns.forEach(function (btn) {
      var qi    = parseInt(btn.dataset.qi, 10);
      var clone = document.createElement('button');
      clone.className   = btn.className;  // copies is-current / is-answered / is-skipped
      clone.textContent = btn.textContent;
      clone.setAttribute('role', 'listitem');
      clone.setAttribute('aria-label', 'Go to question ' + (qi + 1));
      clone.dataset.qi  = qi;

      clone.addEventListener('click', function () {
        state.currentQ = qi;
        renderQuestion();
        closePaletteDrawer();
      });

      mobileGrid.appendChild(clone);
    });

    /* Sync summary counts */
    var pairs = [
      ['sumAnswered',  'sumAnsweredMobile'],
      ['sumSkipped',   'sumSkippedMobile'],
      ['sumRemaining', 'sumRemainingMobile']
    ];
    pairs.forEach(function (pair) {
      var src  = $(pair[0]);
      var dest = $(pair[1]);
      if (src && dest) dest.textContent = src.textContent;
    });
  }

  /* ══════════════════════════════════════════
     SUBMIT QUIZ
  ══════════════════════════════════════════ */
  function handleSubmitBtn() {
    var unanswered = state.statuses.filter(function (s) { return s === 'unanswered'; }).length;
    if (unanswered > 0) {
      if (!confirm('You have ' + unanswered + ' unanswered question(s). Submit anyway?')) return;
    }
    submitQuiz();
  }

  function submitQuiz() {
    var unit  = UNITS[state.activeUnit];
    var total = unit.questions.length;
    if (total === 0) return;

    var correct = 0, wrong = 0, skipped = 0;

    unit.questions.forEach(function (q, i) {
      if (state.statuses[i] === 'skipped' || state.answers[i] === null) {
        skipped++;
      } else if (state.answers[i] === q.answer) {
        correct++;
      } else {
        wrong++;
      }
    });

    var scorePct = Math.round((correct / total) * 100);

    state.unitsDone[state.activeUnit] = { correct: correct, total: total };
    updateOverallProgress();

    /* Populate result screen */
    $('resStat1').textContent  = correct;
    $('resStat2').textContent  = wrong;
    $('resStat3').textContent  = skipped;
    $('resStat4').textContent  = scorePct + '%';
    $('ringLabel').textContent = scorePct + '%';

    var circumference = 339;
    var offset        = circumference - (circumference * scorePct / 100);
    var ring          = $('scoreRing');
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = scorePct >= 70 ? '#34c87a' : scorePct >= 40 ? '#f5a623' : '#f05353';

    var tier = scorePct === 100 ? 'perfect' : scorePct >= 70 ? 'good' : scorePct >= 40 ? 'okay' : 'low';
    var messages = {
      perfect : { emoji: '🏆', title: 'Perfect Score!' },
      good    : { emoji: '🎯', title: 'Well Done!' },
      okay    : { emoji: '📚', title: 'Keep Practising' },
      low     : { emoji: '💪', title: "Don't Give Up!" }
    };

    $('resultIcon').textContent  = messages[tier].emoji;
    $('resultTitle').textContent = messages[tier].title;
    $('resultSub').textContent   = 'You scored ' + scorePct + '% on ' + escHtml(unit.name);

    $('nextUnitBtn').style.display = state.activeUnit < UNITS.length - 1 ? '' : 'none';

    /* Hide topbar palette btn on result screen */
    var paletteBtn = $('paletteOpenBtn');
    if (paletteBtn) paletteBtn.classList.add('uw-hidden');

    var topTag = $('topbarUnitTag');
    if (topTag) topTag.classList.add('uw-hidden');

    $('uwQuiz').classList.add('uw-hidden');
    $('uwResult').classList.remove('uw-hidden');
  }

  /* ══════════════════════════════════════════
     QUIZ EVENT LISTENERS
  ══════════════════════════════════════════ */
  function attachQuizListeners() {
    $('prevBtn')    && $('prevBtn').addEventListener('click', goPrevious);
    $('nextBtn')    && $('nextBtn').addEventListener('click', goNext);
    $('skipBtn')    && $('skipBtn').addEventListener('click', skipQuestion);
    $('resetBtn')   && $('resetBtn').addEventListener('click', resetQuiz);
    $('submitBtn')  && $('submitBtn').addEventListener('click', handleSubmitBtn);

    /* Mobile submit mirrors desktop */
    $('submitBtnMobile') && $('submitBtnMobile').addEventListener('click', function () {
      closePaletteDrawer();
      handleSubmitBtn();
    });

    $('retryBtn') && $('retryBtn').addEventListener('click', function () {
      loadUnit(state.activeUnit);
    });

    $('nextUnitBtn') && $('nextUnitBtn').addEventListener('click', function () {
      var next = state.activeUnit + 1;
      if (next < UNITS.length) loadUnit(next);
    });

    /* Keyboard shortcuts */
    document.addEventListener('keydown', function (e) {
      if (!$('uwQuiz') || $('uwQuiz').classList.contains('uw-hidden')) return;

      /* Ignore if focus is in an input / textarea */
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowRight') { e.preventDefault(); $('nextBtn').click(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); $('prevBtn').click(); }

      if (['1', '2', '3', '4'].includes(e.key)) {
        var oi  = parseInt(e.key, 10) - 1;
        var opt = $$('#optionsList .uw-opt')[oi];
        if (opt && !opt.classList.contains('is-disabled')) selectOption(oi);
      }
    });
  }

  /* ══════════════════════════════════════════
     DRAWER / OVERLAY LISTENERS
  ══════════════════════════════════════════ */

  var sidebarOpen = false;
  var paletteOpen = false;

  function openSidebar() {
    var sidebar = $('uwSidebar');
    var overlay = $('uwOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.add('is-open');
    overlay.classList.add('is-visible');
    overlay.style.display = 'block';
    $('sidebarOpenBtn') && $('sidebarOpenBtn').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    sidebarOpen = true;
  }

  function closeSidebar() {
    var sidebar = $('uwSidebar');
    var overlay = $('uwOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('is-open');
    if (!paletteOpen) {
      overlay.classList.remove('is-visible');
      /* Delay display:none until transition ends */
      setTimeout(function () {
        if (!sidebarOpen && !paletteOpen) overlay.style.display = 'none';
      }, 250);
      document.body.style.overflow = '';
    }
    $('sidebarOpenBtn') && $('sidebarOpenBtn').setAttribute('aria-expanded', 'false');
    sidebarOpen = false;
  }

  function openPaletteDrawer() {
    var drawer  = $('uwPaletteDrawer');
    var overlay = $('uwOverlay');
    if (!drawer || !overlay) return;
    syncMobilePalette();
    drawer.classList.add('is-open');
    overlay.classList.add('is-visible');
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    paletteOpen = true;
  }

  function closePaletteDrawer() {
    var drawer  = $('uwPaletteDrawer');
    var overlay = $('uwOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.remove('is-open');
    if (!sidebarOpen) {
      overlay.classList.remove('is-visible');
      setTimeout(function () {
        if (!sidebarOpen && !paletteOpen) overlay.style.display = 'none';
      }, 250);
      document.body.style.overflow = '';
    }
    paletteOpen = false;
  }

  function attachDrawerListeners() {
    /* Hamburger */
    var hamburger = $('sidebarOpenBtn');
    if (hamburger) {
      hamburger.addEventListener('click', function () {
        sidebarOpen ? closeSidebar() : openSidebar();
      });
    }

    /* Palette open button */
    var paletteBtn = $('paletteOpenBtn');
    if (paletteBtn) {
      paletteBtn.addEventListener('click', function () {
        paletteOpen ? closePaletteDrawer() : openPaletteDrawer();
      });
    }

    /* Shared overlay click */
    var overlay = $('uwOverlay');
    if (overlay) {
      overlay.addEventListener('click', function () {
        if (sidebarOpen) closeSidebar();
        if (paletteOpen) closePaletteDrawer();
      });
    }

    /* Escape key */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (sidebarOpen) closeSidebar();
      if (paletteOpen) closePaletteDrawer();
    });

    /* Swipe-left on sidebar to close */
    var sidebar = $('uwSidebar');
    var swipeStartX = 0;
    if (sidebar) {
      sidebar.addEventListener('touchstart', function (e) {
        swipeStartX = e.touches[0].clientX;
      }, { passive: true });

      sidebar.addEventListener('touchend', function (e) {
        var delta = e.changedTouches[0].clientX - swipeStartX;
        if (delta < -60) closeSidebar();
      }, { passive: true });
    }

    /* Swipe-down on palette drawer to close */
    var drawer = $('uwPaletteDrawer');
    var swipeStartY = 0;
    if (drawer) {
      drawer.addEventListener('touchstart', function (e) {
        swipeStartY = e.touches[0].clientY;
      }, { passive: true });

      drawer.addEventListener('touchend', function (e) {
        var delta = e.changedTouches[0].clientY - swipeStartY;
        if (delta > 60) closePaletteDrawer();
      }, { passive: true });
    }

    /* Hide overlay initially */
    var ov = $('uwOverlay');
    if (ov) ov.style.display = 'none';
  }

  /* ══════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════ */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ══════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();