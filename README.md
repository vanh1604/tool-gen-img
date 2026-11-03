# h2dev_flow — Bulk Image cho Google Flow

> **CÁCH HOẠT ĐỘNG (bản chính thức):** Tool dùng **chrome.debugger** để gõ chữ thật vào ô prompt của Flow (ô Slate.js chỉ nhận input thật). Vì vậy:
> 1. **Phải ĐÓNG DevTools (F12)** trên tab Flow khi chạy — DevTools chiếm mất kênh debugger.
> 2. Khi chạy, Chrome hiện thanh vàng **"h2dev_flow đang gỡ lỗi trình duyệt này"** — **để yên, đừng bấm Hủy**.
>
> Quy trình: dán prompt (mỗi dòng 1 cái) → Bắt đầu → tool tự gõ + Enter + chờ ảnh xong → tự tải về `Downloads/[thư mục]/` → prompt tiếp theo.

---


Extension Chrome (mã nguồn mở, miễn phí) giúp nạp hàng loạt prompt và **tự động sinh ảnh trên Google Flow**, rồi tự tải về máy. Đây là bản khung để bạn dùng và phát cho cộng đồng.

> ⚠️ **Lưu ý:** Extension điều khiển giao diện web của Google Flow (không dùng API). Nếu Google đổi giao diện, một vài chỗ có thể cần chỉnh lại (xem mục **Sửa khi hỏng**). Việc tự động hoá có thể trái Điều khoản của Google — dùng vừa phải, để delay hợp lý.

---

## 1. Cài đặt (chế độ nhà phát triển — miễn phí, không cần $5)

1. Tải cả thư mục này về máy, giải nén.
2. Mở Chrome, vào `chrome://extensions`.
3. Bật **Chế độ nhà phát triển** (góc trên bên phải).
4. Bấm **Tải tiện ích đã giải nén** → chọn thư mục `h2dev_flow`.
5. Icon ⚡ xuất hiện trên thanh công cụ. Xong.

> Mỗi khi sửa code, quay lại `chrome://extensions` bấm nút **tải lại** (↻) trên thẻ extension.

---

## 2. Cách dùng

1. Mở một project trên **Google Flow** (`labs.google/fx/tools/flow`).
2. Bấm icon ⚡ để mở **side panel** bên phải.
3. Đợi dòng trạng thái hiện **"Đã kết nối với Google Flow"** (xanh).
4. Dán prompt vào ô — **mỗi dòng một prompt** (hoặc bấm *Tải file .txt*).
5. Chọn thư mục lưu, bật/tắt đánh số, đặt thời gian nghỉ ngẫu nhiên.
6. Bấm **Bắt đầu**. Tool sẽ chạy lần lượt: gõ prompt → bấm tạo → đợi xong → tải ảnh → nghỉ → prompt tiếp theo.
7. Muốn ngừng giữa chừng thì bấm **Dừng**.

Ảnh tải về nằm trong: `Thư-mục-Downloads / [tên thư mục bạn đặt] / 001_prompt.png`

> Giữ side panel **mở** trong suốt quá trình chạy. Đóng panel là dừng hàng đợi.

---

## 3. Sửa khi hỏng (quan trọng nhất)

Vì tool bám vào giao diện Flow, khi Google cập nhật thì 2 thứ hay hỏng: **tìm ô prompt** và **tìm nút tạo**. Cách sửa:

1. Mở Google Flow, bấm **F12** (DevTools).
2. Bấm biểu tượng mũi tên chọn phần tử (góc trên trái DevTools), rồi click vào **ô nhập prompt** trên trang.
3. Chuột phải dòng HTML được tô sáng → **Copy → Copy selector**.
4. Mở file `content.js`, dán vào dòng:
   ```js
   promptSelector: "DÁN_VÀO_ĐÂY",
   ```
5. Làm tương tự với **nút tạo ảnh** → dán vào `generateSelector`.
6. Lưu file, vào `chrome://extensions` bấm tải lại extension.

Các tham số khác trong khối `CONFIG` ở đầu `content.js` bạn cũng có thể chỉnh:
- `submitWithEnter`: nếu Flow gửi bằng phím Enter thay vì nút bấm → đổi `true`.
- `maxWaitMs`: thời gian chờ tối đa cho mỗi ảnh (mặc định 4 phút).
- `minImageSize`: ngưỡng pixel để phân biệt ảnh kết quả với icon nhỏ.

> Mẹo: mở **Console** trong DevTools khi chạy để xem log `[Flow Batch]` báo nó tìm thấy gì.

---

## 4. Giới hạn đã biết (bản v1)

- **Ảnh blob:** Phần lớn ảnh Flow là link `https` tải thẳng được. Nếu ảnh ở dạng `blob:` mà bị chặn CORS, tải có thể lỗi — khi đó cần xử lý thêm.
- **Cách canh "xong":** Tool coi là xong khi có *ảnh mới xuất hiện*. Nếu bạn để sẵn nhiều ảnh cũ giống hệt, hoặc Flow load chậm, có thể nhầm. Tăng `settleMs`/`maxWaitMs` nếu cần.
- Chỉ chạy khi **một** tab Flow đang mở. Mở nhiều tab Flow thì nó lấy tab đầu tiên.

---

## 5. Đổi thương hiệu (rebrand cho cộng đồng bạn)

- Đổi tên + mô tả trong `manifest.json` (`name`, `description`).
- Thay 3 file icon trong thư mục `icons/`.
- Đổi tiêu đề "h2dev_flow" trong `sidepanel.html` và màu trong `sidepanel.css` (sửa biến `--accent`).

---

## 6. Phát hành cho cộng đồng

**Cách miễn phí 100%:** Nén thư mục thành `.zip` hoặc đẩy lên **GitHub**, ae tự "Tải tiện ích đã giải nén" như mục 1. Nhược điểm: không tự cập nhật, có cảnh báo chế độ dev.

**Lên Chrome Web Store (gọn hơn, tự cập nhật):** Trả **$5 một lần** đăng ký tài khoản nhà phát triển tại `chrome.google.com/webstore/devconsole`, rồi tải file `.zip` lên. Không phí theo người dùng. Lưu ý: extension tự động hoá Google Labs đôi khi bị kiểm duyệt/gỡ — chuẩn bị phương án dự phòng qua GitHub.

---

## Cấu trúc file

```
h2dev_flow/
├── manifest.json      # khai báo extension
├── background.js      # mở side panel khi bấm icon
├── content.js         # CON BOT: điều khiển trang Flow  ← sửa ở đây khi hỏng
├── sidepanel.html     # giao diện
├── sidepanel.css      # màu sắc
├── sidepanel.js       # điều phối hàng đợi + tải ảnh
└── icons/             # icon 16/48/128
```
