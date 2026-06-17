// ===== 플래너 데이터 레이어 =====

var KEYS = {
  vision:    'planner_vision',
  annual:    'planner_annual',
  quarterly: 'planner_quarterly',
  monthly:   'planner_monthly',
  weekly:    'planner_weekly',
  daily:     'planner_daily',
  recurring: 'planner_recurring',
  settings:  'planner_settings',
};

var WEEK_CATS = ['업무', '자기계발', '이직', '타인과의 관계'];

// 연간 핵심목표 3개 색상 (인덱스 순)
var CORE_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

// 주간 카테고리별 색상
var WEEKCAT_COLORS = {
  '업무':         '#6366f1',
  '자기계발':     '#10b981',
  '이직':         '#f59e0b',
  '타인과의 관계':'#ec4899'
};

/* ---- 날짜 유틸리티 ---- */
function pad(n) { return String(n).padStart(2, '0'); }

function dateKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function monthKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}

function weekKey(d) {
  var t = d ? new Date(d) : new Date();
  t.setHours(0, 0, 0, 0);
  var day = t.getDay() || 7;
  t.setDate(t.getDate() + 4 - day);
  var y1 = new Date(t.getFullYear(), 0, 1);
  var wn = Math.ceil(((t - y1) / 864e5 + 1) / 7);
  return t.getFullYear() + '-W' + pad(wn);
}

// 주차 키에서 월/일 범위 문자열 반환 (예: "5/5 ~ 5/11")
function getWeekDateRange(wk) {
  var parts   = wk.split('-W');
  var year    = +parts[0];
  var weekNum = +parts[1];
  var jan4    = new Date(year, 0, 4);
  var monday  = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (weekNum - 1) * 7);
  var sunday  = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return (monday.getMonth()+1) + '/' + monday.getDate()
    + ' ~ ' + (sunday.getMonth()+1) + '/' + sunday.getDate();
}

// 주차 키에서 7일 앞/뒤 주차 키 반환
function shiftWeekKey(wk, dir) {
  var parts   = wk.split('-W');
  var year    = +parts[0];
  var weekNum = +parts[1];
  var jan4    = new Date(year, 0, 4);
  var monday  = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (weekNum - 1) * 7);
  monday.setDate(monday.getDate() + dir * 7);
  return weekKey(monday);
}

function quarterNum(d) {
  d = d || new Date();
  return Math.floor(d.getMonth() / 3) + 1;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function formatKorDate(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  var days = ['일', '월', '화', '수', '목', '금', '토'];
  return parts[0] + '년 ' + (+parts[1]) + '월 ' + (+parts[2]) + '일 (' + days[d.getDay()] + ')';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---- 설정 & 카테고리 ---- */
var _DEFAULT_CATS = [
  { name: '업무',          color: '#6366f1' },
  { name: '자기계발',      color: '#10b981' },
  { name: '이직',          color: '#f59e0b' },
  { name: '타인과의 관계', color: '#ec4899' }
];

function getSettings() {
  return JSON.parse(localStorage.getItem(KEYS.settings)) || { weekCats: _DEFAULT_CATS };
}
function saveSettings(data) {
  localStorage.setItem(KEYS.settings, JSON.stringify(data));
  pushSync();
}
function getPlannerName() {
  return getSettings().plannerName || '';
}

// 설정에서 읽어 WEEK_CATS / WEEKCAT_COLORS 전역 갱신
function refreshCategoryGlobals() {
  var cats = getSettings().weekCats;
  WEEK_CATS = cats.map(function(c) { return c.name; });
  WEEKCAT_COLORS = {};
  cats.forEach(function(c) { WEEKCAT_COLORS[c.name] = c.color; });
}

/* ---- 반복 일정 ---- */
function getRecurring() {
  return JSON.parse(localStorage.getItem(KEYS.recurring)) || [];
}
function saveRecurring(data) {
  localStorage.setItem(KEYS.recurring, JSON.stringify(data));
  pushSync();
}

// daily.html 로드 시: 해당 날짜에 맞는 반복 일정을 allTasks에 자동 삽입
function injectRecurringTasks(dk) {
  var parts     = dk.split('-');
  var date      = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  var dow       = date.getDay() || 7;   // 1=월 … 7=일
  var dom       = date.getDate();
  var recurring = getRecurring().filter(function(r) { return r.active !== false; });
  if (!recurring.length) return;

  var dayData = getDayData(dk);
  var changed = false;

  recurring.forEach(function(r) {
    var applies =
      (r.repeat === 'daily') ||
      (r.repeat === 'weekly'  && +r.weekDay  === dow) ||
      (r.repeat === 'monthly' && +r.monthDay === dom);
    if (!applies) return;

    var already = dayData.allTasks.some(function(t) { return t.recurringId === r.id; });
    if (already) return;

    dayData.allTasks.push({
      id:           uid(),
      text:         r.text,
      done:         false,
      weekCat:      r.weekCat      || '',
      coreCategory: r.coreCategory || '',
      recurringId:  r.id
    });
    changed = true;
  });

  if (changed) {
    var all = JSON.parse(localStorage.getItem(KEYS.daily)) || {};
    all[dk] = dayData;
    localStorage.setItem(KEYS.daily, JSON.stringify(all));
    pushSync();
  }
}

/* ---- 비전 (Layer 0 — 나의 나침반) ---- */
function getVision() {
  return JSON.parse(localStorage.getItem(KEYS.vision)) || { finalGoal: '', fiveYearGoal: '' };
}
function saveVision(data) {
  localStorage.setItem(KEYS.vision, JSON.stringify(data));
  pushSync();
}

/* ---- 연간 ---- */
function getAnnual() {
  return JSON.parse(localStorage.getItem(KEYS.annual)) || {
    goal: '',
    coreActions: ['', '', ''],
    progress: 0
  };
}
function saveAnnual(data) { localStorage.setItem(KEYS.annual, JSON.stringify(data)); pushSync(); }

/* ---- 분기 ---- */
function getQuarterly() {
  return JSON.parse(localStorage.getItem(KEYS.quarterly)) || {
    Q1: { goal: '', progress: 0 },
    Q2: { goal: '', progress: 0 },
    Q3: { goal: '', progress: 0 },
    Q4: { goal: '', progress: 0 }
  };
}
function saveQuarterly(data) { localStorage.setItem(KEYS.quarterly, JSON.stringify(data)); pushSync(); }

/* ---- 월간 ----
   구조: { coreGoals: { '영어': '...', 'AI공부': '...', '이력서...': '...' } }
   주간 할일의 coreCategory 태그를 기반으로 달성률 자동 계산
---- */
function getMonthGoals(mk) {
  mk = mk || monthKey();
  var all = JSON.parse(localStorage.getItem(KEYS.monthly)) || {};
  var data = all[mk] || {};
  if (!data.coreGoals) data = { coreGoals: {} };
  return data;
}

function saveMonthGoals(data, mk) {
  mk = mk || monthKey();
  var all = JSON.parse(localStorage.getItem(KEYS.monthly)) || {};
  all[mk] = data;
  localStorage.setItem(KEYS.monthly, JSON.stringify(all));
  pushSync();
}

/* ---- 주간 ----
   각 task에 coreCategory 필드 추가:
   { id, text, done, coreCategory: '영어' | 'AI공부' | '이력서...' | '' }
---- */
function getWeekData(wk) {
  wk = wk || weekKey();
  var all = JSON.parse(localStorage.getItem(KEYS.weekly)) || {};
  if (!all[wk]) {
    all[wk] = {};
    WEEK_CATS.forEach(function(c) { all[wk][c] = []; });
    localStorage.setItem(KEYS.weekly, JSON.stringify(all));
  }
  return all[wk];
}

function saveWeekData(wk, data) {
  var all = JSON.parse(localStorage.getItem(KEYS.weekly)) || {};
  all[wk] = data;
  localStorage.setItem(KEYS.weekly, JSON.stringify(all));
  pushSync();
}

/* ---- 매일 ----
   각 task에 weekCat 필드 추가:
   { id, text, done, weekCat: '업무' | '자기계발' | '이직' | '타인과의 관계' | '' }
---- */
function getDayData(dk) {
  var all = JSON.parse(localStorage.getItem(KEYS.daily)) || {};
  return all[dk] || { allTasks: [], priorities: [], actual: [] };
}

function saveDayData(dk, data) {
  var all = JSON.parse(localStorage.getItem(KEYS.daily)) || {};
  all[dk] = data;
  localStorage.setItem(KEYS.daily, JSON.stringify(all));
  pushSync();
}

function hasDayData(dk) {
  var all = JSON.parse(localStorage.getItem(KEYS.daily)) || {};
  var d = all[dk];
  return !!(d && (d.allTasks.length || d.priorities.length || d.actual.length));
}

/* ---- 달성률 계산 ---- */
function calcDayProgress(dk) {
  var d = getDayData(dk);
  if (!d.allTasks || !d.allTasks.length) return null;
  var done = d.allTasks.filter(function(t) { return t.done; }).length;
  return Math.round(done / d.allTasks.length * 100);
}

function calcWeekProgress(wk) {
  var data = getWeekData(wk || weekKey());
  var total = 0, done = 0;
  WEEK_CATS.forEach(function(cat) {
    var tasks = data[cat] || [];
    total += tasks.length;
    done += tasks.filter(function(t) { return t.done; }).length;
  });
  return total ? Math.round(done / total * 100) : 0;
}

/* ====================================================
   달성률 계산 원칙 (시간 기반 계층 구조)

   매일 : 완료 할일 / 전체 할일
   주간 : Σ(매일%) ÷ 7         ← 매일이 1/7씩 기여
   월간 : Σ(주간%) ÷ 해당월 주수 ← 주간이 1/4 or 1/5씩 기여
   분기 : Σ(월간%) ÷ 3          ← 월간이 1/3씩 기여
   ==================================================== */

// 해당 주의 월요일 Date 반환
function getMondayOfWeek(wk) {
  var parts   = wk.split('-W');
  var year    = +parts[0], weekNum = +parts[1];
  var jan4    = new Date(year, 0, 4);
  var monday  = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (weekNum - 1) * 7);
  return monday;
}

// 해당 월에 월요일이 포함된 주(week) 키 목록 반환 (4~5개)
function getWeekMondaysInMonth(mk) {
  var parts = mk.split('-');
  var year = +parts[0], month = +parts[1];
  var keys = [];
  var d    = new Date(year, month - 1, 1);
  var last = new Date(year, month, 0);
  var dow  = d.getDay() || 7;
  if (dow !== 1) d.setDate(d.getDate() + (8 - dow)); // 해당 월 첫 번째 월요일
  while (d <= last) {
    keys.push(weekKey(d));
    d.setDate(d.getDate() + 7);
  }
  return keys; // 보통 4개, 때로 5개
}

// 매일 특정 coreCategory 달성률 (해당 날 태그된 할일 기준)
function calcDayCatProgress(corecat, dk) {
  var tasks = (getDayData(dk).allTasks || []).filter(function(t) { return t.coreCategory === corecat; });
  if (!tasks.length) return 0;
  return Math.round(tasks.filter(function(t) { return t.done; }).length / tasks.length * 100);
}

// 주간 특정 coreCategory 달성률 = Σ(매일 cat%) ÷ 7
function calcWeekCoreCatProgress(corecat, wk) {
  wk = wk || weekKey();
  var monday = getMondayOfWeek(wk);
  var sum = 0;
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    sum += calcDayCatProgress(corecat, dateKey(d));
  }
  return Math.round(sum / 7);
}

// 주간 특정 weekCat 달성률 = Σ(매일 weekCat%) ÷ 7
function calcWeekCatProgressFromDaily(weekCat, wk) {
  wk = wk || weekKey();
  var monday = getMondayOfWeek(wk);
  var sum = 0;
  for (var i = 0; i < 7; i++) {
    var d     = new Date(monday);
    d.setDate(monday.getDate() + i);
    var tasks = (getDayData(dateKey(d)).allTasks || []).filter(function(t) { return t.weekCat === weekCat; });
    if (tasks.length) {
      sum += Math.round(tasks.filter(function(t){ return t.done; }).length / tasks.length * 100);
    }
  }
  return Math.round(sum / 7);
}

// 주간 전체 달성률 = Σ(매일%) ÷ 7
function calcWeekTotalProgress(wk) {
  wk = wk || weekKey();
  var monday = getMondayOfWeek(wk);
  var sum = 0;
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    var p = calcDayProgress(dateKey(d));
    sum += (p !== null) ? p : 0;
  }
  return Math.round(sum / 7);
}

// 월간 핵심목표 달성률 = Σ(주간 corecat%) ÷ 해당월 주수
function calcMonthCoreCategoryProgress(corecat, mk) {
  mk = mk || monthKey();
  var wks = getWeekMondaysInMonth(mk);
  if (!wks.length) return 0;
  var sum = wks.reduce(function(acc, wk) { return acc + calcWeekCoreCatProgress(corecat, wk); }, 0);
  return Math.round(sum / wks.length);
}

// 월간 전체 달성률 = Σ(주간 전체%) ÷ 해당월 주수
function calcMonthTotalProgress(mk) {
  mk = mk || monthKey();
  var wks = getWeekMondaysInMonth(mk);
  if (!wks.length) return 0;
  var sum = wks.reduce(function(acc, wk) { return acc + calcWeekTotalProgress(wk); }, 0);
  return Math.round(sum / wks.length);
}

// 분기 달성률 = Σ(월간%) ÷ 3  (항상 3으로 나눔)
function calcQuarterProgress(qNum, year) {
  year = year || new Date().getFullYear();
  var startMonth = (qNum - 1) * 3 + 1;
  var sum = 0;
  for (var m = startMonth; m < startMonth + 3; m++) {
    sum += calcMonthTotalProgress(year + '-' + pad(m));
  }
  return Math.round(sum / 3);
}

// 주간 weekCat별 매일 할일 집계 (대시보드 표시용)
function getDailyCountsForWeekCat(weekCat, wk) {
  wk = wk || weekKey();
  var monday = getMondayOfWeek(wk);
  var total = 0, done = 0;
  for (var i = 0; i < 7; i++) {
    var d = new Date(monday);
    d.setDate(monday.getDate() + i);
    (getDayData(dateKey(d)).allTasks || []).forEach(function(t) {
      if (t.weekCat === weekCat) { total++; if (t.done) done++; }
    });
  }
  return { total: total, done: done };
}

/* ---- SVG 달성률 링 ---- */
function svgRing(pct, size, color, trackColor) {
  size = size || 80;
  color = color || '#6366f1';
  trackColor = trackColor || '#e8eaf6';
  var r = size / 2 - 7;
  var circ = +(2 * Math.PI * r).toFixed(2);
  var off = +(circ * (1 - pct / 100)).toFixed(2);
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
    + '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r
    + '" fill="none" stroke="' + trackColor + '" stroke-width="5.5"/>'
    + '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r
    + '" fill="none" stroke="' + color + '" stroke-width="5.5"'
    + ' stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '"'
    + ' transform="rotate(-90 ' + (size/2) + ' ' + (size/2) + ')"'
    + ' style="transition:stroke-dashoffset .6s ease"/>'
    + '<text x="' + (size/2) + '" y="' + (size/2) + '" text-anchor="middle" dominant-baseline="central"'
    + ' fill="' + color + '" font-size="' + Math.round(size * .21) + 'px"'
    + ' font-weight="700" font-family="inherit">' + pct + '%</text>'
    + '</svg>';
}
