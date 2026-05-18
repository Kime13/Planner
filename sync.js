// ===== Firebase 동기화 레이어 (로그인 선택, 앱은 항상 즉시 표시) =====

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOcYba_emFZKSwcAu-rYuADVHt_bUmbqM",
  authDomain:        "my-planner-f78ea.firebaseapp.com",
  projectId:         "my-planner-f78ea",
  storageBucket:     "my-planner-f78ea.firebasestorage.app",
  messagingSenderId: "250165850330",
  appId:             "1:250165850330:web:f8df7047905cc9d95bf5e3"
};

var _db          = null;
var _syncTimer   = null;
var _currentUser = null;

/* ─────────────────────────────────────────
   initSync(onReady)
   · 앱을 즉시 표시하고 onReady() 호출
   · Firebase 초기화에 성공하면 백그라운드에서 인증 감지
   · 로그인 상태면 Firestore 데이터로 localStorage 덮어쓰고 재렌더
───────────────────────────────────────── */
function initSync(onReady) {
  // 1) 앱 즉시 표시 — 로그인 없이도 항상 사용 가능
  _showApp();

  // 2) localStorage 데이터로 일단 렌더
  if (onReady) onReady();

  // 3) Firebase 초기화 (실패해도 앱에는 영향 없음)
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();

    firebase.auth().onAuthStateChanged(function(user) {
      _currentUser = user;
      _updateUserBadge(user);

      if (!user) return; // 비로그인 → localStorage만 사용, 렌더 다시 안 함

      // 로그인 성공 → Firestore에서 최신 데이터 가져와 덮어쓰기
      _getUserDoc(user.uid).get().then(function(doc) {
        if (!doc.exists) return; // 신규 사용자 → 현재 localStorage 그대로 유지
        var remote    = doc.data();
        var hasChange = false;
        Object.keys(KEYS).forEach(function(k) {
          var key = KEYS[k];
          if (remote[key] !== undefined) {
            var localRaw = localStorage.getItem(key);
            var remoteStr = JSON.stringify(remote[key]);
            if (localRaw !== remoteStr) {
              localStorage.setItem(key, remoteStr);
              hasChange = true;
            }
          }
        });
        // 원격 데이터가 로컬과 다르면 화면 갱신
        if (hasChange && typeof renderAll === 'function') renderAll();
        else if (hasChange) {
          // daily.html 환경
          if (typeof renderAllTasks  === 'function') renderAllTasks();
          if (typeof renderPriorities === 'function') renderPriorities();
          if (typeof renderTimeTracker === 'function') renderTimeTracker();
          if (typeof updateProgress === 'function') updateProgress();
        }
      }).catch(function(err) {
        console.warn('Firestore 로드 실패:', err.message);
      });
    });

  } catch(e) {
    console.warn('Firebase 초기화 실패 (오프라인 모드):', e.message);
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
  if (firebase.auth) firebase.auth().signOut();
}

/* ─── 사용자 배지 업데이트 (로그인/비로그인 모두 처리) ─── */
function _updateUserBadge(user) {
  var badge = document.getElementById('user-badge');
  if (!badge) return;
  if (!user) {
    // 비로그인: 작은 "동기화" 버튼
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

/* ─── 앱 표시 (login-screen 숨기고 .app 보이기) ─── */
function _showApp() {
  var loginEl = document.getElementById('login-screen');
  if (loginEl) loginEl.style.display = 'none';
  var app = document.querySelector('.app');
  if (app) app.style.display = '';
}
