# StoryTools – Hướng dẫn sử dụng

Tool cá nhân chạy localhost: truyện → các ảnh (slide) → khung → prompt → Gemini tạo ảnh → lời thoại/ghép → xem truyện → PNG/PDF.

## Chạy

```bash
npm install
cp .env.example .env   # điền GEMINI_API_KEY (hoặc nhập trong tab Cài đặt)
npm run dev            # mở http://127.0.0.1:5173
```

Bản build: `npm run build && npm start` → http://127.0.0.1:5174

## Khái niệm

- **Truyện**: khổ ảnh (Dọc 9:16 TikTok / Ngang 16:9 YouTube), phong cách vẽ, nhân vật, tóm tắt chung.
- **Ảnh**: 1 slide khi đăng. Mỗi ảnh có ý tưởng riêng và bố cục riêng (1 khung tràn ảnh, hoặc 2/3/4/6 khung).
- **Khung**: 1 lần tạo ảnh AI, có bối cảnh, hành động, biểu cảm, lời thoại và prompt riêng.

## Tự động tạo cả truyện

Ở bước **1. Kịch bản**, thẻ "🤖 Tự động tạo truyện":

1. Nhập **cốt truyện**, chọn **số ảnh** (1–35) và **khung mỗi ảnh** (1–4 cố định, hoặc "Gemini tự chọn 1–3").
2. Bấm **Tự động tạo cả truyện** → xác nhận chi phí ước tính:
   - Gemini viết cả truyện trong 1 lần gọi (ý tưởng từng ảnh + từng khung + lời thoại); bố cục tự chọn theo số khung;
   - vẽ lần lượt từng khung (kèm ảnh khung trước để giữ phong cách);
   - Gemini **xem ảnh vừa vẽ** để đặt bóng thoại vào vùng trống, đuôi chỉ về người nói, chỉnh câu thoại cho khớp biểu cảm.
3. Xong tự chuyển sang **bước 3**: nhấp đúp bóng thoại để sửa chữ, kéo để đổi vị trí; rồi **bước 4** để duyệt và đăng.

- Tick "Dừng lại để duyệt kịch bản trước khi vẽ" nếu muốn sửa kịch bản trước khi tốn tiền vẽ.
- Có thể bấm **Dừng** bất cứ lúc nào (dừng sau khung đang chạy). Nút **"Vẽ N khung còn thiếu & đặt thoại"** chạy tiếp phần chưa xong.
- Tiến trình vẫn chạy khi chuyển sang bước khác (thanh tiến trình hiện trên đầu).
- Ở bước 3, nút **✨ AI đặt thoại** cho từng khung chạy lại việc đặt bóng thoại theo ảnh.

## Quy trình thủ công

1. **Nhân vật**: tên + mô tả cố định (tóc, áo, màu sắc…) + 1–3 ảnh tham chiếu rõ mặt.
2. **1. Kịch bản**: thiết lập truyện, "+ Thêm ảnh" cho từng ảnh, nhập ý tưởng, chọn bố cục, bấm "Gemini viết N khung" (hoặc viết cho tất cả ảnh chưa có nội dung). Sửa từng khung.
3. **2. Prompt & ảnh**: prompt tự ghép từ phong cách + ý tưởng ảnh + mô tả nhân vật + khung (sửa tay được). Tạo từng khung hoặc hàng loạt; lịch sử các lần tạo được giữ để chọn. Có thể tải ảnh tự làm lên.
4. **3. Lời thoại & ghép**: chọn ảnh; bóng thoại tự đặt từ lời thoại; kéo thân để di chuyển, chấm xanh để chỉnh đuôi, ô vuông để đổi độ rộng. Ảnh nhiều khung được ghép có viền; ảnh 1 khung giữ tràn ảnh.
5. **4. Duyệt & đăng**: lướt toàn bộ ảnh như carousel (phím ← →), rồi:
   - đặt trạng thái Nháp / Đã duyệt / Đã đăng (hiện ở danh sách truyện);
   - "Gemini viết caption": tiêu đề (≤ 90 ký tự), caption, hashtag, gợi ý mood nhạc + từ khoá tìm nhạc; có nút copy;
   - "Chia sẻ qua Wi-Fi": hiện mã QR, quét bằng điện thoại cùng Wi-Fi để mở trang có ảnh + tiêu đề + caption + gợi ý nhạc;
   - hoặc tải PNG tất cả ảnh / PDF.
6. Đăng tay trên TikTok: + → Tải lên → chọn ảnh theo thứ tự → thêm âm thanh → dán tiêu đề, caption → đăng → quay lại đánh dấu "Đã đăng".

## Chia sẻ qua Wi-Fi (mã QR)

- Chạy một server riêng ở cổng `SHARE_PORT` (mặc định 5175) trên mạng LAN, **chỉ** phục vụ trang `/s/<token>` chỉ đọc. Tool chính vẫn chỉ mở ở `127.0.0.1`.
- Link có token ngẫu nhiên, tự tắt sau 30 phút hoặc khi bấm "Dừng chia sẻ". Mỗi lúc chỉ chia sẻ 1 truyện.
- Ảnh gửi đi là bản tại thời điểm bấm chia sẻ; sửa truyện thì bấm "Chia sẻ lại".
- Lần đầu Windows có thể hỏi quyền mạng cho Node.js: cho phép **Private networks**. Nếu điện thoại không mở được, kiểm tra cùng Wi-Fi và thử địa chỉ khác trong danh sách (bỏ qua các adapter `vEthernet`/WSL).
- TikTok cho tối đa 35 ảnh mỗi bài.

## Ghi chú

- Không có trường giờ đồng hồ riêng: muốn thể hiện thời gian (hoặc có đồng hồ) thì ghi thẳng vào bối cảnh hoặc prompt. Truyện cũ khi mở sẽ tự bỏ dòng "wall clock" khỏi prompt đã lưu.
- Lời thoại luôn chèn bằng code (font Be Vietnam Pro) để đúng dấu tiếng Việt.
- Sửa lời thoại ở bước 1 sẽ đặt lại bóng thoại của khung đó.
- Đổi bố cục sang ít khung hơn sẽ xoá các khung thừa (có hỏi xác nhận).
- Tỉ lệ ảnh yêu cầu Gemini = tỉ lệ gần nhất với ô khung; ảnh được crop vừa ô.
- "Gửi kèm ảnh khung trước" giúp đồng nhất phong cách (tốn thêm token đầu vào).
- Dữ liệu nằm trong `data/` (JSON + ảnh), đã gitignore.
- Model mặc định: text `gemini-3.8-flash`, ảnh `gemini-3.1-flash-image`. Model text đổi trong tab Cài đặt (gợi ý lấy trực tiếp từ API key). Model ảnh không có free tier.
- Dropdown **Model ảnh** (tab Cài đặt, thẻ Tự động tạo truyện, bước 2) có giá ước tính mỗi ảnh: Flash Lite ~$0.035, Flash ~$0.07, Pro ~$0.146; ước tính chi phí truyện cập nhật theo model đang chọn. Đổi ở bước 1/2 là lưu ngay cho cả tool.
- `gemini-2.5-flash` đã bị khoá với tài khoản mới (lỗi 404 "no longer available to new users") – chọn model đời mới hơn.

## Cấu trúc

- `server/index.js` – API routes; `server/storage.js` – lưu file; `server/gemini.js` – gọi Gemini
- `src/lib/story-model.js` – cấu trúc truyện/ảnh/khung; `layouts.js` – khổ/bố cục; `render-slide.js` – vẽ ảnh (dùng chung editor, preview, export); `bubbles.js`; `prompt-builder.js`; `image-cache.js`; `export.js`
- `src/components/` – các màn hình
