/* eslint-disable */
/*
 * 场内 ETF 榜"暂无数据"根因精查 v3
 * 用法：浏览器 console 整段粘贴执行（可重复粘贴，变量隔离不冲突）。
 * 三组：A 东财JSONP / B 腾讯fetch对照组 / C 东财直接fetch看HTTP码
 */
(function () {
var CLIST = 'https://push2.eastmoney.com/api/qt/clist/get';
var FS = 'b:MK0021,b:MK0022,b:MK0023,b:MK0024,b:MK0827';
var UT = 'bd1d9ddb04089700cf9c27f6f7426281';
var TENCENT = 'https://qt.gtimg.cn/q=sh000001';

var probeSeq = 0;
function genCb(p) { return p + '_' + Date.now() + '_' + (++probeSeq).toString(36); }

function jsonp(url, cb, timeoutMs) {
  timeoutMs = timeoutMs || 12000;
  return new Promise(function (resolve) {
    var w = window;
    var done = false;
    var script = document.createElement('script');
    var t0 = Date.now();
    var timer = setTimeout(function () {
      if (!done) { done = true; cleanup(); resolve({ ok: false, kind: 'TIMEOUT', ms: Date.now() - t0 }); }
    }, timeoutMs);
    w[cb] = function (data) { if (!done) { done = true; cleanup(); resolve({ ok: true, data: data, ms: Date.now() - t0 }); } };
    function cleanup() { clearTimeout(timer); w[cb] = function () {}; if (script.parentNode) script.parentNode.removeChild(script); }
    script.onerror = function () { if (!done) { done = true; cleanup(); resolve({ ok: false, kind: 'ONERROR', ms: Date.now() - t0 }); } };
    script.src = url;
    document.body.appendChild(script);
  });
}

function fetchWithTimeout(url, timeoutMs) {
  timeoutMs = timeoutMs || 12000;
  return new Promise(function (resolve) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
    fetch(url, { signal: ctrl.signal }).then(function (r) {
      clearTimeout(timer);
      return r.text().then(function (text) {
        resolve({ ok: true, status: r.status, len: text.length, head: text.slice(0, 120) });
      });
    }).catch(function (e) {
      clearTimeout(timer);
      var aborted = e instanceof DOMException && e.name === 'AbortError';
      resolve({ ok: false, kind: aborted ? 'TIMEOUT' : 'NET_ERR', msg: e.message });
    });
  });
}

function log(tag, msg, color) {
  if (color) { console.log('%c' + tag + ' ' + msg, 'color:' + color); }
  else { console.log(tag + ' ' + msg); }
}

async function main() {
  log('=== ETF 榜根因精查 v3 ===', '', '#6366f1;font-weight:bold');
  log('北京', new Date().toLocaleTimeString('zh-CN', { hour12: false }), '');
  console.log('');

  // A. 东财 JSONP（3 次）
  log('[A]', '东财 clist JSONP（超时12s）', '#f59e0b');
  var aRes = [];
  for (var i = 1; i <= 3; i++) {
    var cb = genCb('em');
    var url = CLIST + '?pn=1&pz=5&po=1&np=1&ut=' + UT + '&fltt=2&invt=2&fs=' + encodeURIComponent(FS) + '&fields=f2,f3,f6,f12,f14,f62&fid=f3&cb=' + cb;
    var r = await jsonp(url, cb, 12000);
    if (r.ok) {
      var cnt = (r.data && r.data.data && r.data.data.diff) ? r.data.data.diff.length : 0;
      log('  第' + i + '次', 'OK ' + r.ms + 'ms diff条数=' + cnt, '#22c55e');
      aRes.push({ ok: true, cnt: cnt });
    } else {
      log('  第' + i + '次', 'FAIL ' + r.kind + ' (' + r.ms + 'ms)', '#ef4444');
      aRes.push({ ok: false, kind: r.kind });
    }
    await new Promise(function (rr) { setTimeout(rr, 2000); });
  }

  // B. 腾讯对照组
  console.log('');
  log('[B]', '腾讯行情 fetch（对照组：外网通不通）', '#f59e0b');
  var b = await fetchWithTimeout(TENCENT, 12000);
  if (b.ok) log('  腾讯', 'OK HTTP' + b.status + ' 长度' + b.len + ' 首120字:' + b.head.replace(/\n/g, ' '), '#22c55e');
  else log('  腾讯', 'FAIL ' + (b.kind || '') + ' ' + (b.msg || ''), '#ef4444');

  // C. 东财直接 fetch
  console.log('');
  log('[C]', '东财 clist 直接 fetch（不经JSONP，看HTTP码）', '#f59e0b');
  var cUrl = CLIST + '?pn=1&pz=5&po=1&np=1&ut=' + UT + '&fltt=2&invt=2&fs=' + encodeURIComponent(FS) + '&fields=f2,f3,f6,f12,f14,f62&fid=f3';
  var c = await fetchWithTimeout(cUrl, 12000);
  if (c.ok) log('  东财fetch', 'OK HTTP' + c.status + ' 长度' + c.len + ' 首120字:' + c.head.replace(/\n/g, ' '), '#22c55e');
  else log('  东财fetch', 'FAIL ' + (c.kind || '') + ' ' + (c.msg || ''), '#ef4444');

  // 判断
  console.log('');
  log('=== 判断 ===', '', '#6366f1;font-weight:bold');
  var aOk = aRes.filter(function (x) { return x.ok; });
  var aTimeout = aRes.filter(function (x) { return !x.ok && x.kind === 'TIMEOUT'; });
  var aErr = aRes.filter(function (x) { return !x.ok && x.kind === 'ONERROR'; });
  log('东财JSONP:', '成功' + aOk.length + ' 超时' + aTimeout.length + ' onerror' + aErr.length, '');
  log('腾讯对照:', b.ok ? '通' : '不通(' + (b.kind || '') + ')', '');
  log('东财fetch:', c.ok ? '通(HTTP' + c.status + ')' : '不通(' + (c.kind || '') + ')', '');

  if (!b.ok && !c.ok) {
    log('→', '腾讯和东财都不通 = 当前网络整体断了/被墙，与东财无关。先查网络/VPN/代理。', '#ef4444');
  } else if (b.ok && !c.ok && aRes.every(function (x) { return !x.ok; })) {
    log('→', '腾讯通、东财全不通 = 东财专门封了这个IP（风控）。', '#ef4444');
    log('', '  可能：1)高频刷新触发IP封禁(几十分钟~几小时自愈) 2)网络出口被东财拉黑', '');
    log('', '  建议：换网络(手机热点)再跑本脚本，东财通了→确认IP被封', '');
  } else if (aOk.length > 0 && aOk.length < 3) {
    log('→', '东财时通时不通 = 限流/抖动，非参数问题。app应加"失败保留旧数据"容错。', '#22c55e');
  } else if (aOk.length === 3) {
    log('→', '东财全通 = 接口没事，"暂无数据"是app侧问题。', '#22c55e');
  }
  console.log('');
  log('诊断完成，把整段日志贴回来。', '', '#6366f1;font-weight:bold');
}
main();
})();
