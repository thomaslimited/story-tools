# StoryTools

Tool chạy trên máy bạn, biến một cốt truyện thành bộ ảnh truyện tranh có lời thoại tiếng Việt, sẵn sàng đăng TikTok hoặc YouTube. Gemini viết kịch bản và vẽ ảnh; chữ được chèn bằng code nên không bao giờ sai dấu.

- Giao diện: `http://127.0.0.1:5173`
- Khổ ảnh: dọc 9:16 (TikTok/Shorts) và ngang 16:9 (YouTube)
- Tối đa 35 ảnh mỗi bài TikTok
- Dữ liệu nằm trong `data/` (không đẩy lên git)

Bản hướng dẫn có giao diện đẹp hơn: [`docs/huong-dan-su-dung.html`](docs/huong-dan-su-dung.html) (mở trực tiếp bằng trình duyệt).

## Mục lục

- [Khởi động](#khởi-động)
- [Truyện, Ảnh, Khung](#truyện-ảnh-khung)
- [Nhân vật](#nhân-vật)
- [Tạo truyện tự động](#tạo-truyện-tự-động)
- [Bốn bước thủ công](#bốn-bước-thủ-công)
- [Chỉnh bóng thoại](#chỉnh-bóng-thoại)
- [Duyệt và đăng TikTok](#duyệt-và-đăng-tiktok)
- [Chi phí và model](#chi-phí-và-model)
- [Mẹo giữ nhân vật](#mẹo-giữ-nhân-vật)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Dữ liệu và sao lưu](#dữ-liệu-và-sao-lưu)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Ủng hộ tác giả](#ủng-hộ-tác-giả)
- [Cộng đồng](#cộng-đồng)

## Khởi động

Yêu cầu: Node.js 20 trở lên.

```bash
npm install
npm run dev     # mở http://127.0.0.1:5173
```

Lần đầu cần có **Gemini API key**: lấy ở [aistudio.google.com/apikey](https://aistudio.google.com/apikey), rồi dán vào tab **Cài đặt** (hoặc chép `.env.example` thành `.env` và điền `GEMINI_API_KEY`). Key phải bật thanh toán vì model vẽ ảnh không có gói miễn phí.

Muốn chạy bản build thay vì bản dev:

```bash
npm run build
npm start       # mở http://127.0.0.1:5174
```

> Tool chỉ lắng nghe ở `127.0.0.1`, máy khác trong mạng không vào được. Riêng tính năng chia sẻ qua Wi-Fi mở tạm một cổng khác, chỉ khi bạn bấm và tự tắt sau 30 phút.

## Truyện, Ảnh, Khung

Ba mức này quyết định mọi thao tác còn lại, nên nắm trước khi bắt đầu.

| Mức | Là gì | Nội dung |
| --- | --- | --- |
| **Truyện** | Một bài đăng | Khổ ảnh, phong cách vẽ, dàn nhân vật, cốt truyện |
| **Ảnh** | Một slide người xem lướt qua | Ý tưởng riêng và bố cục riêng: 1 khung tràn ảnh, hoặc 2, 3, 4, 6 khung |
| **Khung** | Một lần gọi AI vẽ | Bối cảnh, hành động, biểu cảm, lời thoại và prompt riêng. Tiền chủ yếu tốn ở đây |

Ảnh 1 khung được in tràn toàn khổ, không viền. Ảnh nhiều khung mới được ghép lại thành lưới có viền. Truyện 5 ảnh, mỗi ảnh 2 khung nghĩa là 10 lần gọi AI vẽ.

## Nhân vật

Đây là phần quyết định truyện có đồng nhất hay không, nên làm kỹ trước khi tạo truyện. Vào tab **Nhân vật**, bấm **+ Thêm nhân vật** và điền:

- **Tên**: dùng đúng tên này khi viết cốt truyện để Gemini gán vai chính xác.
- **Mô tả cố định**: tuổi, kiểu tóc, màu mắt, trang phục, phụ kiện. Càng cụ thể càng ổn định. Ví dụ: *cậu bé 13 tuổi, tóc đen rối xù, áo polo vàng mù tạt, tạp dề xanh rêu, giày vải đỏ*.
- **Ảnh tham chiếu**: 1–3 ảnh rõ mặt, nền đơn giản. Mọi lần vẽ đều gửi kèm các ảnh này.

Mô tả được chèn tự động vào prompt của mọi khung có nhân vật đó, nên không cần nhắc lại khi viết kịch bản.

## Tạo truyện tự động

Cách nhanh nhất: chỉ nhập cốt truyện, phần còn lại tool tự chạy. Vào **Truyện → tạo truyện mới → bước 1. Kịch bản**, thẻ **🤖 Tự động tạo truyện**.

1. **Nhập cốt truyện.** Viết vài câu về diễn biến và cái kết, gọi nhân vật đúng tên. Chọn **số ảnh** (1–35) và **khung mỗi ảnh**: cố định 1–4, hoặc để Gemini tự chọn 1–3 tuỳ cảnh.
2. **Chọn model ảnh và xem giá.** Dropdown **Model ảnh** ghi sẵn giá mỗi ảnh, bên cạnh là ước tính cho cả truyện, ví dụ *≈ $0.35 cho 10 khung*. Đổi model ở đây là lưu luôn cho cả tool.
3. **Bấm Tự động tạo cả truyện.** Tool hỏi xác nhận chi phí, rồi chạy tuần tự: Gemini viết toàn bộ kịch bản trong một lần gọi, vẽ từng khung (gửi kèm ảnh khung trước để giữ phong cách), sau đó nhìn ảnh vừa vẽ để đặt bóng thoại vào vùng trống và chỉnh câu thoại cho khớp biểu cảm. Muốn đọc kịch bản trước khi tốn tiền vẽ thì tick **Dừng lại để duyệt kịch bản trước khi vẽ**.
4. **Duyệt kết quả.** Chạy xong tool tự chuyển sang bước 3 để bạn sửa lời thoại và vị trí bóng, rồi sang bước 4 để đăng.

Đang chạy có thể bấm **Dừng**, tool dừng sau khung hiện tại. Phần dở dang chạy tiếp bằng nút **Vẽ N khung còn thiếu & đặt thoại**. Chuyển sang tab khác tiến trình vẫn chạy, thanh tiến trình hiện trên đầu trang.

## Bốn bước thủ công

Khi muốn kiểm soát từng ảnh, làm lần lượt bốn bước trong trang soạn truyện.

1. **Kịch bản.** Chọn khổ ảnh, phong cách vẽ và dàn nhân vật. Bấm **+ Thêm ảnh thủ công** cho từng ảnh, nhập ý tưởng, chọn bố cục rồi bấm **✨ Gemini viết N khung**. Sửa lại bối cảnh, hành động, biểu cảm, lời thoại của từng khung nếu cần.
2. **Prompt & ảnh.** Prompt tự ghép từ phong cách, ý tưởng ảnh, mô tả nhân vật và nội dung khung; sửa tay được. Vẽ từng khung bằng **Tạo ảnh** hoặc vẽ hàng loạt các khung còn thiếu. Mỗi lần vẽ lại đều được giữ, bấm thumbnail để chọn bản ưng ý. Có sẵn nút tải ảnh ngoài lên nếu bạn tự vẽ.
3. **Lời thoại & ghép.** Chọn từng ảnh để xem bản ghép thật. Bóng thoại tự đặt từ lời thoại trong kịch bản; chỉnh bằng chuột theo bảng bên dưới. Ảnh nhiều khung được ghép có viền, ảnh 1 khung giữ tràn ảnh.
4. **Duyệt & đăng.** Lướt toàn bộ truyện như carousel, viết caption, rồi chuyển ảnh sang điện thoại để đăng.

## Chỉnh bóng thoại

Toàn bộ thao tác nằm trên khung tranh ở bước 3.

| Thao tác | Kết quả |
| --- | --- |
| Bấm vào bóng thoại | Chọn bóng, cột phải hiện ô sửa chữ và thanh chỉnh cỡ chữ |
| **Nhấp đúp** vào bóng thoại | Sửa chữ ngay trên ảnh. `Enter` lưu, `Esc` huỷ |
| Kéo thân bóng | Di chuyển bóng, đuôi vẫn chỉ về chỗ cũ |
| Kéo chấm xanh | Đổi hướng và độ dài đuôi bóng, trỏ về người đang nói |
| Kéo ô vuông bên phải | Đổi độ rộng bóng, chữ tự xuống dòng theo |
| Nút **✨ AI đặt thoại** | Gemini nhìn lại ảnh và đặt bóng vào vùng trống, có thể chỉnh nhẹ câu chữ |
| Nút **+ Bóng** / **Đặt lại** | Thêm bóng trống, hoặc đặt lại theo mẫu từ lời thoại trong kịch bản |

Sửa lời thoại ở bước 1 sẽ đặt lại bóng thoại của khung đó, nên hãy chốt lời thoại trước rồi mới tinh chỉnh vị trí.

## Duyệt và đăng TikTok

Bước 4 gom mọi thứ cần cho một bài đăng. Phía trên là carousel xem lại cả truyện, dùng phím `←` `→` để lướt.

**Caption và nhạc.** Bấm **✨ Gemini viết caption** để có tiêu đề (tối đa 90 ký tự), caption, hashtag, gợi ý mood nhạc và từ khoá tìm nhạc. Có nút copy riêng cho tiêu đề và cho caption kèm hashtag. Trạng thái **Nháp / Đã duyệt / Đã đăng** hiện luôn ở danh sách truyện.

**Chuyển ảnh sang điện thoại.** Hai cách:

- **📱 Chia sẻ qua Wi-Fi**: hiện mã QR, quét bằng camera điện thoại cùng mạng Wi-Fi. Trang mở ra có ảnh theo thứ tự, nút tải ảnh, và nút copy tiêu đề, caption, gợi ý nhạc ngay trên điện thoại. Link tự tắt sau 30 phút.
- **Tải PNG tất cả ảnh** hoặc **Xuất PDF** về máy rồi tự chuyển.

**Các bước đăng:**

1. Lưu ảnh vào điện thoại theo đúng thứ tự 1, 2, 3…
2. TikTok → nút **+** → Tải lên → chọn ảnh theo đúng thứ tự đó.
3. Thêm âm thanh: tìm trong thư viện TikTok theo từ khoá mà Gemini gợi ý.
4. Dán tiêu đề và caption, rồi đăng.
5. Quay lại tool đánh dấu **Đã đăng**.

> **Vì sao phải đăng tay:** API của TikTok không cho chọn một bài nhạc cụ thể trong thư viện, và app chưa qua kiểm duyệt chỉ đăng được bài ở chế độ riêng tư. Đăng tay nhanh hơn và được chọn đúng nhạc đang trend.

Lần đầu bấm chia sẻ Wi-Fi, Windows sẽ hỏi quyền mạng cho Node.js. Chọn cho phép **Private networks**.

## Chi phí và model

Gần như toàn bộ chi phí nằm ở việc vẽ ảnh. Phần viết kịch bản, đặt lời thoại và viết caption cộng lại thường chưa tới 10 xu mỗi truyện.

| Model ảnh | Giá mỗi ảnh | Dùng khi |
| --- | --- | --- |
| Gemini 3.1 Flash Lite Image | ~$0.035 | Thử bố cục, thử prompt, làm nháp |
| Gemini 3.1 Flash Image | ~$0.070 | Mặc định, cân bằng giữa giá và chất lượng |
| Gemini 3 Pro Image | ~$0.146 | Ảnh bìa hoặc khung quan trọng |

Một truyện khoảng 20 khung, mỗi khung vẽ trung bình 2–3 lần mới ưng: Flash Lite khoảng $1.7, Flash khoảng $3.5, Pro khoảng $7.

Model viết kịch bản đặt riêng ở tab **Cài đặt**, mặc định `gemini-3.8-flash`. Danh sách gợi ý được lấy trực tiếp từ API key của bạn. Cách giảm tiền hiệu quả nhất không phải đổi model, mà là viết mô tả nhân vật thật kỹ để bớt số lần vẽ lại.

## Mẹo giữ nhân vật

- Ảnh tham chiếu nên chụp rõ mặt, đủ sáng, nền đơn giản, và cùng một phong cách vẽ với truyện.
- Giữ bật tuỳ chọn **Gửi kèm ảnh khung trước** ở bước 2: khung sau bám theo màu sắc và nét vẽ của khung trước.
- Mô tả nhân vật nên nói về đặc điểm không đổi (tóc, dáng người, trang phục thường ngày), còn cảm xúc và tư thế để phần biểu cảm và hành động của từng khung lo.
- Khung nào lệch nhân vật thì bấm **Tạo lại** riêng khung đó, lịch sử ảnh cũ vẫn được giữ để quay về.
- Muốn có đồng hồ hay mốc thời gian thì ghi thẳng vào bối cảnh hoặc prompt; tool không còn trường giờ riêng vì AI hay vẽ đồng hồ thừa.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| Lỗi 404 *"no longer available to new users"* | Model đời cũ đã bị Google khoá. Vào Cài đặt chọn model mới hơn, ví dụ `gemini-3.8-flash` |
| Lỗi 429, báo vượt quota | Kiểm tra thanh toán của API key, hoặc chờ vài phút rồi bấm vẽ tiếp phần còn thiếu |
| Gemini không trả về ảnh | Thường do prompt bị chặn. Sửa lại câu mô tả ở bước 2 rồi tạo lại khung đó |
| Điện thoại không mở được mã QR | Kiểm tra hai máy cùng Wi-Fi, cho phép Node.js qua tường lửa ở mạng Private, và thử địa chỉ khác trong danh sách (bỏ qua các adapter vEthernet, WSL) |
| Trình duyệt chặn khi tải nhiều PNG | Cho phép trang tải nhiều file, hoặc dùng Xuất PDF rồi tách ảnh sau |
| Chữ trong bóng thoại bị tràn | Kéo ô vuông bên phải để nới rộng bóng, hoặc giảm cỡ chữ ở thanh trượt cột phải |

## Dữ liệu và sao lưu

Mọi thứ nằm trong thư mục `data/` của dự án: `characters.json`, `projects/` (mỗi truyện một file JSON), `characters/` và `panels/` chứa ảnh, `settings.json` chứa API key. Thư mục này đã được gitignore.

- Sao lưu bằng cách copy nguyên thư mục `data/`.
- Xoá một truyện trong tool sẽ xoá luôn các ảnh đã vẽ của truyện đó.
- Không chia sẻ `settings.json` cho người khác vì có API key.

## Cấu trúc dự án

Node + Express ở backend, React (Vite) ở frontend, không cần Python.

```
server/
  index.js        API routes
  storage.js      đọc ghi file trong data/
  gemini.js       gọi Gemini: kịch bản, vẽ ảnh, đặt lời thoại, caption
  lan-share.js    trang chia sẻ qua Wi-Fi kèm mã QR
src/
  lib/            story-model, layouts, render-slide, bubbles, prompt-builder, export
  components/     các màn hình: nhân vật, kịch bản, prompt & ảnh, ghép, duyệt & đăng
  hooks/          autosave, pipeline tự động tạo truyện
docs/             hướng dẫn sử dụng
```

## Ủng hộ tác giả

Tool này miễn phí. Nếu nó giúp bạn tiết kiệm thời gian, bạn có thể mời mình một ly cà phê qua VietQR. Quét bằng app ngân hàng bất kỳ:

<img src="docs/images/donate-techcombank-qr.png" alt="Mã VietQR ủng hộ qua Techcombank" width="280" />

Cảm ơn bạn. Mọi ủng hộ đều được dùng để tiếp tục phát triển tool.

## Cộng đồng

Tham gia nhóm học AI **Cộng đồng AZ Builder** để trao đổi về cách dùng AI làm nội dung:

[facebook.com/groups/1078217401795712](https://web.facebook.com/groups/1078217401795712)
