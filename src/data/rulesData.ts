export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  content: string[];
  tips?: string[];
}

export const BEGINNER_GUIDE: GuideSection[] = [
  {
    id: 'overview',
    title: 'Tổng Quan Trò Chơi',
    icon: 'Moon',
    summary: 'Ma Sói là trò chơi ẩn vai trò, suy luận logic và đấu trí tâm lý nhiều người.',
    content: [
      'Trò chơi chia người chơi thành các phe đối lập ngầm: Phe Dân Làng (bảo vệ ngôi làng), Phe Ma Sói (trà trộn và tiêu diệt dân làng), và Phe Độc Lập / Thứ Ba (mục tiêu riêng biệt).',
      'Game vận hành theo chu kỳ ngày và đêm luân phiên do Quản Trò (Authoritative Game Server) điều khiển tự động:',
      '• BAN ĐÊM: Mọi người nhắm mắt, từng vai trò đặc biệt thức dậy trong bí mật để sử dụng kỹ năng (Sói cắn, Tiên Tri soi, Bảo Vệ hộ vệ, Phù Thủy dùng thuốc...).',
      '• BAN NGÀY: Làng thức giấc nhận thông báo ai đã ngã xuống trong đêm. Các người chơi còn sống thảo luận, chất vấn, tìm kiếm manh mối và bỏ phiếu treo cổ một kẻ bị tình nghi nhiều nhất.',
    ],
    tips: [
      'Hãy chú ý đến thái độ, lời khai và lịch sử biểu quyết của từng người.',
      'Nếu là Dân thường, sự thật và tinh thần đồng đội là vũ khí mạnh nhất của bạn.',
    ],
  },
  {
    id: 'teams',
    title: 'Các Phe Phái',
    icon: 'Shield',
    summary: 'Hiểu rõ mục tiêu và điều kiện chiến thắng của từng phe.',
    content: [
      '🐺 PHE MA SÓI (Werewolf Team):',
      'Bao gồm Ma Sói, Sói Con, Sói Trưởng. Vào ban đêm, các con Sói thức dậy cùng nhau và nhìn thấy đồng đội của mình. Ban ngày, Sói phải giả làm Dân Làng, đưa ra thông tin giả để chia rẽ phe Dân.',
      '• Điều kiện thắng: Tiêu diệt dân làng đến khi số lượng Sói bằng hoặc lớn hơn số Dân còn sống.',
      '',
      '👨 PHE DÂN LÀNG (Village Team):',
      'Bao gồm Dân Thường, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, Già Làng, Cảnh Sát Trưởng. Đa số không biết danh tính của nhau từ đầu.',
      '• Điều kiện thắng: Loại bỏ hoàn toàn tất cả Ma Sói và phe thù địch khỏi ngôi làng.',
      '',
      '☠️ PHE ĐỘC LẬP / THỨ BA (Neutral Team):',
      'Chỉ xuất hiện trong Chế độ 3 Phe (từ 9 người trở lên). Ví dụ: Kẻ Hề (muốn bị treo cổ), Kẻ Sát Nhân (muốn làm người sống sót duy nhất).',
    ],
  },
  {
    id: 'night_rules',
    title: 'Luật Ban Đêm & Thứ Tự Kỹ Năng',
    icon: 'Sparkles',
    summary: 'Thứ tự ưu tiên xử lý kỹ năng ban đêm của máy chủ (Server Engine).',
    content: [
      '1. Bầy Sói thức giấc: Thảo luận bí mật và chọn mục tiêu muốn cắn.',
      '2. Tiên Tri soi: Chọn 1 người chơi để kiểm tra xem họ có thuộc Phe Sói hay không.',
      '3. Bảo Vệ canh gác: Chọn 1 người để bảo vệ (người này sẽ không chết nếu bị Sói cắn).',
      '4. Phù Thủy hành động: Nhận biết nạn nhân bị Sói cắn và quyết định dùng Bình Cứu hoặc Bình Độc (mỗi bình 1 lần duy nhất).',
      '5. Kẻ Sát Nhân (nếu có): Ra tay ám sát 1 nạn nhân độc lập.',
      '6. Server tổng hợp kết quả: Tính toán ai được cứu, ai bị trúng độc, ai tử vong trước khi trời sáng.',
    ],
    tips: [
      'Nếu Bảo Vệ và Phù Thủy cùng cứu 1 người, người đó vẫn được an toàn.',
      'Bảo Vệ không được bảo vệ cùng 1 người trong 2 đêm liên tiếp (theo cài đặt phòng).',
    ],
  },
  {
    id: 'day_rules',
    title: 'Luật Ban Ngày & Thảo Luận',
    icon: 'Sun',
    summary: 'Thời gian công khai manh mối và biện luận.',
    content: [
      'Khi trời sáng, Quản trò thông báo danh tính các nạn nhân đã ngã xuống trong đêm (hoặc một đêm bình yên nếu Bảo Vệ/Phù Thủy đã giải cứu thành công).',
      'Đồng hồ đếm ngược Thảo luận bắt đầu (30s - 3 phút tùy cấu hình).',
      'Tất cả người chơi còn sống có thể nhắn tin trong kênh chat công khai để tranh luận, phản biện, tự minh oan hoặc tố cáo kẻ tình nghi.',
    ],
  },
  {
    id: 'voting_rules',
    title: 'Bỏ Phiếu & Giàn Treo Cổ',
    icon: 'Gavel',
    summary: 'Cách thức xét xử và xử lý trường hợp hòa phiếu.',
    content: [
      'Sau khi hết giờ thảo luận, làng bước vào giai đoạn Bỏ Phiếu (Voting).',
      'Mỗi người sống được chọn 1 người để bỏ phiếu treo cổ.',
      'Cảnh Sát Trưởng (Mayor) có lá phiếu tính x2 giá trị.',
      'Người nhận nhiều phiếu nhất sẽ bị xử tử trên giàn treo cổ.',
      'Xử lý hòa phiếu: Nếu số phiếu cao nhất bằng nhau, hệ thống sẽ thực hiện theo luật cấu hình: Không ai chết, Bỏ phiếu lại (Revote), hoặc Quyết định thuộc về Cảnh Sát Trưởng.',
    ],
  },
  {
    id: 'ghost_rules',
    title: 'Linh Hồn & Cõi Âm (Ghost View)',
    icon: 'Ghost',
    summary: 'Quyền lợi của người chơi đã tử vong.',
    content: [
      'Khi người chơi bị giết (do Sói cắn, Thuốc độc, Bị treo cổ hoặc Thợ Săn bắn), họ sẽ chuyển sang trạng thái LINH HỒN (Ghost).',
      'Linh hồn KHÔNG THỂ nhắn tin vào kênh chat người sống và KHÔNG THỂ bỏ phiếu.',
      'Linh hồn được xem toàn bộ diễn biến tiếp theo của trận đấu và tham gia kênh Chat Cõi Âm (Ghost Chat) cùng các linh hồn khác.',
    ],
  },
  {
    id: 'terms',
    title: 'Thuật Ngữ Chuyên Sâu',
    icon: 'BookOpen',
    summary: 'Các từ lóng và thuật ngữ thường gặp trong Ma Sói.',
    content: [
      '• Claim role: Tự nhận một vai trò cụ thể trước làng (VD: "Tôi claim Tiên Tri").',
      '• Counter-claim (CC): Có người khác cũng nhận cùng vai trò đó để vạch mặt kẻ nói dối.',
      '• Check Sói / Check Dân: Kết quả soi của Tiên Tri.',
      '• Bait: Giả vờ sơ hở để bẫy Sói lộ diện.',
      '• Lynch: Biểu quyết treo cổ một người vào ban ngày.',
      '• Cross-fire: Thợ Săn bắn trúng mục tiêu quan trọng.',
      '• Jester Win: Kẻ Hề thành công khiến làng vote mình chết và thắng một mình.',
    ],
  },
];
