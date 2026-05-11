// ===== Firebase Firestore 동기화 레이어 =====

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBOcYba_emFZKSwcAu-rYuADVHt_bUmbqM",
  authDomain:        "my-planner-f78ea.firebaseapp.com",
  projectId:         "my-planner-f78ea",
  storageBucket:     "my-planner-f78ea.firebasestorage.app",
  messagingSenderId: "250165850330",
  appId:             "1:250165850330:web:f8df7047905cc9d95bf5e3"
};

var _syncDoc     = null;  // Firestore 문서 참조
var _syncTimer   = null;
var _syncEnabled = false;

function initSync(onReady) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _syncDoc     = firebase.firestore().collection('planner').doc('data');
    _syncEnabled = true;

    // Firestore → localStorage 로드 후 렌더
    _syncDoc.get().then(function(doc) {
      if (doc.exists) {
        var remote = doc.data();
        Object.keys(KEYS).forEach(function(k) {
          var storageKey = KEYS[k];
          if (remote[storageKey] !== undefined) {
            localStorage.setItem(storageKey, JSON.stringify(remote[storageKey]));
          }
        });
      }
      if (onReady) onReady();
    }).catch(function(err) {
      console.warn('Firestore 로드 실패, localStorage 사용:', err.message);
      if (onReady) onReady();
    });

  } catch(e) {
    console.warn('Firebase 초기화 실패:', e.message);
    if (onReady) onReady();
  }
}

// 모든 플래너 데이터를 Firestore에 push (debounce 500ms)
function pushSync() {
  if (!_syncEnabled || !_syncDoc) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(function() {
    var data = {};
    Object.keys(KEYS).forEach(function(k) {
      var storageKey = KEYS[k];
      var v = localStorage.getItem(storageKey);
      if (v) {
        try { data[storageKey] = JSON.parse(v); } catch(e) {}
      }
    });
    _syncDoc.set(data).catch(function(err) {
      console.warn('Firestore 저장 실패:', err.message);
    });
  }, 500);
}
