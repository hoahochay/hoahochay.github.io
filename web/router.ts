/**
 * Đường dẫn trong app (hash), để gửi link thẳng tới một thí nghiệm hay một nguyên tố:
 *   #/                     phòng thí nghiệm
 *   #/thi-nghiem           phòng thí nghiệm, mở danh sách thí nghiệm mẫu
 *   #/thi-nghiem/<id>      chạy thí nghiệm mẫu <id>
 *   #/chia-se/<dữ liệu>    chạy lại thí nghiệm tự làm được chia sẻ (dữ liệu nằm ngay trong link)
 *   #/bang-tuan-hoan       bảng tuần hoàn
 *   #/bang-tuan-hoan/<Kí hiệu>  bảng tuần hoàn, mở thẻ nguyên tố
 * Dùng hash nên chạy được trên mọi máy chủ tĩnh (GitHub Pages…) mà không cần cấu hình.
 */

export type Route =
  | { view: 'lab'; tab: 'chem' | 'recipes'; recipe?: string; shared?: string }
  | { view: 'table'; element?: string };

/** Link gõ sai (vd. dấu % lẻ) không được làm hỏng cả ứng dụng */
function safeDecode(x: string): string {
  try { return decodeURIComponent(x); } catch { return x; }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(safeDecode);
  if (parts[0] === 'bang-tuan-hoan') return { view: 'table', element: parts[1] };
  if (parts[0] === 'chia-se' && parts[1]) return { view: 'lab', tab: 'recipes', shared: parts[1] };
  if (parts[0] === 'thi-nghiem') return { view: 'lab', tab: 'recipes', recipe: parts[1] };
  return { view: 'lab', tab: 'chem' };
}

export function routeHash(r: Route): string {
  if (r.view === 'table') return r.element ? `#/bang-tuan-hoan/${encodeURIComponent(r.element)}` : '#/bang-tuan-hoan';
  if (r.shared) return `#/chia-se/${r.shared}`;
  if (r.recipe) return `#/thi-nghiem/${encodeURIComponent(r.recipe)}`;
  return r.tab === 'recipes' ? '#/thi-nghiem' : '#/';
}

/** Cập nhật thanh địa chỉ mà không tạo thêm mục trong lịch sử và không phát sự kiện hashchange */
export function setRoute(r: Route): void {
  const h = routeHash(r);
  if (location.hash !== h && !(h === '#/' && location.hash === '')) history.replaceState(null, '', h);
}

/** Link đầy đủ để chia sẻ */
export function shareUrl(r: Route): string {
  return location.origin + location.pathname + routeHash(r);
}

/** Sao chép vào bộ nhớ tạm; trả về false nếu trình duyệt không cho */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch { /* bỏ qua */ }
    ta.remove();
    return ok;
  }
}
