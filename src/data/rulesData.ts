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
      '• BAN ĐÊM: Mọi người nhắm mắt. Đêm đầu nếu có Thần Tình Yêu thì thức dậy đầu tiên để ghép cặp; sau đó Sói thảo luận bí mật bằng mic, rồi Kẻ Sát Nhân, Phù Thủy và các vai trò còn lại lần lượt/đồng loạt hành động theo thứ tự của máy chủ.',
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
      'Bao gồm Dân Thường, Thần Tình Yêu, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, Già Làng, Cảnh Sát Trưởng, Nữ thần Liễu. Đa số không biết danh tính của nhau từ đầu; Thần Tình Yêu chỉ hoạt động ở đêm đầu.',
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
      '1. Đêm đầu tiên — Thần Tình Yêu (nếu có): Có 60 giây để chọn đúng 2 người ghép thành một cặp. Thần Tình Yêu và 2 người được ghép là 3 người duy nhất biết danh tính cặp đôi.',
      '2. Ma Sói: Có 45 giây. Chỉ Sói còn sống được mở mic và nghe nhau. Sói không thể chọn Sói làm mục tiêu. Không có Sói Trưởng thì một Sói đề xuất, các Sói còn lại xác nhận; quá nửa số Sói đồng ý thì mục tiêu được chốt. Nếu bị bác hoặc hết giờ chưa có quyết định, hệ thống tự chọn một người hợp lệ. Nếu Sói Con đã chết từ vòng trước, đêm kế tiếp bầy Sói được chốt thêm mục tiêu thứ hai. Nếu có Sói Trưởng còn sống, chỉ Sói Trưởng quyết định cuối cùng.',
      '3. Kẻ Sát Nhân (nếu có): Có 60 giây để chọn và xác nhận 1 người. Không chọn hoặc hết giờ thì mặc định không giết ai; chốt xong thì chuyển lượt ngay.',
      '4. Phù Thủy: Được biết ai bị Sói cắn nhưng không được biết vai trò. Có 30 giây cho Bình Cứu; không cứu hoặc hết giờ thì chuyển sang 30 giây cho Bình Độc. Chọn và xác nhận Bình Độc thì chốt ngay; không dùng hoặc hết giờ thì không giết ai.',
      '5. Tiên Tri + Bảo Vệ + Liễu: hoạt động đồng loạt trong 60 giây. Khi tất cả vai trò đang sống đã chọn xong thì hệ thống bỏ qua phần thời gian còn lại.',
      '6. Server tổng hợp kết quả: Tính toán cứu, bảo vệ, độc, cắn và các hiệu ứng khác trước khi chuyển sang ban ngày.',
      '7. Thứ tự vòng chơi: ĐÊM → NGÀY → VOTE. Nếu cuộc vote làm chết người, người vừa chết có 30 giây phản biện cuối cùng; trong thời gian này người đó được mở mic và chat chung. Hết 30 giây mới sang đêm kế tiếp.',
    ],
    tips: [
      'Nếu Bảo Vệ và Phù Thủy cùng cứu 1 người, người đó vẫn được an toàn.',
      'Bảo Vệ có thể tự bảo vệ. Một người đã được Bảo Vệ bảo hộ thì không thể được chọn lại ở ngay đêm kế tiếp; quy tắc này luôn được áp dụng và không phụ thuộc cài đặt phòng. Mục tiêu được bảo hộ sẽ chống đồng thời mọi nguyên nhân chết trong đêm như Sói cắn, Sát Nhân giết và Phù Thủy đầu độc.',
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
