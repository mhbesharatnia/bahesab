# باحساب

حسابداری شخصی وب، فارسی و RTL. داده در مرورگر (IndexedDB) می‌ماند؛ همگام‌سازی اختیاری با Object Storage آروان.

## نسخهٔ آنلاین

https://mhbesharatnia.github.io/bahesab/

## پیش‌نیاز

- **Node.js 22 LTS** (در `.nvmrc` مشخص شده)

```bash
nvm use   # یا: nvm install 22 && nvm use 22
```

## اجرا

```bash
cd apps/web
npm install
npm run dev
```

تست:

```bash
cd apps/web
npm test
```

ساخت production:

```bash
cd apps/web
npm run build
```

برای GitHub Pages:

```bash
cd apps/web
GITHUB_PAGES=1 npm run build
```

## ویژگی‌ها

- حساب نقدی / بانکی / اشخاص / صندوق + تراکنش افتتاحیه قابل ویرایش
- دسته‌ها و تراکنش‌های واقعی با منبع (دستی / تعهد / سری)
- تعهدات و مطالبات + تأیید با فرم کامل
- سری اقساط/مطالبات + تقویم شمسی
- ترازنامه جدا (نقد / طلب / بدهی)
- نقدینگی با بازهٔ پایان ماه و لیست ورودی/خروجی
- همگام‌سازی آروان + export/import
- تومان / ریال، تاریخ شمسی، RTL

## آروان و CORS

باکت می‌تواند خصوصی بماند. برای سینک از مرورگر، روی باکت CORS را برای origin اپ فعال کنید، مثلاً:

- `http://127.0.0.1:5173` (لوکال)
- `https://mhbesharatnia.github.io` (نسخهٔ عمومی)

متدها: `GET`, `PUT`, `HEAD` — هدرها: `*` یا حداقل `Authorization`, `Content-Type`.

## ریپو

https://github.com/mhbesharatnia/bahesab
