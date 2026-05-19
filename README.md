# خريطة المواقع الصحية

مشروع ثابت باللغة العربية RTL يعرض المواقع الصحية على خريطة Leaflet، ويقرأ البيانات من `data/sites.json` بدون Backend.

## إنشاء ملف البيانات

ثبّت المتطلبات ثم شغّل التحويل:

```bash
pip install -r requirements.txt
python tools/excel_to_json.py "C:\Users\PC\Downloads\البيان المنظم1.xlsx"
```

إذا كان ملف `البيان المنظم1.xlsx` موجودًا في مجلد المشروع أو في مجلد Downloads، يمكن تشغيل:

```bash
python tools/excel_to_json.py
```

سيتم إنشاء الملف:

```text
data/sites.json
data/sites.js
```

## التشغيل محليًا

شغّل خادمًا محليًا بسيطًا من مجلد المشروع:

```bash
python -m http.server 8000
```

ثم افتح:

```text
http://localhost:8000
```

يمكن أيضًا فتح `index.html` مباشرة من المجلد؛ يستخدم المشروع `data/sites.js` كنسخة احتياطية عندما يمنع المتصفح قراءة `data/sites.json` مباشرة.

## الخصوصية

في `app.js` يوجد المتغير:

```js
let privacyMode = true;
```

عندما تكون القيمة `true` يتم إخفاء أجزاء من أرقام الجوال. عند تغييرها إلى `false` تظهر الأرقام كاملة. يوجد أيضًا خيار في أعلى الصفحة للتحكم بذلك أثناء الاستخدام.

## النشر على GitHub Pages

ارفع الملفات التالية إلى المستودع:

```text
index.html
styles.css
app.js
data/sites.json
```

ثم فعّل GitHub Pages من إعدادات المستودع. لا يحتاج المشروع إلى Backend أو قاعدة بيانات.
