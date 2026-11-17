/**
 * Dữ liệu 118 nguyên tố hóa học.
 * Khối lượng nguyên tử: IUPAC (làm tròn); [..] là số khối của đồng vị bền nhất với nguyên tố phóng xạ.
 * Độ âm điện: thang Pauling. Nhiệt độ nóng chảy: °C ở 1 atm.
 * Vị trí (chu kỳ, nhóm), cấu hình electron và số electron từng lớp được suy ra từ Z.
 */

export type Category =
  | 'alkali' | 'alkaline' | 'transition' | 'post' | 'metalloid'
  | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide';

export type State = 's' | 'l' | 'g' | '';

export interface Element {
  z: number;
  symbol: string;
  /** Tên tiếng Việt quen dùng */
  name: string;
  /** Tên theo IUPAC */
  iupac: string;
  /** Tên hiển thị theo SGK: tiếng Việt với các nguyên tố quen thuộc, còn lại theo IUPAC */
  display: string;
  /** Khối lượng nguyên tử; `massIsotope` = true nếu là số khối đồng vị bền nhất */
  mass: number;
  massIsotope: boolean;
  electronegativity: number | null;
  state: State;
  meltC: number | null;
  /** Năm phát hiện; 0 = từ thời cổ đại */
  year: number | null;
  oxidation: string;
  period: number;
  /** Nhóm 1–18; null với họ Lantan / Actini (hàng f) */
  group: number | null;
  category: Category;
  /** Ô hiển thị trên lưới 18 cột (hàng 8, 9 là họ Lantan, Actini) */
  row: number;
  col: number;
  config: string;
  shells: number[];
  /** Nguyên tố nhân tạo (hầu như không có trong tự nhiên) */
  synthetic: boolean;
  about?: string;
}

// z | kí hiệu | tên | IUPAC | khối lượng | độ âm điện | trạng thái | t°nc | năm | số oxi hóa
const RAW = `
1|H|Hiđro|Hydrogen|1.008|2.20|g|-259.1|1766|-1, +1
2|He|Heli|Helium|4.0026||g||1895|
3|Li|Liti|Lithium|6.94|0.98|s|180.5|1817|+1
4|Be|Beri|Beryllium|9.0122|1.57|s|1287|1798|+2
5|B|Bo|Boron|10.81|2.04|s|2076|1808|+3
6|C|Cacbon|Carbon|12.011|2.55|s|3550|0|-4, +2, +4
7|N|Nitơ|Nitrogen|14.007|3.04|g|-210.0|1772|-3, +2, +3, +4, +5
8|O|Oxi|Oxygen|15.999|3.44|g|-218.8|1774|-2
9|F|Flo|Fluorine|18.998|3.98|g|-219.7|1886|-1
10|Ne|Neon|Neon|20.180||g|-248.6|1898|
11|Na|Natri|Sodium|22.990|0.93|s|97.8|1807|+1
12|Mg|Magie|Magnesium|24.305|1.31|s|650|1755|+2
13|Al|Nhôm|Aluminium|26.982|1.61|s|660.3|1825|+3
14|Si|Silic|Silicon|28.085|1.90|s|1414|1824|-4, +4
15|P|Photpho|Phosphorus|30.974|2.19|s|44.2|1669|-3, +3, +5
16|S|Lưu huỳnh|Sulfur|32.06|2.58|s|115.2|0|-2, +4, +6
17|Cl|Clo|Chlorine|35.45|3.16|g|-101.5|1774|-1, +1, +3, +5, +7
18|Ar|Agon|Argon|39.95||g|-189.3|1894|
19|K|Kali|Potassium|39.098|0.82|s|63.5|1807|+1
20|Ca|Canxi|Calcium|40.078|1.00|s|842|1808|+2
21|Sc|Scanđi|Scandium|44.956|1.36|s|1541|1879|+3
22|Ti|Titan|Titanium|47.867|1.54|s|1668|1791|+2, +3, +4
23|V|Vanađi|Vanadium|50.942|1.63|s|1910|1801|+2, +3, +4, +5
24|Cr|Crom|Chromium|51.996|1.66|s|1907|1797|+2, +3, +6
25|Mn|Mangan|Manganese|54.938|1.55|s|1246|1774|+2, +4, +6, +7
26|Fe|Sắt|Iron|55.845|1.83|s|1538|0|+2, +3
27|Co|Coban|Cobalt|58.933|1.88|s|1495|1735|+2, +3
28|Ni|Niken|Nickel|58.693|1.91|s|1455|1751|+2
29|Cu|Đồng|Copper|63.546|1.90|s|1084.6|0|+1, +2
30|Zn|Kẽm|Zinc|65.38|1.65|s|419.5|1746|+2
31|Ga|Gali|Gallium|69.723|1.81|s|29.8|1875|+3
32|Ge|Gecmani|Germanium|72.630|2.01|s|938.3|1886|+2, +4
33|As|Asen|Arsenic|74.922|2.18|s|817|1250|-3, +3, +5
34|Se|Selen|Selenium|78.971|2.55|s|221|1817|-2, +4, +6
35|Br|Brom|Bromine|79.904|2.96|l|-7.2|1826|-1, +1, +5
36|Kr|Kripton|Krypton|83.798|3.00|g|-157.4|1898|+2
37|Rb|Rubiđi|Rubidium|85.468|0.82|s|39.3|1861|+1
38|Sr|Stronti|Strontium|87.62|0.95|s|777|1790|+2
39|Y|Ytri|Yttrium|88.906|1.22|s|1526|1794|+3
40|Zr|Zirconi|Zirconium|91.224|1.33|s|1855|1789|+4
41|Nb|Niobi|Niobium|92.906|1.6|s|2477|1801|+3, +5
42|Mo|Molipđen|Molybdenum|95.95|2.16|s|2623|1778|+4, +6
43|Tc|Tecneti|Technetium|98|1.9|s|2157|1937|+4, +7
44|Ru|Ruteni|Ruthenium|101.07|2.2|s|2334|1844|+3, +4
45|Rh|Rođi|Rhodium|102.91|2.28|s|1964|1804|+3
46|Pd|Palađi|Palladium|106.42|2.20|s|1554.9|1803|+2, +4
47|Ag|Bạc|Silver|107.87|1.93|s|961.8|0|+1
48|Cd|Cađimi|Cadmium|112.41|1.69|s|321.1|1817|+2
49|In|Inđi|Indium|114.82|1.78|s|156.6|1863|+3
50|Sn|Thiếc|Tin|118.71|1.96|s|231.9|0|+2, +4
51|Sb|Antimon|Antimony|121.76|2.05|s|630.6|0|-3, +3, +5
52|Te|Telu|Tellurium|127.60|2.1|s|449.5|1782|-2, +4, +6
53|I|Iot|Iodine|126.90|2.66|s|113.7|1811|-1, +1, +5, +7
54|Xe|Xenon|Xenon|131.29|2.6|g|-111.8|1898|+2, +4, +6
55|Cs|Xesi|Caesium|132.91|0.79|s|28.4|1860|+1
56|Ba|Bari|Barium|137.33|0.89|s|727|1808|+2
57|La|Lantan|Lanthanum|138.91|1.10|s|920|1839|+3
58|Ce|Xeri|Cerium|140.12|1.12|s|795|1803|+3, +4
59|Pr|Prazeođim|Praseodymium|140.91|1.13|s|935|1885|+3
60|Nd|Neođim|Neodymium|144.24|1.14|s|1024|1885|+3
61|Pm|Prometi|Promethium|145|1.13|s|1042|1945|+3
62|Sm|Samari|Samarium|150.36|1.17|s|1072|1879|+2, +3
63|Eu|Europi|Europium|151.96|1.2|s|826|1901|+2, +3
64|Gd|Gađolini|Gadolinium|157.25|1.20|s|1312|1880|+3
65|Tb|Tecbi|Terbium|158.93|1.2|s|1356|1843|+3
66|Dy|Đysprosi|Dysprosium|162.50|1.22|s|1407|1886|+3
67|Ho|Honmi|Holmium|164.93|1.23|s|1461|1878|+3
68|Er|Ecbi|Erbium|167.26|1.24|s|1529|1843|+3
69|Tm|Tuli|Thulium|168.93|1.25|s|1545|1879|+3
70|Yb|Ytecbi|Ytterbium|173.05|1.1|s|824|1878|+2, +3
71|Lu|Lutexi|Lutetium|174.97|1.27|s|1652|1907|+3
72|Hf|Hafni|Hafnium|178.49|1.3|s|2233|1923|+4
73|Ta|Tantan|Tantalum|180.95|1.5|s|3017|1802|+5
74|W|Vonfram|Tungsten|183.84|2.36|s|3422|1783|+4, +6
75|Re|Reni|Rhenium|186.21|1.9|s|3186|1925|+4, +7
76|Os|Osimi|Osmium|190.23|2.2|s|3033|1803|+4, +8
77|Ir|Iriđi|Iridium|192.22|2.20|s|2446|1803|+3, +4
78|Pt|Platin|Platinum|195.08|2.28|s|1768.3|1735|+2, +4
79|Au|Vàng|Gold|196.97|2.54|s|1064.2|0|+1, +3
80|Hg|Thủy ngân|Mercury|200.59|2.00|l|-38.8|0|+1, +2
81|Tl|Tali|Thallium|204.38|1.62|s|304|1861|+1, +3
82|Pb|Chì|Lead|207.2|2.33|s|327.5|0|+2, +4
83|Bi|Bitmut|Bismuth|208.98|2.02|s|271.4|1753|+3
84|Po|Poloni|Polonium|209|2.0|s|254|1898|+2, +4
85|At|Atatin|Astatine|210|2.2|s|302|1940|-1
86|Rn|Rađon|Radon|222|2.2|g|-71|1899|
87|Fr|Franxi|Francium|223|0.7|s|27|1939|+1
88|Ra|Rađi|Radium|226|0.9|s|700|1898|+2
89|Ac|Actini|Actinium|227|1.1|s|1050|1899|+3
90|Th|Thori|Thorium|232.04|1.3|s|1750|1829|+4
91|Pa|Protactini|Protactinium|231.04|1.5|s|1568|1913|+5
92|U|Urani|Uranium|238.03|1.38|s|1132.2|1789|+3, +4, +5, +6
93|Np|Neptuni|Neptunium|237|1.36|s|639|1940|+5
94|Pu|Plutoni|Plutonium|244|1.28|s|639.4|1940|+4
95|Am|Americi|Americium|243|1.13|s|1176|1944|+3
96|Cm|Curi|Curium|247|1.28|s|1340|1944|+3
97|Bk|Beckeli|Berkelium|247|1.3|s|986|1949|+3
98|Cf|Californi|Californium|251|1.3|s|900|1950|+3
99|Es|Einsteini|Einsteinium|252|1.3|s|860|1952|+3
100|Fm|Fecmi|Fermium|257|1.3|||1952|+3
101|Md|Menđelevi|Mendelevium|258|1.3|||1955|+3
102|No|Nobeli|Nobelium|259|1.3|||1958|+2
103|Lr|Lorenxi|Lawrencium|266|1.3|||1961|+3
104|Rf|Rutherfordi|Rutherfordium|267||||1964|
105|Db|Đubni|Dubnium|268||||1968|
106|Sg|Seaborgi|Seaborgium|269||||1974|
107|Bh|Bohri|Bohrium|270||||1981|
108|Hs|Hassi|Hassium|269||||1984|
109|Mt|Meitneri|Meitnerium|278||||1982|
110|Ds|Đamstađti|Darmstadtium|281||||1994|
111|Rg|Roentgeni|Roentgenium|282||||1994|
112|Cn|Copernixi|Copernicium|285||||1996|
113|Nh|Nihoni|Nihonium|286||||2004|
114|Fl|Flerovi|Flerovium|289||||1999|
115|Mc|Moscovi|Moscovium|290||||2003|
116|Lv|Livermori|Livermorium|293||||2000|
117|Ts|Tennessine|Tennessine|294||||2010|
118|Og|Oganesson|Oganesson|294||||2002|
`;

/** Mô tả ngắn cho các nguyên tố thường gặp trong chương trình */
const ABOUT: Record<string, string> = {
  H: 'Nguyên tố nhẹ nhất và phổ biến nhất trong vũ trụ. Khí H₂ cháy tạo ra nước, được nghiên cứu làm nhiên liệu sạch.',
  He: 'Khí hiếm rất nhẹ, không cháy: dùng bơm bóng bay, khinh khí cầu; heli lỏng làm lạnh nam châm siêu dẫn (máy chụp MRI).',
  Li: 'Kim loại nhẹ nhất. Có trong pin sạc của điện thoại, máy tính xách tay và xe điện (pin lithium-ion).',
  C: 'Tạo nên mọi hợp chất hữu cơ và cơ thể sống. Dạng thù hình: kim cương, than chì (ruột bút chì), than đá.',
  N: 'Chiếm khoảng 78% thể tích không khí. Dùng sản xuất phân đạm, ammonia; nitrogen lỏng dùng bảo quản mẫu sinh học.',
  O: 'Chiếm khoảng 21% thể tích không khí, cần cho sự hô hấp và sự cháy. Nguyên tố phổ biến nhất trong vỏ Trái Đất.',
  F: 'Phi kim mạnh nhất, có độ âm điện lớn nhất. Hợp chất của fluorine có trong kem đánh răng (chống sâu răng) và chất chống dính.',
  Ne: 'Khí hiếm phát ánh sáng đỏ cam khi có dòng điện đi qua: dùng làm đèn quảng cáo (đèn neon).',
  Na: 'Kim loại kiềm mềm, cắt được bằng dao, phản ứng mạnh với nước nên được ngâm trong dầu hỏa. Muối ăn là NaCl.',
  Mg: 'Kim loại nhẹ, cháy với ánh sáng trắng chói (pháo hoa, pháo sáng). Hợp kim magnesium dùng làm vỏ máy bay, xe đạp.',
  Al: 'Kim loại phổ biến nhất trong vỏ Trái Đất. Nhẹ, dẫn điện tốt, bền nhờ lớp oxide bảo vệ: làm dây điện, vỏ lon, khung cửa.',
  Si: 'Nguyên tố phổ biến thứ hai trong vỏ Trái Đất (cát là SiO₂). Chất bán dẫn làm chip máy tính và pin mặt trời.',
  P: 'Có trong xương, răng và ADN. Dùng sản xuất phân lân, đầu que diêm (phosphorus đỏ).',
  S: 'Chất rắn màu vàng. Dùng sản xuất sulfuric acid (H₂SO₄), lưu hóa cao su, làm thuốc súng và diêm.',
  Cl: 'Khí màu vàng lục, rất độc. Dùng khử trùng nước máy, nước bể bơi; sản xuất nhựa PVC và chất tẩy rửa.',
  Ar: 'Khí hiếm chiếm gần 1% không khí. Bơm vào bóng đèn sợi đốt và dùng làm khí bảo vệ khi hàn kim loại.',
  K: 'Kim loại kiềm phản ứng với nước còn mạnh hơn sodium. Ion K⁺ cần cho cây trồng (phân potassium) và hoạt động của tế bào thần kinh.',
  Ca: 'Có trong xương, răng, vỏ sò, đá vôi (CaCO₃) và vôi (CaO). Nước có nhiều ion Ca²⁺ là nước cứng.',
  Cr: 'Kim loại rất cứng, sáng bóng. Dùng mạ chống gỉ và chế tạo thép không gỉ (inox).',
  Mn: 'Thành phần quan trọng của thép. Hợp chất KMnO₄ (thuốc tím) dùng sát trùng.',
  Fe: 'Kim loại được dùng nhiều nhất. Gang và thép là hợp kim của sắt với carbon. Có trong hemoglobin của máu.',
  Cu: 'Kim loại màu đỏ, dẫn điện rất tốt: làm dây điện. Hợp kim đồng thau (Cu–Zn), đồng thiếc dùng đúc tượng, trống đồng.',
  Zn: 'Dùng mạ lên sắt để chống gỉ (tôn kẽm), làm vỏ pin. Là vi chất cần thiết cho cơ thể.',
  Br: 'Một trong hai nguyên tố ở thể lỏng ở nhiệt độ phòng (cùng thủy ngân). Chất lỏng màu nâu đỏ, dễ bay hơi, độc.',
  Ag: 'Kim loại dẫn điện tốt nhất. Làm đồ trang sức, tráng gương; ion Ag⁺ có tính diệt khuẩn.',
  Sn: 'Kim loại mềm, không gỉ: mạ lên sắt làm sắt tây (vỏ hộp), làm thiếc hàn mạch điện.',
  I: 'Chất rắn màu tím đen, thăng hoa khi đun. Cần cho tuyến giáp: muối i-ốt phòng bệnh bướu cổ; cồn i-ốt sát trùng vết thương.',
  Ba: 'Kim loại kiềm thổ. BaSO₄ không tan, dùng làm "thuốc cản quang" khi chụp X-quang dạ dày.',
  W: 'Kim loại có nhiệt độ nóng chảy cao nhất (3422 °C): làm dây tóc bóng đèn sợi đốt.',
  Pt: 'Kim loại quý rất bền, không bị gỉ. Dùng làm trang sức và chất xúc tác trong bộ lọc khí thải ô tô.',
  Au: 'Kim loại quý màu vàng, dẻo nhất: 1 g vàng dát mỏng được tấm rộng khoảng 1 m². Không bị oxi hóa trong không khí.',
  Hg: 'Kim loại duy nhất ở thể lỏng ở nhiệt độ phòng. Hơi thủy ngân rất độc; nhiệt kế thủy ngân khi vỡ cần thu gom bằng bột lưu huỳnh.',
  Pb: 'Kim loại nặng, mềm, độc. Dùng làm ắc quy, tấm chắn tia phóng xạ.',
  U: 'Nguyên tố phóng xạ. Urani-235 là nhiên liệu cho nhà máy điện hạt nhân.',
};

const SYNTHETIC = new Set([43, 61]);

// ── Suy ra vị trí và cấu hình electron từ Z ──────────────────────────────
const PERIOD_START = [1, 3, 11, 19, 37, 55, 87, 119];
const NOBLE = [2, 10, 18, 36, 54, 86, 118];
const NOBLE_SYMBOL: Record<number, string> = { 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' };

function position(z: number): { period: number; group: number | null; row: number; col: number } {
  const period = PERIOD_START.findIndex((s, i) => z >= s && z < PERIOD_START[i + 1]) + 1;
  const k = z - PERIOD_START[period - 1]; // vị trí trong chu kỳ, từ 0
  let group: number | null;
  if (period === 1) group = z === 1 ? 1 : 18;
  else if (period <= 3) group = k < 2 ? k + 1 : k + 11;
  else if (period <= 5) group = k + 1;
  else if (k < 2) group = k + 1;
  else if (k < 17) group = null; // La–Lu, Ac–Lr
  else group = k - 13;
  if (group !== null) return { period, group, row: period, col: group };
  return { period, group, row: period === 6 ? 9 : 10, col: k + 1 };
}

// Thứ tự điền electron theo quy tắc Klechkowski (n + l, rồi n)
const L_NAME = 'spdf';
const ORDER: [number, number][] = [];
for (let s = 1; s <= 8; s++) for (let n = Math.ceil((s + 1) / 2); n <= s; n++) {
  const l = s - n;
  if (l < 4 && n <= 7) ORDER.push([n, l]);
}

/** Ngoại lệ (cấu hình thực nghiệm khác quy tắc): phân lớp → số electron */
const EXCEPTIONS: Record<number, Record<string, number>> = {
  24: { '4s': 1, '3d': 5 }, 29: { '4s': 1, '3d': 10 },
  41: { '5s': 1, '4d': 4 }, 42: { '5s': 1, '4d': 5 }, 44: { '5s': 1, '4d': 7 }, 45: { '5s': 1, '4d': 8 },
  46: { '5s': 0, '4d': 10 }, 47: { '5s': 1, '4d': 10 },
  57: { '4f': 0, '5d': 1 }, 58: { '4f': 1, '5d': 1 }, 64: { '4f': 7, '5d': 1 },
  78: { '6s': 1, '5d': 9 }, 79: { '6s': 1, '5d': 10 },
  89: { '5f': 0, '6d': 1 }, 90: { '5f': 0, '6d': 2 }, 91: { '5f': 2, '6d': 1 }, 92: { '5f': 3, '6d': 1 },
  93: { '5f': 4, '6d': 1 }, 96: { '5f': 7, '6d': 1 }, 103: { '6d': 0, '7p': 1 },
};

function subshells(z: number): Map<string, number> {
  const m = new Map<string, number>();
  let left = z;
  for (const [n, l] of ORDER) {
    if (left <= 0) break;
    const c = Math.min(left, 4 * l + 2);
    m.set(`${n}${L_NAME[l]}`, c);
    left -= c;
  }
  for (const [k, v] of Object.entries(EXCEPTIONS[z] ?? {})) m.set(k, v);
  return m;
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => String(n).split('').map((d) => SUP[+d]).join('');
const sortKey = (k: string) => Number(k[0]) * 10 + L_NAME.indexOf(k[1]);

function configuration(z: number): { config: string; shells: number[] } {
  const full = subshells(z);
  const shells: number[] = [];
  for (const [k, c] of full) shells[Number(k[0]) - 1] = (shells[Number(k[0]) - 1] ?? 0) + c;
  const core = [...NOBLE].reverse().find((g) => g < z);
  const coreSet = core ? subshells(core) : new Map<string, number>();
  const parts = [...full]
    .filter(([k, c]) => c > 0 && coreSet.get(k) !== c)
    .sort((a, b) => sortKey(a[0]) - sortKey(b[0]))
    .map(([k, c]) => `${k}${sup(c)}`);
  const prefix = core && NOBLE_SYMBOL[core] ? `[${NOBLE_SYMBOL[core]}] ` : '';
  return { config: prefix + parts.join(' '), shells: shells.map((x) => x ?? 0) };
}

function category(z: number, group: number | null, period: number): Category {
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if (z === 1) return 'nonmetal';
  if (group === 1) return 'alkali';
  if (group === 2) return 'alkaline';
  if (group === 18) return 'noble';
  if (group === 17) return 'halogen';
  if (group !== null && group >= 3 && group <= 12) return 'transition';
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
  if ([6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  void period;
  return 'post';
}

/** Các nguyên tố SGK (chương trình 2018) giữ tên tiếng Việt */
const SGK_VIETNAMESE = new Set(['Au', 'Ag', 'Cu', 'Pb', 'Fe', 'Al', 'Zn', 'S', 'Sn', 'Hg']);

export const ELEMENTS: Element[] = RAW.trim().split('\n').map((line) => {
  const [z, symbol, name, iupac, mass, en, state, mp, year, ox] = line.split('|');
  const Z = Number(z);
  const pos = position(Z);
  return {
    z: Z, symbol, name, iupac, display: SGK_VIETNAMESE.has(symbol) ? name : iupac,
    mass: Number(mass),
    massIsotope: Z >= 84 && ![90, 91, 92].includes(Z) || Z === 43 || Z === 61,
    electronegativity: en ? Number(en) : null,
    state: state as State,
    meltC: mp ? Number(mp) : null,
    year: year === '' ? null : Number(year),
    oxidation: ox ?? '',
    ...pos,
    category: category(Z, pos.group, pos.period),
    ...configuration(Z),
    synthetic: SYNTHETIC.has(Z) || Z >= 93,
    about: ABOUT[symbol],
  };
});

export const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export const CATEGORY_INFO: Record<Category, { name: string; color: string }> = {
  alkali: { name: 'Kim loại kiềm', color: '#ff9b85' },
  alkaline: { name: 'Kim loại kiềm thổ', color: '#ffcf7a' },
  transition: { name: 'Kim loại chuyển tiếp', color: '#f5b3c8' },
  post: { name: 'Kim loại khác', color: '#b9d3e8' },
  metalloid: { name: 'Á kim', color: '#b7dfb2' },
  nonmetal: { name: 'Phi kim', color: '#8fd6c3' },
  halogen: { name: 'Halogen', color: '#f1e37a' },
  noble: { name: 'Khí hiếm', color: '#c9b8f0' },
  lanthanide: { name: 'Họ Lantan', color: '#e6c3a3' },
  actinide: { name: 'Họ Actini', color: '#d8b5d8' },
};

export const STATE_NAME: Record<State, string> = { s: 'Rắn', l: 'Lỏng', g: 'Khí', '': 'Chưa xác định' };

/** Tên nhóm kiểu SGK Việt Nam (IA… VIIIA, IB… VIIIB) */
export function groupName(g: number | null): string {
  if (g === null) return 'IIIB (họ f)';
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  if (g <= 2) return `${roman[g]}A`;
  if (g >= 13) return `${roman[g - 10]}A`;
  if (g <= 7) return `${roman[g]}B`;
  if (g <= 10) return 'VIIIB';
  return `${roman[g - 10]}B`;
}

/** 20 nguyên tố đầu tiên (KHTN 7) và các nguyên tố thường gặp trong SGK THCS–THPT */
export const COMMON = new Set([
  ...ELEMENTS.slice(0, 20).map((e) => e.symbol),
  'Cr', 'Mn', 'Fe', 'Cu', 'Zn', 'Br', 'Ag', 'Sn', 'I', 'Ba', 'Pt', 'Au', 'Hg', 'Pb',
]);
