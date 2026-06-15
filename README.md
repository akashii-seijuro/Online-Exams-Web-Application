# ClassPulse

ClassPulse là ứng dụng web hỗ trợ giáo viên tạo bài kiểm tra nhanh, mở phòng làm bài bằng mã phòng/QR, cho học sinh tham gia trên điện thoại mà không cần tài khoản, chấm điểm tự động và xem báo cáo phân tích sau phiên.

## Tính năng chính

- Đăng ký, đăng nhập giáo viên.
- Quản lý đề thi: tạo, sửa, xóa đề thi.
- Hỗ trợ câu hỏi:
  - Trắc nghiệm một đáp án đúng.
  - Đúng/Sai theo từng mệnh đề.
  - Tự luận ngắn với danh sách đáp án chấp nhận.
- Hiển thị nội dung giàu định dạng: LaTeX và Markdown table.
- Upload ảnh câu hỏi qua Cloudinary nếu có cấu hình.
- Import câu hỏi từ PDF bằng Gemini nếu có `GEMINI_API_KEY`.
- Tạo phiên làm bài từ đề thi.
- Học sinh tham gia bằng mã phòng, không cần tài khoản.
- Theo dõi lobby và tiến độ làm bài realtime bằng Socket.io.
- Auto-save đáp án học sinh trong Redis.
- Chấm điểm tự động và lưu lịch sử phiên vào PostgreSQL.
- Xem report theo phiên: điểm trung bình, bảng xếp hạng, phân tích từng câu hỏi.
- Quản lý và xóa phiên lịch sử.

## Sản phẩm demo đã được deploy

Có thể truy cập https://class-pulse-web-nu.vercel.app/ để test.


## Yêu cầu môi trường

Cần cài đặt:

- Node.js 20 hoặc mới hơn.
- npm.
- Docker và Docker Compose.

Khuyến nghị dùng Docker để chạy PostgreSQL và Redis local.

## Cài đặt

Clone repository và đến thư mục SourceCode:

```bash
cd SourceCode
```

Cài dependencies:

```bash
npm install
```

Tạo file môi trường:

```bash
cp .env.example .env
```

Trên Windows PowerShell có thể dùng:

```powershell
Copy-Item .env.example .env
```

Sau đó cập nhật `.env` cho môi trường local. Ví dụ:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/classpulse
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_this_to_a_random_32_char_string
JWT_REFRESH_SECRET=change_this_to_another_random_32_char_string
PORT=3001
NODE_ENV=development
CLIENT_URL=http://127.0.0.1:3000

VITE_API_URL=http://127.0.0.1:3001
VITE_WS_URL=http://127.0.0.1:3001
```

Các biến sau là tùy chọn. Server vẫn khởi động được nếu không có chúng:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
```

Nếu thiếu Cloudinary config, chức năng upload ảnh sẽ trả lỗi cấu hình khi sử dụng. Nếu thiếu Gemini config, chức năng import PDF sẽ trả lỗi cấu hình khi sử dụng.

## Khởi động database và Redis

Chạy PostgreSQL và Redis bằng Docker Compose:

```bash
docker compose up -d
```

Kiểm tra container:

```bash
docker compose ps
```

## Chuẩn bị Prisma

Generate Prisma Client:

```bash
npm run prisma:generate
```

Đẩy schema vào database local:

```bash
npm run prisma:push -w apps/server
```

Lệnh này dùng cho môi trường phát triển. Khi deploy production, dùng migration deploy nếu dự án đã có migration:

```bash
npm run prisma:migrate:deploy
```

## Chạy chương trình ở môi trường phát triển

Chạy cả frontend và backend:

```bash
npm run dev
```

Mặc định:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:3001`
- Health check: `http://127.0.0.1:3001/health`

Nếu port `3000` hoặc `3001` đang được dùng, hãy tắt tiến trình đang chiếm port hoặc chỉnh cấu hình dev server tương ứng.

## Chạy riêng từng phần

Frontend:

```bash
npm run dev:web
```

Backend:

```bash
npm run dev:server
```

## Build production

Build toàn bộ dự án:

```bash
npm run build
```

Chạy backend sau khi build:

```bash
npm run start
```

Frontend build output nằm trong workspace `apps/web` theo cấu hình Vite.


## Luồng sử dụng cơ bản

1. Mở frontend tại `http://127.0.0.1:3000`.
2. Đăng ký hoặc đăng nhập tài khoản giáo viên.
3. Tạo đề thi trong Teacher Portal.
4. Tạo phiên làm bài từ đề thi.
5. Hiển thị mã phòng/QR cho học sinh.
6. Học sinh vào trang join, nhập mã phòng và tên.
7. Giáo viên bắt đầu phiên.
8. Học sinh làm bài và nộp bài.
9. Giáo viên theo dõi live monitor và xem report sau khi kết thúc phiên.
