# 🏫 SPK Attendance System v3.0
## ระบบลงเวลาและตรวจพื้นที่ — โรงเรียนโซ่พิสัยพิทยาคม

---

## 📁 โครงสร้างไฟล์

```
spk-v3/
├── index.html          ← หน้าหลัก (นาฬิกา + เมนู)
├── scan.html           ← สแกนลงเวลา เข้า/ออก
├── patrol.html         ← สแกนจุดตรวจ + รายงานเหตุการณ์
├── admin.html          ← Admin Dashboard (ทุกอย่าง)
│                          ├─ รายงานลงเวลา
│                          ├─ รายงานจุดตรวจ
│                          ├─ ลงทะเบียนบุคลากร
│                          ├─ จัดการบุคลากร
│                          ├─ จัดการจุดตรวจ
│                          ├─ ตั้งค่าระบบ / GPS / AI
│                          └─ Audit Log
├── js/
│   └── api-config.js   ← ใส่ GAS URL ที่นี่
├── code.gs             ← วางใน Google Apps Script
└── netlify.toml        ← Netlify config
```

---

## ✨ ฟีเจอร์ทั้งหมด

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 👤 **Face Recognition** | จดจำใบหน้า 128D — ไม่เก็บรูปจริง |
| 👁️ **Liveness Detection** | กะพริบตา 2 ครั้ง ป้องกันรูปหลอก |
| 📍 **GPS Geofencing** | Haversine + ตรวจ Fake GPS |
| ✅/🚪 **IN/OUT สแกน** | แยกสแกนเข้า/ออกงาน |
| 🗺️ **จุดตรวจ** | หมวดหมู่ + รายงานเหตุการณ์ + ภาพ |
| 📸 **บีบอัดรูป** | Client-side compress ไม่เกิน ~300KB + Watermark |
| ☁️ **Google Drive** | รูปเก็บแยก Folder ตามวันที่ ไม่ขยาย Sheets |
| 🧠 **AI Engine** | Gemini / Claude / GPT-4o เลือกได้ |
| 📄 **PDF Export** | พิมพ์รายงานได้ทันที |
| 🔒 **Admin Only** | ลงทะเบียน/ตั้งค่า/จุดตรวจ = Admin เท่านั้น |
| 📋 **Audit Log** | บันทึกทุก Action ของ Admin |
| 📊 **Auto-Build DB** | สร้าง Sheet อัตโนมัติทุก Sheet |

---

## 🚀 วิธีติดตั้ง (ทำตามลำดับ)

### ═══ STEP 1 — สร้าง Google Sheets ═══

1. ไปที่ **[sheets.google.com](https://sheets.google.com)**
2. สร้าง Spreadsheet ใหม่ ตั้งชื่อ "SPK Attendance"
3. คัดลอก **Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/ [COPY ส่วนนี้] /edit
   ```

---

### ═══ STEP 2 — สร้าง Google Drive Folder สำหรับรูปภาพ ═══

1. ไปที่ **[drive.google.com](https://drive.google.com)**
2. สร้าง Folder ใหม่ ตั้งชื่อ "SPK_Photos"
3. เปิด Folder → ดู URL:
   ```
   https://drive.google.com/drive/folders/ [COPY ส่วนนี้]
   ```
4. บันทึก **Folder ID** ไว้

---

### ═══ STEP 3 — ติดตั้ง Google Apps Script ═══

1. ใน Google Sheets → **Extensions → Apps Script**
2. ลบโค้ดเดิมออกทั้งหมด
3. **วางเนื้อหาจากไฟล์ `code.gs`** ทั้งหมด
4. แก้ไข 2 บรรทัดแรก:
   ```javascript
   const SPREADSHEET_ID  = 'วาง Spreadsheet ID ที่นี่';
   const PHOTO_FOLDER_ID = 'วาง Drive Folder ID ที่นี่';
   ```
5. กด **Save** (Ctrl+S หรือ Cmd+S)
6. คลิก **Deploy → New deployment**
   - **Type**: Web app
   - **Execute as**: Me
   - **Who has access**: Anyone
7. กด **Deploy**
8. ถ้ามีหน้าขอสิทธิ์ → **Advanced → Go to (unsafe) → Allow**
9. **คัดลอก Web App URL** (รูปแบบ: `https://script.google.com/macros/s/.../exec`)

> ⚠️ **สำคัญ**: ทุกครั้งที่แก้ไข code.gs ต้อง Deploy ใหม่เป็น "New deployment" หรือ "Manage deployments → Edit"

---

### ═══ STEP 4 — แก้ไข js/api-config.js ═══

เปิดไฟล์ `js/api-config.js` แล้วใส่ URL:

```javascript
const GAS_API_URL = 'https://script.google.com/macros/s/YOUR_ID_HERE/exec';
```

---

### ═══ STEP 5 — Deploy บน Netlify ═══

**วิธี Drag & Drop (ง่ายที่สุด)**

1. ไปที่ **[app.netlify.com/drop](https://app.netlify.com/drop)**
2. ลากโฟลเดอร์ `spk-v3` ทั้งโฟลเดอร์ไปวาง
3. รอ 1-2 นาที → ได้ URL เช่น `https://spk-abc123.netlify.app`

**วิธี GitHub (แนะนำ — Auto deploy)**

1. Push โค้ดขึ้น GitHub repository
2. ไปที่ [app.netlify.com](https://app.netlify.com) → Add new site → Import
3. เลือก Repo → Auto deploy ทุกครั้งที่ push

---

### ═══ STEP 6 — ตั้งค่าระบบครั้งแรก (Admin) ═══

1. เปิด `https://your-site.netlify.app/admin.html`
2. Login: **Username**: `admin` | **Password**: `spk1234`
3. ไปที่แท็บ **⚙️ ตั้งค่า**
4. วาง GAS URL ในช่อง Web App URL
5. กด **📍 ดึงพิกัดตำแหน่งปัจจุบัน** (ยืนอยู่ที่โรงเรียน)
6. ตั้งรัศมี เช่น `0.06` (= 60 เมตร) หรือ `0` เพื่อปิดการตรวจสอบ
7. เลือก AI Engine + ใส่ API Key (ถ้าต้องการ)
8. กด **💾 บันทึกการตั้งค่าทั้งหมด**

---

## 📖 วิธีใช้งาน

### 👤 ลงทะเบียนบุคลากร (Admin เท่านั้น)

1. เข้า `admin.html` → Login → แท็บ **👤 ลงทะเบียน**
2. กรอกชื่อ-นามสกุล + อีเมล
3. กด **📸 บันทึกใบหน้า** 3 ครั้ง (ตรง, ซ้าย, ขวา)

### 📷 สแกนลงเวลา

1. เปิด `scan.html` (หรือกดจากหน้าหลัก)
2. เลือก ✅ **เข้างาน** หรือ 🚪 **ออกงาน**
3. รอระบบตรวจ GPS → โหลด AI (มี Progress Bar แสดง)
4. กด **▶ แตะเพื่อเริ่มสแกน**
5. **กะพริบตา 2 ครั้ง** (Liveness)
6. ระบบจดจำใบหน้าอัตโนมัติ
7. กด **ยืนยัน**

### 🗺️ สแกนจุดตรวจ

1. เปิด `patrol.html`
2. เลือก **หมวดหมู่** → เลือก **จุดตรวจ**
3. กด "ต่อไป" → สแกนใบหน้า (กะพริบตา 2 ครั้ง)
4. กรอก **รายงานสถานการณ์** (ปกติ / หรือรายงานเหตุ)
5. **ถ่ายภาพประกอบ** (ถ้ามีเหตุการณ์)
6. กด **บันทึก**

### 📊 Admin Dashboard

| แท็บ | สิ่งที่ทำได้ |
|-----|-----------|
| 📅 ลงเวลา | ดูประวัติเข้า/ออกงาน, AI สรุป, PDF |
| 🗺️ จุดตรวจ | ดูประวัติตรวจ, กรองหมวด, AI สรุป, PDF |
| 👤 ลงทะเบียน | เพิ่มบุคลากรใหม่ + สแกนใบหน้า |
| 👥 บุคลากร | ดูรายชื่อ, ลบ |
| 📍 จุดตรวจ | เพิ่ม/แก้ไข/ลบจุดตรวจ + กำหนด GPS |
| ⚙️ ตั้งค่า | API URL, GPS, AI Engine, API Keys |
| 📋 Audit Log | ประวัติ Action ทั้งหมดของ Admin |

---

## 🗄️ Google Sheets ที่สร้างอัตโนมัติ

| Sheet | เก็บข้อมูล |
|-------|-----------|
| **Users** | ชื่อ, อีเมล, FaceDescriptors, วันที่ |
| **Attendance** | ลงเวลาเข้า/ออก + รูป + GPS |
| **Patrol_Points** | จุดตรวจทั้งหมด |
| **Patrol_Logs** | ประวัติตรวจจุด + รายงาน |
| **Config** | GPS, AI Engine, API Keys |
| **Admin_Settings** | Username, Password, Role |
| **Audit_Logs** | บันทึกทุก Admin Action |

---

## 🔑 เปลี่ยนรหัสผ่าน Admin

เปิด Google Sheets → Sheet **Admin_Settings** → แก้ Column B ได้เลย

---

## ❓ แก้ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|-------|--------|
| โหลด AI นานมาก | ครั้งแรกต้องดาวน์โหลด Model ~6MB ปกติ รอประมาณ 10-30 วินาที |
| กล้องไม่เปิด | ต้องเข้าผ่าน **HTTPS** + Allow Camera |
| GPS ไม่ทำงาน | Allow Location + ใช้นอกอาคาร |
| เชื่อมต่อ API ไม่ได้ | ตรวจ URL ใน config + Re-deploy GAS เป็น "Anyone" |
| Liveness ไม่ผ่าน | กะพริบตาช้าๆ ชัดเจน ในที่มีแสงเพียงพอ |
| CORS Error | Re-deploy GAS และเลือก "Anyone" access |

---

## 🌐 Browser รองรับ

Chrome 80+ / Safari 14+ / Firefox 75+ / Edge 80+  
**ต้องใช้ HTTPS เท่านั้น** (Netlify ให้ HTTPS อัตโนมัติ)

---

MIT License · โรงเรียนโซ่พิสัยพิทยาคม · v3.0
