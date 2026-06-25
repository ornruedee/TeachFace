// ============================================================
//  ระบบลงเวลาและตรวจพื้นที่ v3.2 — โรงเรียนโซ่พิสัยพิทยาคม
//  ★ แก้ไขค่า 2 บรรทัดนี้เท่านั้น แล้ว Deploy
// ============================================================

var SPREADSHEET_ID  = '1RHvwHjt6Ne29-ZzSfCaXfY32gf7lh165agW2RXOUyxY';   // ← Spreadsheet ID จาก URL ที่แชร์
var PHOTO_FOLDER_ID = '';   // ← วาง Google Drive Folder ID (ถ้าว่าง = สร้างอัตโนมัติ)

// Sheet Names
var SH = {
  USERS:       'Users',
  ATTEND:      'Attendance',
  CONFIG:      'Config',
  ADMIN:       'Admin_Settings',
  AUDIT:       'Audit_Logs',
  PAT_PTS:     'Patrol_Points',
  PAT_LOGS:    'Patrol_Logs'
};

// Headers ของแต่ละ Sheet
var HEADERS = {};
HEADERS[SH.USERS]    = ['Name','Email','FaceDescriptors','RegisteredAt','RegisterCount'];
HEADERS[SH.ATTEND]   = ['Name','Email','Type','Time','Date','Latitude','Longitude',
                         'GoogleMapLink','PhotoURL','Distance_km','FakeGPSFlag','Note'];
HEADERS[SH.CONFIG]   = ['Parameter','Value'];
HEADERS[SH.ADMIN]    = ['Username','Password','Role','Active'];
HEADERS[SH.AUDIT]    = ['Timestamp','AdminUser','Action','OldValue','NewValue'];
HEADERS[SH.PAT_PTS]  = ['ID','Name','Category','Latitude','Longitude',
                         'Radius_km','Description','Active','CreatedBy','CreatedAt'];
HEADERS[SH.PAT_LOGS] = ['Name','Email','PatrolPoint','Category','Type','Time','Date',
                         'Latitude','Longitude','GoogleMapLink','Distance_km',
                         'IncidentReport','PhotoURL','FakeGPSFlag'];

// JSON helpers
function R(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function E(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'error', message: String(msg)}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── ensureSheet ─────────────────────────────────────────────
// สร้าง Sheet ถ้าไม่มี + ซ่อม Header แถวแรกถ้าไม่ตรง
function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);

  if (!sh) {
    // ─ Sheet ไม่มี → สร้างใหม่พร้อม Header
    sh = ss.insertSheet(name);
    _writeHeader(sh, headers);
    Logger.log('✅ Created sheet: ' + name);
    return sh;
  }

  if (sh.getLastRow() === 0) {
    // ─ Sheet มีแต่ว่าง → เขียน Header
    _writeHeader(sh, headers);
    Logger.log('✅ Added headers to empty sheet: ' + name);
    return sh;
  }

  // ─ Sheet มีข้อมูลอยู่แล้ว → ตรวจ Header แถวแรก
  var existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var needFix  = false;

  // ตรวจทีละ column ว่าตรงกันไหม
  for (var c = 0; c < headers.length; c++) {
    if (String(existing[c] || '').trim() !== headers[c]) {
      needFix = true;
      Logger.log('Header mismatch in ' + name + ' col ' + (c+1) +
                 ': got "' + existing[c] + '" expected "' + headers[c] + '"');
    }
  }

  if (needFix) {
    // ★ เขียน Header ใหม่ (เฉพาะแถว 1) — ไม่กระทบข้อมูล
    // ถ้าจำนวน column เก่า < ใหม่ → ขยาย range
    var writeLen = Math.max(headers.length, existing.length);
    var clearRow = [];
    for (var x = 0; x < writeLen; x++) clearRow.push('');
    sh.getRange(1, 1, 1, writeLen).setValues([clearRow]); // clear
    _writeHeader(sh, headers);
    Logger.log('🔧 Fixed headers in sheet: ' + name);
  }

  // ตรวจว่า freeze row 1
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);

  return sh;
}

function _writeHeader(sh, headers) {
  var r = sh.getRange(1, 1, 1, headers.length);
  r.setValues([headers]);
  r.setFontWeight('bold')
   .setBackground('#1e3a5f')
   .setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

// ─── setupSheets (ทุก request) ─────────────────────────────
function setupSheets() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.trim() === '') {
    throw new Error('กรุณาตั้งค่า SPREADSHEET_ID ในโค้ด');
  }
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var keys = Object.keys(HEADERS);
  for (var i = 0; i < keys.length; i++) {
    ensureSheet(ss, keys[i], HEADERS[keys[i]]);
  }

  // Default Config
  var cfg = ss.getSheetByName(SH.CONFIG);
  if (cfg.getLastRow() <= 1) {
    var defs = [
      ['Target Latitude','17.4178'],['Target Longitude','103.7892'],
      ['Allowed Radius (KM)','0.1'],['AI Engine','gemini'],
      ['Gemini API Key',''],['Claude API Key',''],['OpenAI API Key','']
    ];
    for (var d = 0; d < defs.length; d++) cfg.appendRow(defs[d]);
  }

  // Default Admin
  var adm = ss.getSheetByName(SH.ADMIN);
  if (adm.getLastRow() <= 1) adm.appendRow(['admin','spk1234','Super Admin','TRUE']);

  // Default Patrol Points
  var pts = ss.getSheetByName(SH.PAT_PTS);
  if (pts.getLastRow() <= 1) {
    pts.appendRow(['PT001','ป้อมยาม','เวรป้อมยาม','17.4178','103.7892','0.05','ป้อมยามหน้าโรงเรียน','TRUE','System',new Date().toISOString()]);
    pts.appendRow(['PT002','อาคาร 1','อาคารเรียน','17.4180','103.7895','0.05','อาคารเรียน 1','TRUE','System',new Date().toISOString()]);
    pts.appendRow(['PT003','โรงฝึกงาน','โรงฝึกงาน','17.4182','103.7890','0.05','โรงฝึกงาน','TRUE','System',new Date().toISOString()]);
  }
  return ss;
}

// ─── doGet ─────────────────────────────────────────────────
function doGet(e) {
  try {
    var ss = setupSheets();
    var a  = e.parameter.action || '';
    if (a==='ping')             return R({status:'ok',message:'API v3.2 Online',ts:new Date().toISOString()});
    if (a==='getConfig')        return R(getConfig(ss));
    if (a==='getKnownFaces')    return R(getKnownFaces(ss));
    if (a==='getAttendance')    return R(getAttendance(ss, e.parameter.date||'', e.parameter.type||''));
    if (a==='getUsers')         return R(getUsers(ss));
    if (a==='getAuditLogs')     return R(getAuditLogs(ss));
    if (a==='getPatrolPoints')  return R(getPatrolPoints(ss));
    if (a==='getPatrolLogs')    return R(getPatrolLogs(ss, e.parameter.date||'', e.parameter.category||''));
    return R({status:'ok',message:'SPK Attendance API v3.2'});
  } catch(ex) {
    Logger.log('doGet ERR: ' + ex.message);
    return E(ex.message);
  }
}

// ─── doPost ────────────────────────────────────────────────
function doPost(e) {
  var b = {};
  try { b = JSON.parse(e.postData.contents); }
  catch(_) { return E('Invalid JSON'); }

  try {
    var ss = setupSheets();
    var a  = b.action || '';
    if (a==='registerUser')      return R(registerUser(ss, b));
    if (a==='logAttendance')     return R(logAttendance(ss, b));
    if (a==='saveConfig')        return R(saveConfig(ss, b));
    if (a==='adminLogin')        return R(adminLogin(ss, b));
    if (a==='deleteUser')        return R(deleteUser(ss, b));
    if (a==='getAISummary')      return R(getAISummary(ss, b));
    if (a==='savePhoto')         return R(savePhoto(b));
    if (a==='addAdmin')          return R(addAdmin(ss, b));
    if (a==='savePatrolPoint')   return R(savePatrolPoint(ss, b));
    if (a==='deletePatrolPoint') return R(deletePatrolPoint(ss, b));
    if (a==='logPatrolScan')     return R(logPatrolScan(ss, b));
    return E('Unknown action: ' + a);
  } catch(ex) {
    Logger.log('doPost ERR [' + b.action + ']: ' + ex.message);
    return E(ex.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════
function getConfig(ss) {
  var d=ss.getSheetByName(SH.CONFIG).getDataRange().getValues(), c={};
  for (var i=1;i<d.length;i++) c[d[i][0]]=d[i][1];
  return {status:'ok',lat:c['Target Latitude']||'',lng:c['Target Longitude']||'',
          radius:c['Allowed Radius (KM)']||'0.1',aiEngine:c['AI Engine']||'gemini'};
}

function saveConfig(ss, b) {
  var sh=ss.getSheetByName(SH.CONFIG), d=sh.getDataRange().getValues();
  var m={'Target Latitude':b.lat,'Target Longitude':b.lng,'Allowed Radius (KM)':b.radius,
         'AI Engine':b.aiEngine,'Gemini API Key':b.geminiKey,'Claude API Key':b.claudeKey,'OpenAI API Key':b.openaiKey};
  for (var i=1;i<d.length;i++) {
    if (m[d[i][0]]!==undefined && m[d[i][0]]!==null && m[d[i][0]]!=='') {
      audit(ss, b.adminUser, 'config:'+d[i][0], String(d[i][1]), String(m[d[i][0]]));
      sh.getRange(i+1,2).setValue(m[d[i][0]]);
    }
  }
  return {status:'ok',message:'บันทึกการตั้งค่าเรียบร้อย'};
}

// ═══════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════
function getKnownFaces(ss) {
  var d=ss.getSheetByName(SH.USERS).getDataRange().getValues(), u=[];
  for (var i=1;i<d.length;i++) {
    if (!d[i][0]) continue;
    try { u.push({name:d[i][0],email:d[i][1],descriptors:JSON.parse(d[i][2])}); }
    catch(e) { Logger.log('Bad descriptor row '+i+': '+e.message); }
  }
  return {status:'ok',users:u};
}

function getUsers(ss) {
  var d=ss.getSheetByName(SH.USERS).getDataRange().getValues(), u=[];
  for (var i=1;i<d.length;i++) {
    if (d[i][0]) u.push({name:d[i][0],email:d[i][1],registeredAt:d[i][3],count:d[i][4]||0});
  }
  return {status:'ok',users:u};
}

function registerUser(ss, b) {
  if (!b.name) throw new Error('name required');
  if (!b.faceDescriptor||!b.faceDescriptor.length) throw new Error('faceDescriptor required');
  var sh=ss.getSheetByName(SH.USERS), d=sh.getDataRange().getValues();
  var row=-1, desc=[];
  for (var i=1;i<d.length;i++) {
    if (d[i][0]===b.name || (b.email&&b.email!==''&&d[i][1]===b.email)) {
      row=i+1; try{desc=JSON.parse(d[i][2]);}catch(_){} break;
    }
  }
  desc.push(b.faceDescriptor);
  var now=new Date().toISOString();
  if (row>0) {
    sh.getRange(row,3).setValue(JSON.stringify(desc));
    sh.getRange(row,4).setValue(now);
    sh.getRange(row,5).setValue(desc.length);
  } else {
    sh.appendRow([b.name,b.email||'',JSON.stringify(desc),now,1]);
  }
  Logger.log('Register: '+b.name+' | total: '+desc.length);
  return {status:'ok',message:'ลงทะเบียนสำเร็จ',count:desc.length,name:b.name};
}

function deleteUser(ss, b) {
  var sh=ss.getSheetByName(SH.USERS), d=sh.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (d[i][0]===b.name) {
      sh.deleteRow(i+1);
      audit(ss, b.adminUser||'?', 'deleteUser', b.name, 'DELETED');
      return {status:'ok',message:'ลบพนักงานเรียบร้อย'};
    }
  }
  return {status:'error',message:'ไม่พบพนักงาน: '+b.name};
}

// ═══════════════════════════════════════════════════════════
//  ATTENDANCE (IN / OUT)
// ═══════════════════════════════════════════════════════════
function logAttendance(ss, b) {
  if (!b.name) throw new Error('name required');
  var sh  = ss.getSheetByName(SH.ATTEND);
  var now = new Date(), tz = 'Asia/Bangkok';
  var t   = Utilities.formatDate(now, tz, 'HH:mm:ss');
  var d   = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
  var map = (b.lat&&b.lng) ? 'https://maps.google.com/?q='+b.lat+','+b.lng : '';
  var note = b.note||'';
  if (b.type==='IN'||!b.type) {
    var h=parseInt(t.split(':')[0]), m=parseInt(t.split(':')[1]);
    if (h>8||(h===8&&m>30)) note = note ? note+', สาย' : 'สาย';
  }
  sh.appendRow([
    b.name, b.email||'', b.type||'IN', t, d,
    b.lat||'', b.lng||'', map,
    b.photoUrl||'',
    parseFloat(b.distance||0).toFixed(4),
    b.fakeGPSFlag?'FLAG':'', note
  ]);
  // ★ บังคับ column Time (D=4) และ Date (E=5) ให้เป็น Plain Text
  // ป้องกัน Google Sheets แปลงเป็น Date Object อัตโนมัติ
  var lastRow = sh.getLastRow();
  sh.getRange(lastRow, 4, 1, 2).setNumberFormat('@');
  Logger.log('ATT OK: '+b.name+'|'+(b.type||'IN')+'|'+t+'|'+d+' row:'+lastRow);
  return {status:'ok',message:'บันทึกเวลาเรียบร้อย',name:b.name,type:b.type||'IN',time:t,date:d,note:note};
}

// ★ Helper: แปลง cell value (Date Object หรือ String) → "dd/MM/yyyy"
function _toDateStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'dd/MM/yyyy');
  }
  return String(val).trim();
}

// ★ Helper: แปลง cell value (Date Object หรือ String) → "HH:mm:ss"
function _toTimeStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'HH:mm:ss');
  }
  return String(val).trim();
}

function getAttendance(ss, date, type) {
  var rows = ss.getSheetByName(SH.ATTEND).getDataRange().getValues();
  var r = [];
  for (var i = 1; i < rows.length; i++) {
    // ★ แปลง Date Object → String ก่อนเปรียบเทียบ
    var rowDate = _toDateStr(rows[i][4]);
    var rowTime = _toTimeStr(rows[i][3]);
    if (date && rowDate !== date) continue;
    if (type && type !== 'all' && String(rows[i][2]) !== type) continue;
    r.push({
      name:        rows[i][0],
      email:       rows[i][1],
      type:        rows[i][2],
      time:        rowTime,
      date:        rowDate,
      lat:         rows[i][5],
      lng:         rows[i][6],
      mapLink:     rows[i][7],
      photoUrl:    rows[i][8],
      distance:    rows[i][9],
      fakeGPSFlag: rows[i][10],
      note:        rows[i][11]
    });
  }
  Logger.log('getAttendance date='+date+' found='+r.length);
  return {status:'ok', records:r, count:r.length};
}

// ═══════════════════════════════════════════════════════════
//  PATROL POINTS
// ═══════════════════════════════════════════════════════════
function getPatrolPoints(ss) {
  var d=ss.getSheetByName(SH.PAT_PTS).getDataRange().getValues(), p=[];
  for (var i=1;i<d.length;i++) {
    if (!d[i][0]||String(d[i][7]).toUpperCase()!=='TRUE') continue;
    p.push({id:d[i][0],name:d[i][1],category:d[i][2],
            lat:parseFloat(d[i][3])||0,lng:parseFloat(d[i][4])||0,
            radius:parseFloat(d[i][5])||0.05,description:d[i][6]||''});
  }
  return {status:'ok',points:p};
}

function savePatrolPoint(ss, b) {
  var sh=ss.getSheetByName(SH.PAT_PTS), d=sh.getDataRange().getValues();
  var eRow=-1;
  for (var i=1;i<d.length;i++) { if (d[i][0]===b.id){eRow=i+1;break;} }
  var id=b.id||('PT'+String(Date.now()).slice(-6));
  var row=[id,b.name,b.category,b.lat,b.lng,b.radius||'0.05',b.description||'','TRUE',b.adminUser||'Admin',new Date().toISOString()];
  if (eRow>0) {sh.getRange(eRow,1,1,row.length).setValues([row]);audit(ss,b.adminUser,'editPt','',b.name);}
  else {sh.appendRow(row);audit(ss,b.adminUser,'addPt','',b.name);}
  return {status:'ok',message:'บันทึกจุดตรวจเรียบร้อย',id:id};
}

function deletePatrolPoint(ss, b) {
  var sh=ss.getSheetByName(SH.PAT_PTS), d=sh.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (d[i][0]===b.id) {
      sh.getRange(i+1,8).setValue('FALSE');
      audit(ss,b.adminUser,'deletePt',d[i][1],'DISABLED');
      return {status:'ok',message:'ลบจุดตรวจเรียบร้อย'};
    }
  }
  return {status:'error',message:'ไม่พบจุดตรวจ'};
}

// ═══════════════════════════════════════════════════════════
//  PATROL LOGS
// ═══════════════════════════════════════════════════════════
function logPatrolScan(ss, b) {
  if (!b.name) throw new Error('name required');
  var sh  = ss.getSheetByName(SH.PAT_LOGS);
  var now = new Date(), tz = 'Asia/Bangkok';
  var t   = Utilities.formatDate(now, tz, 'HH:mm:ss');
  var d   = Utilities.formatDate(now, tz, 'dd/MM/yyyy');
  var map = (b.lat&&b.lng) ? 'https://maps.google.com/?q='+b.lat+','+b.lng : '';
  sh.appendRow([
    b.name, b.email||'', b.patrolPointName||'', b.patrolCategory||'',
    b.type||'CHECK', t, d,
    b.lat||'', b.lng||'', map,
    parseFloat(b.distance||0).toFixed(4),
    b.incidentReport||'ปกติ', b.photoUrl||'', b.fakeGPSFlag?'FLAG':''
  ]);
  // ★ บังคับ Time (col F=6) และ Date (col G=7) เป็น Plain Text
  var lastRow = sh.getLastRow();
  sh.getRange(lastRow, 6, 1, 2).setNumberFormat('@');
  Logger.log('PATROL OK: '+b.name+'@'+(b.patrolPointName||'?')+'|'+t+'|'+d);
  return {status:'ok', message:'บันทึกจุดตรวจเรียบร้อย', time:t, date:d};
}

function getPatrolLogs(ss, date, category) {
  var rows = ss.getSheetByName(SH.PAT_LOGS).getDataRange().getValues();
  var r = [];
  for (var i = 1; i < rows.length; i++) {
    // ★ แปลง Date Object → String
    var rowDate = _toDateStr(rows[i][6]);
    var rowTime = _toTimeStr(rows[i][5]);
    if (date && rowDate !== date) continue;
    if (category && category !== 'all' && String(rows[i][3]) !== category) continue;
    r.push({
      name:           rows[i][0],
      email:          rows[i][1],
      patrolPoint:    rows[i][2],
      category:       rows[i][3],
      type:           rows[i][4],
      time:           rowTime,
      date:           rowDate,
      lat:            rows[i][7],
      lng:            rows[i][8],
      mapLink:        rows[i][9],
      distance:       rows[i][10],
      incidentReport: rows[i][11],
      photoUrl:       rows[i][12],
      fakeGPSFlag:    rows[i][13]
    });
  }
  Logger.log('getPatrolLogs date='+date+' found='+r.length);
  return {status:'ok', records:r, count:r.length};
}

// ═══════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════
function adminLogin(ss, b) {
  var d=ss.getSheetByName(SH.ADMIN).getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (d[i][0]===b.username&&d[i][1]===b.password&&String(d[i][3]).toUpperCase()==='TRUE') {
      audit(ss,b.username,'login','','OK');
      return {status:'ok',role:d[i][2],username:d[i][0]};
    }
  }
  return {status:'error',message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'};
}

function addAdmin(ss, b) {
  ss.getSheetByName(SH.ADMIN).appendRow([b.username,b.password,b.role||'Manager','TRUE']);
  audit(ss,b.adminUser,'addAdmin','',b.username);
  return {status:'ok',message:'เพิ่ม Admin เรียบร้อย'};
}

function getAuditLogs(ss) {
  var d=ss.getSheetByName(SH.AUDIT).getDataRange().getValues(), r=[];
  for (var i=1;i<d.length;i++) r.push({ts:d[i][0],user:d[i][1],action:d[i][2],old:d[i][3],nw:d[i][4]});
  r.reverse();
  return {status:'ok',logs:r.slice(0,200)};
}

function audit(ss, user, action, oldV, newV) {
  try {
    ss.getSheetByName(SH.AUDIT).appendRow([new Date().toISOString(),user||'System',action,String(oldV||''),String(newV||'')]);
  } catch(e) { Logger.log('audit err: '+e.message); }
}

// ═══════════════════════════════════════════════════════════
//  PHOTO UPLOAD → Google Drive
//  ★ แยก request จาก logAttendance — ถ้า upload ล้มเหลว
//    ไม่กระทบการบันทึกเวลา
// ═══════════════════════════════════════════════════════════
function savePhoto(b) {
  try {
    if (!b.imageBase64||b.imageBase64.length<100) return {status:'error',message:'imageBase64 ว่าง'};

    // หา/สร้าง Folder หลัก
    var folder;
    if (PHOTO_FOLDER_ID&&PHOTO_FOLDER_ID.trim().length>5) {
      try { folder=DriveApp.getFolderById(PHOTO_FOLDER_ID.trim()); }
      catch(e) { folder=mkFolder('SPK_Photos',null); Logger.log('Folder ID ผิด ใช้ auto folder'); }
    } else {
      folder=mkFolder('SPK_Photos',null);
    }

    // subfolder ตามวันที่
    var today=Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd');
    var sub=mkFolder(today,folder);

    var b64=b.imageBase64.replace(/^data:image\/\w+;base64,/,'');
    var bytes=Utilities.base64Decode(b64);
    var fname=b.filename||('spk_'+Date.now()+'.jpg');
    var blob=Utilities.newBlob(bytes,'image/jpeg',fname);
    var file=sub.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    var url='https://drive.google.com/uc?export=view&id='+file.getId();
    Logger.log('Photo OK: '+fname+' | '+Math.round(bytes.length/1024)+'KB');
    return {status:'ok',url:url,sizeKB:Math.round(bytes.length/1024)};
  } catch(e) {
    Logger.log('savePhoto ERR: '+e.message);
    return {status:'error',message:'Photo upload failed: '+e.message};
  }
}

function mkFolder(name, parent) {
  var it=parent?parent.getFoldersByName(name):DriveApp.getFoldersByName(name);
  return it.hasNext()?it.next():(parent?parent.createFolder(name):DriveApp.createFolder(name));
}

// ═══════════════════════════════════════════════════════════
//  AI SUMMARY
// ═══════════════════════════════════════════════════════════
function getAISummary(ss, b) {
  var d=ss.getSheetByName(SH.CONFIG).getDataRange().getValues(), c={};
  for (var i=1;i<d.length;i++) c[d[i][0]]=d[i][1];
  var engine = c['AI Engine'] || 'gemini';
  var key    = {
    gemini: c['Gemini API Key']  || '',
    claude: c['Claude API Key']  || '',
    openai: c['OpenAI API Key']  || ''
  }[engine];
  if (!key) return {status:'error', message:'ยังไม่ตั้งค่า '+engine+' API Key'};

  var prompt = b.mode==='patrol'
    ? 'สรุปรายงานการตรวจจุดวันที่ '+b.date+' ภาษาราชการกระชับ 2-3 ประโยค:\n'+
      'ตรวจทั้งหมด '+b.totalCount+' ครั้ง มีรายงาน '+b.incidentCount+' จุด GPS ผิดปกติ '+b.flagCount+' ราย'
    : 'สรุปรายงานลงเวลาวันที่ '+b.date+' ภาษาราชการกระชับ 2-3 ประโยค:\n'+
      'เข้างาน '+b.inCount+' คน ออกงาน '+b.outCount+' คน ตรงเวลา '+b.onTimeCount+' คน สาย '+b.lateCount+' คน GPS ผิดปกติ '+b.flagCount+' ราย';

  try {
    var summary = '';
    var resp, parsed, rawText;

    if (engine === 'gemini') {
      // ★ ใช้ gemini-1.5-flash-latest — รองรับ Free tier (60 req/min)
      // gemini-2.0-flash ต้องการ billing เปิดอยู่
      resp    = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key='+key,
        {
          method:'POST',
          contentType:'application/json',
          payload: JSON.stringify({contents:[{parts:[{text:prompt}]}]}),
          muteHttpExceptions: true
        }
      );
      rawText = resp.getContentText();
      Logger.log('Gemini status: '+resp.getResponseCode()+' | body: '+rawText.slice(0,300));
      parsed  = JSON.parse(rawText);
      if (parsed.error) throw new Error('Gemini: '+parsed.error.message);
      summary = parsed.candidates[0].content.parts[0].text;

    } else if (engine === 'claude') {
      resp    = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},
        payload: JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:400,
          messages:[{role:'user',content:prompt}]}),
        muteHttpExceptions: true
      });
      rawText = resp.getContentText();
      Logger.log('Claude status: '+resp.getResponseCode());
      parsed  = JSON.parse(rawText);
      if (parsed.error) throw new Error('Claude: '+parsed.error.message);
      summary = parsed.content[0].text;

    } else if (engine === 'openai') {
      resp    = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
        payload: JSON.stringify({model:'gpt-4o-mini',
          messages:[{role:'user',content:prompt}]}),
        muteHttpExceptions: true
      });
      rawText = resp.getContentText();
      Logger.log('OpenAI status: '+resp.getResponseCode());
      parsed  = JSON.parse(rawText);
      if (parsed.error) throw new Error('OpenAI: '+parsed.error.message);
      summary = parsed.choices[0].message.content;
    }

    return {status:'ok', summary:summary, engine:engine};

  } catch(e) {
    Logger.log('AI ERR ['+engine+']: '+e.message);
    return {status:'error', message:'AI Error: '+e.message};
  }
}

// ═══════════════════════════════════════════════════════════
//  ทดสอบใน GAS Editor — กด Run แล้วเลือกฟังก์ชัน
// ═══════════════════════════════════════════════════════════

// ── รันเพื่อตรวจสอบและซ่อม Sheet ทุกอัน ──────────────────
function manualSetup() {
  var ss = setupSheets();
  Logger.log('=== Sheet Status ===');
  var keys = Object.keys(HEADERS);
  for (var i=0; i<keys.length; i++) {
    var sh = ss.getSheetByName(keys[i]);
    if (!sh) {
      Logger.log('❌ MISSING: ' + keys[i]);
    } else {
      var rows = sh.getLastRow();
      var cols = sh.getLastColumn();
      // แสดง header แถวแรกจริงๆ
      var actualHeaders = rows>0 ? sh.getRange(1,1,1,cols).getValues()[0] : [];
      Logger.log('✅ ' + keys[i] + ' | rows: ' + rows + ' | cols: ' + cols);
      Logger.log('   Expected : ' + JSON.stringify(HEADERS[keys[i]]));
      Logger.log('   Actual   : ' + JSON.stringify(actualHeaders));
    }
  }
  Logger.log('=== done ===');
}

// ── รันเพื่อทดสอบบันทึกเวลา ──────────────────────────────
function testLog() {
  var ss = setupSheets();
  var r = logAttendance(ss, {
    name:'TEST User', email:'test@spk.ac.th',
    type:'IN', lat:17.4178, lng:103.7892,
    distance:0.001, fakeGPSFlag:false, photoUrl:'', note:'test'
  });
  Logger.log('testLog result: ' + JSON.stringify(r));
}

// ── รันเพื่อทดสอบ query วันที่ (ใส่วันที่มีข้อมูลจริง) ──
function testQuery() {
  var ss = setupSheets();
  var TEST_DATE = '25/04/2026'; // ★ เปลี่ยนได้

  // แสดงชนิดข้อมูลจริงๆ ใน Sheet ก่อน
  var data = ss.getSheetByName(SH.ATTEND).getDataRange().getValues();
  Logger.log('=== Raw Date values in Attendance sheet (col E, index 4) ===');
  for (var i = 1; i < Math.min(data.length, 8); i++) {
    var raw   = data[i][4];
    var type  = raw instanceof Date ? 'Date Object' : (typeof raw);
    var asStr = _toDateStr(raw);
    Logger.log('Row '+(i+1)+': raw="'+raw+'" type='+type+' → converted="'+asStr+'"');
  }

  // query จริง
  var r = getAttendance(ss, TEST_DATE, '');
  Logger.log('=== Query date="'+TEST_DATE+'" → '+r.count+' records found ===');
  if (r.records.length > 0) {
    Logger.log('Record[0]: ' + JSON.stringify(r.records[0]));
  }
}

