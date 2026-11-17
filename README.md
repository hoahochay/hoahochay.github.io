# Chemistry Engine: phòng thí nghiệm hóa học ảo

Prototype bộ mô phỏng hóa học (TypeScript thuần, không phụ thuộc 3D) cho phòng thí nghiệm ảo
dành cho học sinh THCS/THPT. Engine tính **trạng thái hóa học** của từng dụng cụ theo thời gian;
lớp hiển thị (Three.js) chỉ cần đọc `vessel.observe()` để vẽ màu, kết tủa, bọt khí, hơi nước.

```bash
npm install
npm test          # 39 test: pH, chuẩn độ, Ksp, động học, bảo toàn, nhiệt
npm run demo      # diễn biến 8 thí nghiệm SGK, có ô màu trong terminal
npm run typecheck
```

## Ví dụ

```ts
import { Vessel, VESSELS, gramsToMol, indicatorDrops } from './src';

const coc = new Vessel(VESSELS.beaker100);
coc.addSolution({ HCl: 1 }, 0.01)                         // 10 mL HCl 1M
   .add(indicatorDrops('methyl orange'))                  // 2 giọt metyl da cam
   .addSolid('Mg', gramsToMol('Mg', 0.05), 'strip');      // 0,05 g dải Mg

coc.run(30, { every: 1, onTick: (o) => render(o) });       // gọi mỗi giây

// o.appearance   màu nhìn thấy (RGB 0..1)     o.turbidity  độ đục
// o.tempC, o.pH, o.volumeML                    o.solids     chất rắn, lượng lơ lửng/lắng
// o.gasRateML    tốc độ thoát khí → số bọt     o.boiling    đang sôi
```

Trong game loop thật, gọi `vessel.step(dt)` mỗi frame (hoặc theo bước cố định 0,05 s).

## Kiến trúc

Mỗi bước thời gian, `Vessel.step(dt)` thực hiện:

1. **Động học** (`kinetics.ts`, `reactions.ts`): phản ứng chậm có tốc độ
   `r = k(T)·(S hoặc V)·Π[C]ⁿ` với `k(T)` tính theo Arrhenius. Phản ứng dị thể (kim loại + axit)
   có tốc độ tỉ lệ với diện tích bề mặt `S = hệ số hình dạng × n^(2/3)`, nên bột phản ứng nhanh hơn
   dải và chất rắn nhỏ dần thì phản ứng chậm dần.
2. **Hòa tan** chất ít tan khi `Q < Ksp` (cần thời gian; nhanh hơn trong axit).
3. **Cân bằng nhanh** (`equilibrium.ts`):
   - Tìm `[H+]` bằng chia đôi trên **phương trình trung hòa điện**. H⁺ và OH⁻ không phải dữ liệu đầu vào
     mà được *suy ra*, nên mọi phản ứng tiêu thụ/sinh axit đều tự làm pH thay đổi đúng.
   - Hệ axit–bazơ (axetat, cacbonat, amoni, sunfat, thủy phân Fe³⁺/Cu²⁺) phân bố theo pKa.
   - Kết tủa: nếu `Q > Ksp` thì kết tủa phần dư cho đến khi `Q = Ksp`.
4. **Bảo toàn nguyên tố H** → suy ra lượng nước sinh ra/mất đi (vd. trung hòa, Na + H₂O).
5. **Định luật Hess**: nhiệt tỏa ra = `ΣnΔfH°(trước) − ΣnΔfH°(sau)` → nhiệt độ thay đổi.
   Không phải ghi tay nhiệt của từng phản ứng.
6. Khí (H₂, O₂, CO₂) thoát ra; đun nóng; tỏa nhiệt ra môi trường; sôi thì nước bay hơi;
   kết tủa lắng dần (khuấy bằng `stir()`).

**Nhiệt độ ảnh hưởng tới mọi thứ một cách tự động**: Kw, Ka, Ksp đổi theo van 't Hoff
(ΔH tính từ ΔfH°), tốc độ đổi theo Arrhenius. Vì vậy thí nghiệm "mưa vàng" PbI₂
(tan khi nóng, kết tinh khi nguội) xảy ra mà không cần viết code riêng.

**Pha khí** (`gas.ts`, `gasTests.ts`): mỗi dụng cụ có khoảng khí phía trên mặt chất lỏng. Bọt khí
đẩy không khí ra khỏi ống; khí thoát dần qua miệng (khí nhẹ như H₂, NH₃ thoát nhanh, CO₂ nặng
đọng lại lâu). CO₂ và NH₃ trao đổi với dung dịch theo định luật Henry. Phép thử que đóm và giấy quỳ ẩm
được suy ra từ thành phần khoảng khí: quỳ ẩm được tính như một lớp nước mỏng cân bằng với khí.
Ống dẫn khí (`vessel.outlet`) nút kín dụng cụ phát khí: khí bị đẩy sang dụng cụ nhận (lúc đầu là không khí).
Sục qua dung dịch thì khí tan (CO₂, NH₃) bị hấp thụ một phần, nên CO₂ làm nước vôi trong vẩn đục rồi trong lại.
Ống úp ngược (`vessel.inverted`) giữ khí nhẹ (H₂) và để khí nặng (CO₂) rơi ra.

**Màu** (`optics.ts`): định luật Beer–Lambert theo 3 kênh R/G/B. Màu đậm hay nhạt phụ thuộc
nồng độ và độ dày lớp chất lỏng; chất chỉ thị đổi màu theo pH.

| File | Nội dung |
|---|---|
| `species.ts` | Dữ liệu chất: điện tích, số H, ΔfH°, khối lượng mol, màu |
| `systems.ts` | Hệ axit–bazơ (pKa), chất ít tan (Ksp, tốc độ hòa tan) |
| `reactions.ts` | Cơ sở dữ liệu phản ứng chậm |
| `reagents.ts` | Hóa chất pha dung dịch, chất chỉ thị |
| `mixture.ts` | Trạng thái hỗn hợp |
| `vessel.ts` | Dụng cụ chứa, vòng lặp mô phỏng, `observe()` |

## Thêm phản ứng mới

```ts
// reactions.ts
{
  id: 'al_acid', name: 'Nhôm tác dụng với axit',
  equation: '2Al + 6H⁺ → 2Al³⁺ + 3H₂↑',
  reactants: { Al: 1, 'H+': 3 }, products: { 'Al^3+': 1, H2: 1.5 },
  rate: massAction({ k25: 1e-6, Ea: 50000, orders: { 'H+': 1 }, surface: 'Al' }),
}
```
Rồi khai báo `Al`, `Al^3+` trong `species.ts`, kèm ΔfH° và số nguyên tử H. Nhiệt, pH và
lượng nước sẽ được tính tự động. Hằng số `k25` nên hiệu chỉnh sao cho thời gian phản ứng
khớp với video thí nghiệm thật.

## Giới hạn hiện tại (cần biết khi dùng)

- **Dung dịch lý tưởng**: chưa có hệ số hoạt độ, nên kém chính xác khi nồng độ > ~0,5M.
  pKa thủy phân của Cu²⁺ là **giá trị hiệu dụng** (6,0) để bù cho điều này (xem `systems.ts`).
- Hằng số tốc độ được **hiệu chỉnh theo thời gian quan sát**, không phải số đo động học chuẩn.
- ΔfH° của CuOH⁺ là giá trị ước lượng.
- Nước vôi trong trong kho là loại pha loãng (0,005M): với mô hình lý tưởng, nước vôi bão hòa (0,02M) không trong lại hoàn toàn khi sục CO₂ dư.
- CO₂ của không khí không hòa tan vào dung dịch (nước cất có pH 7, thực tế ≈ 5,6); chỉ dùng khi tính màu quỳ ẩm.
- Hỗn hợp được coi là luôn khuấy đều (chưa có khuếch tán theo vùng).
- Chưa có: phức chất (Al(OH)₄⁻, [Cu(NH₃)₄]²⁺, [Ag(NH₃)₂]⁺), oxi hóa–khử trong dung dịch
  (KMnO₄, Fe²⁺ → Fe³⁺ do không khí), khí tan lại, phản ứng cháy, chất hữu cơ.
- Hỗn hợp chưa có trong cơ sở dữ liệu thì **không xảy ra phản ứng**. Engine không tự bịa phản ứng.

## Hướng phát triển tiếp

1. Hệ số hoạt độ (phương trình Davies) và phức chất.
2. Mở rộng cơ sở dữ liệu theo chương trình GDPT 2018 (lớp 8–12); nhờ giáo viên kiểm duyệt.
3. Khuếch tán theo vùng (giọt chỉ thị loang ra, khuấy để trộn đều).
4. Nối với Three.js: `observe()` → màu vật liệu chất lỏng, particle bọt khí/kết tủa, hơi nước.
