(function () {
    'use strict';

    /* ══════════════════════════════════════════
       SCOPED TO IMPORTANT TEST SECTION ONLY
    ══════════════════════════════════════════ */

    const SECTION = document.getElementById('testSection');
    if (!SECTION) {
        console.error('❌ Important Test Section not found');
        return;
    }

    // Scoped DOM selectors
    const $ = (id) => SECTION.querySelector('#' + id);
    const $$ = (sel) => SECTION.querySelectorAll(sel);

    /* ══════════════════════════════════════════
       DATA INITIALIZATION
    ══════════════════════════════════════════ */
    let QUESTIONS = (
        typeof window.IT_DATA !== 'undefined' &&
        Array.isArray(window.IT_DATA) &&
        window.IT_DATA.length > 0
    ) ? [...window.IT_DATA] : [];

    let TOTAL = QUESTIONS.length;
    let ORIGINAL_QUESTIONS = null;
    let isWrongQuestionsMode = false;

    /* ══════════════════════════════════════════
       STATE
    ══════════════════════════════════════════ */
    let state = {
        currentQ: 0,
        answers: Array(TOTAL).fill(null),
        statuses: Array(TOTAL).fill('unanswered'),
        timerSec: 0,
        timerID: null,
        submitted: false,
        wrongList: []
    };

    /* ══════════════════════════════════════════
       LOCAL STORAGE
    ══════════════════════════════════════════ */
    const STORAGE_KEY = 'importantTest_progress';

    function saveProgress() {
        const progressData = {
            currentQ: state.currentQ,
            answers: state.answers,
            statuses: state.statuses,
            timerSec: state.timerSec,
            submitted: state.submitted,
            wrongList: state.wrongList,
            total: TOTAL,
            isWrongMode: isWrongQuestionsMode,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progressData));
            console.log('💾 Progress auto-saved');
        } catch (e) {
            console.warn('⚠️ Could not save progress:', e);
        }
    }

    function loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return false;

            const data = JSON.parse(saved);

            if (data.total !== TOTAL) {
                console.warn('⚠️ Question count changed, clearing old progress');
                clearProgress();
                return false;
            }

            state.currentQ = data.currentQ || 0;
            state.answers = data.answers || Array(TOTAL).fill(null);
            state.statuses = data.statuses || Array(TOTAL).fill('unanswered');
            state.timerSec = data.timerSec || 0;
            state.submitted = data.submitted || false;
            state.wrongList = data.wrongList || [];
            isWrongQuestionsMode = data.isWrongMode || false;

            console.log(`✅ Progress restored`);
            return true;
        } catch (e) {
            console.warn('⚠️ Could not load progress:', e);
            return false;
        }
    }

    function clearProgress() {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️ Progress cleared');
    }

    /* ══════════════════════════════════════════
       SECTION NAVIGATION
    ══════════════════════════════════════════ */
    function showImportantTest() {
        SECTION.classList.remove('it-hidden');
        // Hide other sections (adjust IDs based on your main.html)
        const sections = ['hero', 'unitwise', 'practice']; // Add your section IDs
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('it-hidden');
        });
    }

    //   function hideImportantTest() {
    //     SECTION.classList.add('hidden');
    //     // Show home section (adjust ID based on your main.html)
    //     const home = document.getElementById('hero'); // Change to your home section ID
    //     if (home) home.classList.remove('it-hidden');
    //   }

    /* ══════════════════════════════════════════
       TIMER
    ══════════════════════════════════════════ */
    //   Start Timer
    function startTimer() {
        clearInterval(state.timerID);
        state.timerID = setInterval(() => {
            state.timerSec++;
            renderTimer();
            saveProgress();
        }, 1000);
    }

    //   Stop Timer
    function stopTimer(reset = false) {
        clearInterval(state.timerID);
        state.timerID = null;

        if (reset) {
            state.timerSec = 0;
            // renderTimer();
            // saveProgress();
        }
    }

    // render timer
    function renderTimer() {
        const m = String(Math.floor(state.timerSec / 60)).padStart(2, '0');
        const s = String(state.timerSec % 60).padStart(2, '0');
        $('timerDisplay').textContent = `${m}:${s}`;

        const timerEl = $('itTimer');
        timerEl.classList.remove('is-warn', 'is-danger');
        if (state.timerSec >= 1200) timerEl.classList.add('is-danger');
        else if (state.timerSec >= 900) timerEl.classList.add('is-warn');
    }

    function getTimerDisplay(sec) {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `${m}:${s}`;
    }

    /* ══════════════════════════════════════════
       RENDER QUESTION
    ══════════════════════════════════════════ */
    function renderQuestion() {
        if (TOTAL === 0) return;

        const idx = state.currentQ;
        const q = QUESTIONS[idx];
        const keys = ['A', 'B', 'C', 'D'];

        $('itCurrentQNum').textContent = idx + 1;
        $('itQNum').textContent = `Question ${idx + 1}`;
        $('itQText').textContent = q.q;

        const list = $('itOptionsList');
        list.innerHTML = '';

        q.options.forEach((optText, oi) => {
            const li = document.createElement('li');
            li.className = 'it-opt';
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');
            li.dataset.oi = oi;

            if (state.answers[idx] === oi) {
                li.classList.add('is-selected');
            }

            if (state.submitted) {
                li.classList.add('is-disabled');
                if (oi === q.answer) li.classList.add('is-correct');
                if (state.answers[idx] === oi && oi !== q.answer)
                    li.classList.add('is-wrong');
            }

            li.innerHTML = `
        <span class="it-opt-key">${keys[oi]}</span>
        <span class="it-opt-val">${optText}</span>
        <span class="it-opt-dot"></span>
      `;

            if (!state.submitted) {
                li.addEventListener('click', () => selectOption(oi));
                li.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectOption(oi);
                    }
                });
            }

            list.appendChild(li);
        });

        $('itPrevBtn').disabled = idx === 0;
        $('itNextBtn').disabled = idx === TOTAL - 1;

        updateProgress();
        updatePalette();
        updateStatusBar();
    }

    /* ══════════════════════════════════════════
       SELECT OPTION
    ══════════════════════════════════════════ */
    function selectOption(oi) {
        const idx = state.currentQ;
        state.answers[idx] = oi;
        state.statuses[idx] = 'answered';

        $$('#itOptionsList .it-opt').forEach((el, i) => {
            el.classList.toggle('is-selected', i === oi);
        });

        updatePalette();
        updateStatusBar();
        saveProgress();
    }

    /* ══════════════════════════════════════════
       NAVIGATION
    ══════════════════════════════════════════ */
    $('itPrevBtn').addEventListener('click', () => {
        if (state.currentQ > 0) {
            state.currentQ--;
            renderQuestion();
            saveProgress();
        }
    });

    $('itNextBtn').addEventListener('click', () => {
        if (state.currentQ < TOTAL - 1) {
            state.currentQ++;
            renderQuestion();
            saveProgress();
        }
    });

    $('itSkipBtn').addEventListener('click', () => {
        const idx = state.currentQ;
        if (state.statuses[idx] === 'unanswered') {
            state.statuses[idx] = 'skipped';
        }
        if (state.currentQ < TOTAL - 1) {
            state.currentQ++;
            renderQuestion();
        }
        updatePalette();
        updateStatusBar();
        saveProgress();
    });

    /* ══════════════════════════════════════════
       PALETTE
    ══════════════════════════════════════════ */
    function buildPalette() {
        const grid = $('itPaletteGrid');
        grid.innerHTML = '';

        for (let i = 0; i < TOTAL; i++) {
            const btn = document.createElement('button');
            btn.className = 'it-pg-btn';
            btn.textContent = i + 1;
            btn.dataset.qi = i;
            btn.addEventListener('click', () => {
                state.currentQ = i;
                renderQuestion();
                saveProgress();
            });
            grid.appendChild(btn);
        }
    }

    function updatePalette() {
        $$('#itPaletteGrid .it-pg-btn').forEach((btn, i) => {
            btn.classList.remove('is-current', 'is-answered', 'is-skipped');
            if (i === state.currentQ) {
                btn.classList.add('is-current');
            } else if (state.statuses[i] === 'answered') {
                btn.classList.add('is-answered');
            } else if (state.statuses[i] === 'skipped') {
                btn.classList.add('is-skipped');
            }
        });
    }

    /* ══════════════════════════════════════════
       PROGRESS
    ══════════════════════════════════════════ */
    function updateProgress() {
        if (TOTAL === 0) return;
        const pct = Math.round(((state.currentQ + 1) / TOTAL) * 100);
        $('itProgressFill').style.width = `${pct}%`;
        $('itProgressLabel').textContent = `Question ${state.currentQ + 1} of ${TOTAL}`;
        $('itProgressPct').textContent = `${pct}%`;
    }

    function updateStatusBar() {
        const answered = state.statuses.filter(s => s === 'answered').length;
        const skipped = state.statuses.filter(s => s === 'skipped').length;
        const unseen = state.statuses.filter(s => s === 'unanswered').length;

        $('itStatCurrent').textContent = state.currentQ + 1;
        $('itStatAnswered').textContent = answered;
        $('itStatSkipped').textContent = skipped;
        $('itStatUnseen').textContent = unseen;
    }

    /* ══════════════════════════════════════════
       SUBMIT MODAL
    ══════════════════════════════════════════ */
    function openSubmitModal() {
        const answered = state.statuses.filter(s => s === 'answered').length;
        const skipped = state.statuses.filter(s => s === 'skipped').length;
        const unseen = state.statuses.filter(s => s === 'unanswered').length;

        $('itModalAnswered').textContent = answered;
        $('itModalSkipped').textContent = skipped;
        $('itModalUnseen').textContent = unseen;

        $('itModalBackdrop').classList.remove('it-hidden');
    }

    function closeSubmitModal() {
        $('itModalBackdrop').classList.add('it-hidden');
    }

    $('itSubmitTopBtn').addEventListener('click', openSubmitModal);
    $('itModalClose').addEventListener('click', closeSubmitModal);
    $('itModalCancel').addEventListener('click', closeSubmitModal);

    $('itModalBackdrop').addEventListener('click', e => {
        if (e.target === $('itModalBackdrop')) closeSubmitModal();
    });

    $('itModalConfirm').addEventListener('click', () => {
        closeSubmitModal();
        submitTest();
    });

    /* ══════════════════════════════════════════
       SUBMIT & RESULTS
    ══════════════════════════════════════════ */
    function submitTest() {
        clearInterval(state.timerID);
        state.submitted = true;
        saveProgress();
        calculateAndShowResults();
    }

    function calculateAndShowResults() {
        let correct = 0, wrong = 0, skipped = 0, unseen = 0;
        state.wrongList = [];

        QUESTIONS.forEach((q, i) => {
            const status = state.statuses[i];
            const answer = state.answers[i];

            if (status === 'unanswered') {
                unseen++;
            } else if (status === 'skipped') {
                skipped++;
            } else if (answer === q.answer) {
                correct++;
            } else {
                wrong++;
                state.wrongList.push(i);
            }
        });

        const attempted = correct + wrong;
        const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
        const scorePct = Math.round((correct / TOTAL) * 100);
        const timeTaken = getTimerDisplay(state.timerSec);

        $('itResCorrect').textContent = correct;
        $('itResWrong').textContent = wrong;
        $('itResSkipped').textContent = skipped;
        $('itResUnseen').textContent = unseen;
        $('itResScore').textContent = `${accuracy}%`;
        $('itResTime').textContent = timeTaken;
        $('itResRingPct').textContent = `${scorePct}%`;

        const circumference = 364;
        const offset = circumference - (circumference * scorePct / 100);
        $('itResRingArc').style.strokeDashoffset = offset;
        $('itResRingArc').style.stroke =
            scorePct >= 70 ? '#34c87a' :
                scorePct >= 40 ? '#f5a623' : '#f05353';

        const tier =
            scorePct === 100 ? 'perfect' :
                scorePct >= 70 ? 'good' :
                    scorePct >= 40 ? 'okay' : 'low';

        const messages = {
            perfect: { emoji: '🏆', title: 'Perfect Score!', sub: `You aced all ${TOTAL} questions!` },
            good: { emoji: '🎯', title: 'Excellent Work!', sub: `You scored ${scorePct}% — great job!` },
            okay: { emoji: '📚', title: 'Keep Practicing', sub: `You scored ${scorePct}% — review and retry!` },
            low: { emoji: '💪', title: 'Keep Going!', sub: `You scored ${scorePct}% — practice makes perfect!` }
        };

        $('itResEmoji').textContent = messages[tier].emoji;
        $('itResTitle').textContent = messages[tier].title;
        $('itResSub').textContent = messages[tier].sub;

        $('itRetryWrongBtn').style.display = state.wrongList.length > 0 ? '' : 'none';

        showResults();
        saveProgress();
    }

    function showResults() {
        $('itQuizPage').classList.add('it-hidden');
        $('itResultPage').classList.remove('it-hidden');
    }

    function showQuizPage() {
        $('itQuizPage').classList.remove('it-hidden');
        $('itResultPage').classList.add('it-hidden');
    }

    /* ══════════════════════════════════════════
       RETRY FULL TEST
    ══════════════════════════════════════════ */
    $('itRetryBtn').addEventListener('click', () => {
        if (isWrongQuestionsMode && ORIGINAL_QUESTIONS) {
            QUESTIONS = [...ORIGINAL_QUESTIONS];
            TOTAL = QUESTIONS.length;
            isWrongQuestionsMode = false;
        }

        state.currentQ = 0;
        state.answers = Array(TOTAL).fill(null);
        state.statuses = Array(TOTAL).fill('unanswered');
        state.submitted = false;
        state.wrongList = [];
        state.timerSec = 0;

        clearProgress();

        $('itTestSubtitle').textContent = `${TOTAL} Questions`;
        $('itTotalQNum').textContent = TOTAL;

        showQuizPage();
        $('itResRingArc').style.strokeDashoffset = 364;

        buildPalette();
        renderQuestion();
        updateStatusBar();
        updateProgress();
        startTimer();
    });

    /* ══════════════════════════════════════════
       RETRY WRONG QUESTIONS
    ══════════════════════════════════════════ */
    $('itRetryWrongBtn').addEventListener('click', () => {
        if (state.wrongList.length === 0) {
            alert('✅ No wrong answers to practice!');
            return;
        }

        if (!ORIGINAL_QUESTIONS) {
            ORIGINAL_QUESTIONS = [...QUESTIONS];
        }

        const wrongQuestions = state.wrongList.map(idx => ORIGINAL_QUESTIONS[idx]);
        QUESTIONS = [...wrongQuestions];
        TOTAL = QUESTIONS.length;
        isWrongQuestionsMode = true;

        state.currentQ = 0;
        state.answers = Array(TOTAL).fill(null);
        state.statuses = Array(TOTAL).fill('unanswered');
        state.submitted = false;
        state.wrongList = [];
        state.timerSec = 0;

        clearProgress();
        saveProgress();

        $('itTestSubtitle').textContent = `${TOTAL} Wrong Questions — Practice Mode`;
        $('itTotalQNum').textContent = TOTAL;

        showQuizPage();
        $('itResRingArc').style.strokeDashoffset = 364;

        buildPalette();
        renderQuestion();
        updateStatusBar();
        updateProgress();
        startTimer();
    });

    /* ══════════════════════════════════════════
       Test Section Button
    ══════════════════════════════════════════ */

    testBtn = document.querySelector("#testBtn");
    testBtn.addEventListener("click", (e) => {
        startTimer();
    })

    /* ══════════════════════════════════════════
       BACK TO HOME BUTTON (Fixed)
    ══════════════════════════════════════════ */
    $('itHomeBtn').addEventListener('click', (e) => {
        e.preventDefault();
        stopTimer(true);
        clearProgress();
    });

    /* ══════════════════════════════════════════
       CLEAR PROGRESS
    ══════════════════════════════════════════ */
    $('itClearBtn').addEventListener('click', () => {
        if (confirm('⚠️ Clear all progress and restart?\n\nAre you sure?')) {
            clearProgress();
            stopTimer();
            location.reload();
        }
    });

    /* ══════════════════════════════════════════
       KEYBOARD SHORTCUTS
    ══════════════════════════════════════════ */
    document.addEventListener('keydown', (e) => {
        // Only work when section is visible
        if (SECTION.classList.contains('it-hidden')) return;
        if (!$('itModalBackdrop').classList.contains('it-hidden')) return;

        if (e.key === 'ArrowRight') { e.preventDefault(); $('itNextBtn').click(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); $('itPrevBtn').click(); }

        if (['1', '2', '3', '4'].includes(e.key) && !state.submitted) {
            const oi = parseInt(e.key) - 1;
            const opt = $$('#itOptionsList .it-opt')[oi];
            if (opt) selectOption(oi);
        }

        if (e.key === 'Escape') closeSubmitModal();
    });

    /* ══════════════════════════════════════════
       INIT
    ══════════════════════════════════════════ */
    function initTest() {
        if (TOTAL === 0) {
            $('itQText').textContent = 'No questions found. Please check importantTestQuestions.js';
            $('itOptionsList').innerHTML = '';
            $('itTestSubtitle').textContent = '0 questions';
            $('itTotalQNum').textContent = '0';
            console.error('❌ No questions loaded');
            return;
        }

        const hasProgress = loadProgress();

        $('itTestSubtitle').textContent = isWrongQuestionsMode
            ? `${TOTAL} Wrong Questions — Practice Mode`
            : `${TOTAL} Questions`;
        $('itTotalQNum').textContent = TOTAL;

        if (hasProgress && state.submitted) {
            buildPalette();
            renderQuestion();
            updateStatusBar();
            updateProgress();
            calculateAndShowResults();
            return;
        }

        buildPalette();
        renderQuestion();
        updateStatusBar();
        updateProgress();
        // startTimer();

        console.log(`✅ Loaded ${TOTAL} questions`);
    }

    /* ══════════════════════════════════════════
       EXPOSE GLOBAL FUNCTION TO START TEST
       Call this from your main.html buttons
    ══════════════════════════════════════════ */
    window.startImportantTest = function () {
        showImportantTest();
        initTest();
    };

    // Auto-init if already visible
    if (!SECTION.classList.contains('it-hidden')) {
        initTest();
    }

})();