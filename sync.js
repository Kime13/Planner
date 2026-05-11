// ===== Firebase Auth + Firestore 동기화 레이어 =====

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOcYba_emFZKSwcAu-rYuADVHt_bUmbqM",
  authDomain:        "my-planner-f78ea.firebaseapp.com",
  projectId:         "my-planner-f78ea",
  storageBucket:     "my-planner-f78ea.firebasestorage.app",
  messagingSenderId: "250165850330",
  appId:             "1:250165850330:web:f8df7047905cc9d95bf5e3"
};

var _db            = null;
var _onReadyFn     = null;
var _currentUser   = null;
var _currentUserId = null;
var _syncTimer     = null;

// 사용자별 Firestore 문서 참조
function _getUserDoc(uid) {
  return _db.collection('users').doc(uid).collection('planner').doc('data');
}

function initSync(onReady) {
  _onReadyFn = onReady;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    // _db는 아래 onAuthStateChanged 안에서 인증 확인 후 초기화 (pre-auth Firestore 접근 방지)

    firebase.auth().onAuthStateChanged(function(user) {
      _currentUser = user;

      if (!user) {
        // 로그아웃: 로컬 캐시 초기화 → 로그인 화면
        _currentUserId = null;
        Object.keys(KEYS).forEach(function(k) {
          localStorage.removeItem(KEYS[k]);
        });
        _showLoginScreen();
        return;
      }

      // 인증 확인 후 Firestore 클라이언트를 처음 한 번만 초기화
      if (!_db) _db = firebase.firestore();

      var sameUser = (_currentUserId === user.uid);
      _currentUserId = user.uid;
      _hideLoginScreen();
      _updateUserBadge(user);
      if (sameUser) return; // 토큰 갱신 등 동일 사용자 재호출 → 재로딩 불필요

      // 사용자가 바뀌었거나 첫 로그인:
      // localStorage를 먼저 비워 이전 사용자 데이터나 마이그레이션 대상 로컬 데이터를 제거
      Object.keys(KEYS).forEach(function(k) {
        localStorage.removeItem(KEYS[k]);
      });

      // Firestore → localStorage 캐시 → 렌더
      // Firestore에 데이터가 없으면(신규 사용자) 빈 상태로 렌더
      _getUserDoc(user.uid).get().then(function(doc) {
        if (doc.exists) {
          var remote = doc.data();
          Object.keys(KEYS).forEach(function(k) {
            var key = KEYS[k];
            if (remote[key] !== undefined) {
              localStorage.setItem(key, JSON.stringify(remote[key]));
            }
          });
        }
        if (_onReadyFn) _onReadyFn();
      }).catch(function(err) {
        console.warn('Firestore 로드 실패:', err.message);
        if (_onReadyFn) _onReadyFn();
      });
    });

  } catch(e) {
    console.warn('Firebase 초기화 실패:', e.message);
    _hideLoginScreen();
    if (onReady) onReady();
  }
}

// 모든 데이터를 사용자 Firestore 문서에 push (debounce 500ms)
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

// Google 팝업 로그인
function signInWithGoogle() {
  var errEl = document.getElementById('login-error');
  if (errEl) errEl.textContent = '';
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(function(err) {
    if (errEl) errEl.textContent = '로그인 실패: ' + err.message;
  });
}

// 로그아웃: localStorage 캐시만 즉시 초기화 후 signOut
// (signOut 완료 시 onAuthStateChanged(!user)가 재호출되어 로그인 화면으로 전환)
function signOutUser() {
  Object.keys(KEYS).forEach(function(k) { localStorage.removeItem(KEYS[k]); });
  firebase.auth().signOut();
}

function _showLoginScreen() {
  var el = document.getElementById('login-screen');
  if (el) el.style.display = 'flex';
  var app = document.querySelector('.app');
  if (app) app.style.display = 'none';
}

function _hideLoginScreen() {
  var el = document.getElementById('login-screen');
  if (el) el.style.display = 'none';
  var app = document.querySelector('.app');
  if (app) app.style.display = '';
}

function _updateUserBadge(user) {
  var badge = document.getElementById('user-badge');
  if (!badge || !user) return;
  var name = user.displayName || user.email || '';
  badge.innerHTML =
    (user.photoURL
      ? '<img src="' + user.photoURL + '" alt="" class="user-avatar">'
      : '<div class="user-avatar user-avatar--initial">' + escHtml(name.charAt(0).toUpperCase() || '?') + '</div>')
    + '<span class="user-name">' + escHtml(name) + '</span>'
    + '<button class="btn btn-ghost btn-sm" onclick="signOutUser()">로그아웃</button>';
}
