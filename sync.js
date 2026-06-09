// ===== Firebase 동기화 레이어 =====
// · 앱은 항상 즉시 표시 (로그인 불필요)
// · 로그인 시 onSnapshot 실시간 리스너 — 어느 기기에서 바꿔도 즉시 반영
// · hasPendingWrites 필터로 로컬 쓰기가 재트리거하는 무한루프 방지

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOcYba_emFZKSwcAu-rYuADVHt_bUmbqM",
  authDomain:        "my-planner-f78ea.firebaseapp.com",
  projectId:         "my-planner-f78ea",
  storageBucket:     "my-planner-f78ea.firebasestorage.app",
  messagingSenderId: "250165850330",
  appId:             "1:250165850330:web:f8df7047905cc9d95bf5e3"
};

var _db             = null;
var _syncTimer      = null;
var _currentUser    = null;
var _unsubSnapshot  = null;   // onSnapshot 해제 함수

/* ─────────────────────────────────────────
   initSync(onReady)
───────────────────────────────────────── */
function initSync(onReady) {
  _showApp();
  if (onReady) onReady();

  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();

    firebase.auth().onAuthStateChanged(function(user) {
      _currentUser = user;
      _updateUserBadge(user);

      // 로그아웃: 기존 리스너 해제
      if (_unsubSnapshot) { _unsubSnapshot(); _unsubSnapshot = null; }
      if (!user) return;

      // 로그인: 실시간 리스너 등록
      _unsubSnapshot = _getUserDoc(user.uid).onSnapshot(
        { includeMetadataChanges: true },
        function(doc) {
          // 이 기기에서 쓴 데이터가 서버에 반영되는 이벤트 → 무시 (무한루프 방지)
          if (doc.metadata.hasPendingWrites) return;
          if (!doc.exists) return;

          _applyRemoteData(doc.data());
        },
        function(err) {
          console.warn('Firestore 리스너 오류:', err.message);
        }
      );
    });

  } catch(e) {
    console.warn('Firebase 초기화 실패 (오프라인 모드):', e.message);
  }
}

/* ─── Firestore 데이터를 localStorage에 반영 후 화면 갱신 ─── */
function _applyRemoteData(remote) {
  var hasChange = false;

  Object.keys(KEYS).forEach(function(k) {
    var key      = KEYS[k];
    var localRaw = localStorage.getItem(key);

    if (remote[key] === undefined) return; // Firestore에 없으면 로컬 유지

    // ── 반복 일정: 로컬+원격 합집합 병합 (어느 쪽도 잃지 않음) ──
    if (key === KEYS.recurring) {
      var localArr  = JSON.parse(localRaw || '[]');
      var remoteArr = JSON.parse(JSON.stringify(remote[key] || []));
      var remoteIds = {};
      remoteArr.forEach(function(r){ remoteIds[r.id] = true; });
      localArr.forEach(function(r){
        if (!remoteIds[r.id]) remoteArr.push(r);
      });
      var mergedStr = JSON.stringify(remoteArr);
      if (localRaw !== mergedStr) {
        localStorage.setItem(key, mergedStr);
        hasChange = true;
      }
      return;
    }

    // ── 나머지 키: 원격으로 덮어쓰기 ──
    var remoteStr = JSON.stringify(remote[key]);
    if (localRaw !== remoteStr) {
      localStorage.setItem(key, remoteStr);
      hasChange = true;
    }
  });

  // 반복 일정 재삽입 — 덮어쓰기 후에도 항상 보장
  if (typeof injectRecurringTasks === 'function' && typeof dk !== 'undefined') {
    injectRecurringTasks(dk);
  }

  // 화면 갱신
  if (hasChange) {
    if (typeof renderAll === 'function') {
      renderAll();
    } else {
      if (typeof renderAllTasks    === 'function') renderAllTasks();
      if (typeof renderPriorities  === 'function') renderPriorities();
      if (typeof renderTimeTracker === 'function') renderTimeTracker();
      if (typeof updateProgress    === 'function') updateProgress();
      // 진행 중인 타이머 틱 복원
      if (typeof _getActiveEntry === 'function' && typeof _startTimerTick === 'function') {
        if (_getActiveEntry()) _startTimerTick();
      }
    }
  }
}

/* ─── Firestore 문서 참조 ─── */
function _getUserDoc(uid) {
  return _db.collection('users').doc(uid).collection('planner').doc('data');
}

/* ─── 데이터 저장 시 Firestore에도 push (debounce 500ms) ─── */
function pushSync() {
  if (!_currentUser || !_db) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(function() {
    var data = {};
    Object.keys(KEYS).forEach(function(k) {
      var v = localStorage.getItem(KEYS[k]);
      if (v) { try { data[KEYS[k]] = JSON.parse(v); } catch(e) {} }
    });
    _getUserDoc(_currentUser.uid).set(data).catch(function(err) {
      console.warn('Firestore 저장 실패:', err.message);
    });
  }, 500);
}

/* ─── Google 로그인 / 로그아웃 ─── */
function signInWithGoogle() {
  var errEl = document.getElementById('sync-error');
  if (errEl) errEl.textContent = '';
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(function(err) {
    var msg = err.code === 'auth/popup-blocked'
      ? '팝업이 차단됐어요. 브라우저에서 팝업을 허용해 주세요.'
      : '로그인 실패: ' + err.message;
    if (errEl) errEl.textContent = msg;
    else alert(msg);
  });
}

function signOutUser() {
  if (_unsubSnapshot) { _unsubSnapshot(); _unsubSnapshot = null; }
  if (firebase.auth) firebase.auth().signOut();
}

/* ─── 사용자 배지 ─── */
function _updateUserBadge(user) {
  var badge = document.getElementById('user-badge');
  if (!badge) return;
  if (!user) {
    badge.innerHTML =
      '<button class="btn btn-ghost btn-sm" onclick="signInWithGoogle()" '
      + 'style="font-size:11px;padding:5px 10px;gap:4px">'
      + '<span>☁</span> 동기화 로그인</button>'
      + '<span id="sync-error" style="font-size:11px;color:var(--danger);margin-left:6px"></span>';
    return;
  }
  var name = user.displayName || user.email || '';
  badge.innerHTML =
    (user.photoURL
      ? '<img src="' + user.photoURL + '" alt="" class="user-avatar">'
      : '<div class="user-avatar user-avatar--initial">'
        + escHtml((name.charAt(0) || '?').toUpperCase()) + '</div>')
    + '<span class="user-name">' + escHtml(name) + '</span>'
    + '<button class="btn btn-ghost btn-sm" onclick="signOutUser()">로그아웃</button>';
}

/* ─── 앱 표시 ─── */
function _showApp() {
  var loginEl = document.getElementById('login-screen');
  if (loginEl) loginEl.style.display = 'none';
  var app = document.querySelector('.app');
  if (app) app.style.display = '';
}
