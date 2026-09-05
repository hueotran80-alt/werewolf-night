import { GoogleGenAI } from '@google/genai';
import { Player, RoomData, GameAction, ChatMessage } from '../types';
import { ROLES_DATABASE } from '../data/rolesData';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

// Mỗi profile có thể có persona riêng sau này. Hiện chỉ mở profile LINH.
const SMART_BOT_PROFILES = {
  LINH: { name: 'Linh AI', personality: 'thân thiện, biết suy luận và đôi lúc hoài nghi' },
} as const;

export const MAX_SMART_BOTS_PER_ROOM = 1;

let client: GoogleGenAI | null = null;
const botChatBusy = new Set<string>();
const botLastChatAt = new Map<string, number>();

// Lưu ngữ cảnh hội thoại riêng theo từng bot/phòng để bot có thể trò chuyện 2 chiều.
const botConversationMemory = new Map<string, ChatMessage[]>();
const MAX_CONVERSATION_MEMORY = 24;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

function cleanJson(text: string): any | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const object = trimmed.match(/\{[\s\S]*\}/);
  if (object) {
    try {
      return JSON.parse(object[0]);
    } catch {}
  }

  return null;
}

function publicPlayers(room: RoomData, bot: Player) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.nickname,
    alive: p.isAlive,
    isBot: !!p.isBot,
    role: p.id === bot.id ? p.role : undefined,
  }));
}

function recentPublicChat(roomId: string, chatMap: Map<string, ChatMessage[]>): string {
  const messages = (chatMap.get(roomId) || [])
    .filter((m) => m.channel === 'LOBBY' || m.channel === 'DAY_PUBLIC')
    .slice(-20);
  if (!messages.length) return '(Chưa có tin nhắn chung.)';
  return messages.map((m) => `${m.senderName}: ${m.text}`).join('\n');
}

function knownPrivateInfo(room: RoomData, bot: Player): string {
  const role = bot.role ? ROLES_DATABASE[bot.role] : undefined;
  const team = role?.team || 'UNKNOWN';
  const lines: string[] = [];

  if (team === 'WEREWOLF') {
    const wolves = room.players
      .filter((p) => p.isAlive && p.role && ROLES_DATABASE[p.role]?.team === 'WEREWOLF')
      .map((p) => `${p.nickname} (${p.role})`);
    lines.push(`Đồng minh phe Sói đang sống: ${wolves.join(', ') || 'không có'}.`);
  }

  const ns = room.gameState?.nightState;
  if (bot.role === 'SEER' && ns?.seerResult) {
    lines.push(`Kết quả soi gần nhất: ${ns.seerResult.targetName} => ${ns.seerResult.isWerewolf ? 'MA SÓI' : 'KHÔNG PHẢI MA SÓI'}.`);
  }
  if (bot.role === 'WITCH') {
    lines.push(`Mục tiêu Sói đã chọn: ${ns?.witchVictimNames?.join(', ') || 'chưa có'}.`);
    lines.push(`Thuốc cứu còn: ${ns?.witchHasHeal ? 'có' : 'không'}. Thuốc độc còn: ${ns?.witchHasPoison ? 'có' : 'không'}.`);
  }
  if (bot.role === 'BODYGUARD') {
    lines.push(`Người đã bảo vệ đêm trước: ${ns?.lastGuardedPlayerId || 'không có'}.`);
  }
  if (bot.role === 'LIEU') {
    lines.push('Liễu có thể chọn một người sống khác để phong ấn trong ngày kế tiếp.');
  }
  if (bot.role === 'CUPID' && ns?.loverPair) {
    const names = ns.loverPair
      .map((id) => room.players.find((p) => p.id === id)?.nickname)
      .filter(Boolean)
      .join(' ❤️ ');
    lines.push(`Cặp đôi đã ghép: ${names || 'không rõ'}.`);
  }

  return lines.join('\n') || '(Không có thông tin bí mật đặc biệt.)';
}

export async function generateBotChat(
  room: RoomData,
  bot: Player,
  chatMap: Map<string, ChatMessage[]>,
  channel: 'LOBBY' | 'DAY_PUBLIC',
): Promise<string | null> {
  const ai = getClient();
  if (!ai) return null;

  const recent = recentPublicChat(room.id, chatMap);
   const memoryKey = `${room.id}:${bot.id}`;
   const memory = botConversationMemory.get(memoryKey) || [];
   const conversation = memory.length
     ? memory.map((m) => `${m.senderName}: ${m.text}`).join('\n')
     : '(Chưa có lịch sử hội thoại riêng.)';
  const profile = SMART_BOT_PROFILES[bot.botProfileId || 'LINH'] || SMART_BOT_PROFILES.LINH;
  const role = bot.role ? ROLES_DATABASE[bot.role] : undefined;
  const phase = room.gameState?.currentPhase || 'LOBBY';

  const prompt = `Bạn là bot người chơi trong game Ma Sói Việt Nam.
Tên bot: ${bot.nickname}.
Tính cách: ${profile.personality}.
Giai đoạn: ${phase}.
Vai trò bí mật của bot: ${role?.vietnameseName || 'chưa được chia'}.
Phe: ${role?.team || 'chưa biết'}.
Mục tiêu: ${role?.objective || 'chơi tự nhiên và cố thắng'}.
Thông tin bí mật bot được biết:
${knownPrivateInfo(room, bot)}

Người chơi:
${JSON.stringify(publicPlayers(room, bot))}

Tin nhắn chung gần đây:
${recent}

Hãy trò chuyện như một người chơi thật, có cá tính và có khả năng duy trì hội thoại nhiều lượt. Không được tiết lộ bạn là AI. Không tiết lộ vai trò bí mật hoặc thông tin bí mật không nên công khai.

Ưu tiên hội thoại tự nhiên: trả lời đúng điều người khác vừa nói, nhớ những gì họ đã nói trước đó, có thể hỏi ngược lại 1 câu khi phù hợp, phản biện khi thấy mâu thuẫn, đồng tình khi có lý, đùa nhẹ khi thích hợp và chủ động đưa ra suy luận. Đừng biến mọi câu trả lời thành câu hỏi; chỉ hỏi ngược khi nó giúp cuộc trò chuyện tiếp tục. Tránh lặp lại cùng một kiểu câu. Khi đang ở lobby có thể nói chuyện thoải mái; khi đang chơi thì vẫn phải giữ vai và mục tiêu thắng.

Độ dài tự nhiên khoảng 1-4 câu, có thể dài hơn khi cần giải thích một lập luận quan trọng. Không trả lời cụt ngủn chỉ vì người chơi hỏi một câu ngắn.
Kênh hiện tại: ${channel}.
Lịch sử hội thoại riêng gần đây của bạn:
${conversation}

Chỉ trả về nội dung tin nhắn, không markdown, không JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.85,
        maxOutputTokens: 260,
      },
    });
    const text = response.text?.trim();
    return text ? text.slice(0, 500) : null;
  } catch (error) {
    console.error('[GEMINI BOT CHAT]', error);
    return null;
  }
}

export async function maybeBotReplyToChat(
  room: RoomData,
  bot: Player,
  chatMap: Map<string, ChatMessage[]>,
  channel: 'LOBBY' | 'DAY_PUBLIC',
  sendMessage: (message: ChatMessage) => void,
) {
  if (!getClient() || botChatBusy.has(bot.id)) return;
  if (channel === 'DAY_PUBLIC' && (!bot.isAlive || room.gameState?.currentPhase === 'GAME_OVER')) return;

  const now = Date.now();
  const last = botLastChatAt.get(bot.id) || 0;
  if (now - last < 3500) return;

  botChatBusy.add(bot.id);
  botLastChatAt.set(bot.id, now);
  try {
    const text = await generateBotChat(room, bot, chatMap, channel);
    if (!text) return;

    const memoryKey = `${room.id}:${bot.id}`;
    const memory = botConversationMemory.get(memoryKey) || [];
    // Ghi lại các tin nhắn công khai gần nhất mà bot vừa nhìn thấy, giữ memory gọn.
    const recentRoomMessages = (chatMap.get(room.id) || [])
      .filter((m) => m.channel === 'LOBBY' || m.channel === 'DAY_PUBLIC')
      .slice(-12);
    const merged = [...memory, ...recentRoomMessages, {
      id: `memory_bot_${Date.now()}`,
      senderId: bot.id,
      senderName: bot.nickname,
      avatarSeed: bot.avatarSeed,
      text,
      timestamp: Date.now(),
      channel,
    }];
    const seen = new Set<string>();
    botConversationMemory.set(memoryKey, merged.filter((m) => !seen.has(m.id) && seen.add(m.id)).slice(-MAX_CONVERSATION_MEMORY));
    const message: ChatMessage = {
      id: `chat_bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: bot.id,
      senderName: bot.nickname,
      avatarSeed: bot.avatarSeed,
      text,
      timestamp: Date.now(),
      channel,
    };
    sendMessage(message);
  } finally {
    botChatBusy.delete(bot.id);
  }
}

export async function chooseBotNightAction(room: RoomData, bot: Player): Promise<GameAction | null> {
  const ai = getClient();
  if (!ai || !bot.role || !room.gameState?.nightState) return null;

  const role = ROLES_DATABASE[bot.role];
  const ns = room.gameState.nightState;

  // Roles without a night action should never ask Gemini for an arbitrary action.
  const activeRoles = new Set(['CUPID', 'WEREWOLF', 'WOLF_PUP', 'ALPHA_WOLF', 'SERIAL_KILLER', 'WITCH', 'SEER', 'BODYGUARD', 'LIEU']);
  if (!activeRoles.has(bot.role)) return null;

  const alive = room.players.filter((p) => p.isAlive);
  const targets = alive.filter((p) => p.id !== bot.id);
  if (!targets.length) return null;

  const prompt = `Bạn đang điều khiển một người chơi bot trong game Ma Sói.
Bot: ${bot.nickname}
Vai trò: ${role.vietnameseName} (${bot.role})
Phe: ${role.team}
Mục tiêu thắng: ${role.winCondition}
Khả năng: ${role.fullDescription}
Đêm: ${room.gameState.roundNumber}
Bước hiện tại: ${ns.currentStep}

Thông tin bí mật được phép dùng:
${knownPrivateInfo(room, bot)}

Người sống:
${JSON.stringify(alive.map((p) => ({ id: p.id, name: p.nickname, role: p.id === bot.id ? p.role : undefined })))}

Hãy chọn hành động hợp lệ tốt nhất. Ưu tiên chiến thuật hợp lý, không tự chọn mình nếu luật cấm.
Chỉ trả JSON đúng dạng:
{"actionType":"...","targetPlayerId":"...","secondTargetPlayerId":"...","confirmed":true}
Nếu không muốn hành động: {"actionType":"SKIP"}.
Các actionType có thể dùng: CUPID_PAIR, WOLF_KILL, WOLF_CONFIRM, SERIAL_KILL, SERIAL_KILL_SKIP, WITCH_HEAL, WITCH_DECLINE_HEAL, WITCH_POISON, WITCH_DECLINE_POISON, SEER_CHECK, BODYGUARD_GUARD, LIEU_SILENCE, SKIP.
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.35,
        maxOutputTokens: 180,
        responseMimeType: 'application/json',
      },
    });
    const data = cleanJson(response.text || '');
    if (!data || typeof data.actionType !== 'string') return null;

    const actionType = data.actionType as GameAction['actionType'];
    const targetPlayerId = typeof data.targetPlayerId === 'string' ? data.targetPlayerId : undefined;

    if (String(data.actionType) === 'SKIP') return null;
    if (targetPlayerId && !alive.some((p) => p.id === targetPlayerId)) return null;

    if (actionType === 'CUPID_PAIR') {
      const second = typeof data.secondTargetPlayerId === 'string' ? data.secondTargetPlayerId : undefined;
      if (!targetPlayerId || !second || second === targetPlayerId || !alive.some((p) => p.id === second)) return null;
      return { actionType, actorPlayerId: bot.id, targetPlayerId, extraData: { secondTargetPlayerId: second } };
    }

    const allowedByStep: Record<string, string[]> = {
      CUPID_PAIR: ['CUPID'],
      WEREWOLF_HUNT: ['WOLF_KILL', 'WOLF_CONFIRM'],
      SERIAL_KILLER_HUNT: ['SERIAL_KILL', 'SERIAL_KILL_SKIP'],
      WITCH_HEAL: ['WITCH_HEAL', 'WITCH_DECLINE_HEAL', 'WITCH_SKIP'],
      WITCH_POISON: ['WITCH_POISON', 'WITCH_DECLINE_POISON', 'WITCH_SKIP'],
      OTHER_ROLES: ['SEER_CHECK', 'BODYGUARD_GUARD', 'LIEU_SILENCE'],
    };
    if (!(allowedByStep[ns.currentStep] || []).includes(actionType)) return null;

    if (ns.currentStep === 'CUPID_PAIR' && bot.role !== 'CUPID') return null;
    if (ns.currentStep === 'WEREWOLF_HUNT') {
      if (ROLES_DATABASE[bot.role]?.team !== 'WEREWOLF') return null;
      const alpha = room.players.find((p) => p.isAlive && p.role === 'ALPHA_WOLF');
      if (alpha) {
        if (bot.id === alpha.id && actionType !== 'WOLF_KILL') return null;
        if (bot.id !== alpha.id && actionType !== 'WOLF_CONFIRM') return null;
      } else if (actionType === 'WOLF_CONFIRM' && !ns.werewolfProposalTarget) {
        return null;
      }
    }

    if (actionType === 'WOLF_CONFIRM') {
      if (!ns.werewolfProposalTarget) return null;
      return {
        actionType,
        actorPlayerId: bot.id,
        targetPlayerId: targetPlayerId || ns.werewolfProposalTarget,
        extraData: { confirmed: data.confirmed !== false },
      };
    }
    if (ns.currentStep === 'SERIAL_KILLER_HUNT' && bot.role !== 'SERIAL_KILLER') return null;
    if ((ns.currentStep === 'WITCH_HEAL' || ns.currentStep === 'WITCH_POISON') && bot.role !== 'WITCH') return null;
    if (ns.currentStep === 'OTHER_ROLES' && !['SEER', 'BODYGUARD', 'LIEU'].includes(bot.role)) return null;

    if (['WOLF_KILL', 'SERIAL_KILL', 'SEER_CHECK', 'BODYGUARD_GUARD', 'LIEU_SILENCE', 'WITCH_POISON'].includes(actionType) && !targetPlayerId) return null;

    return { actionType, actorPlayerId: bot.id, targetPlayerId };
  } catch (error) {
    console.error('[GEMINI BOT ACTION]', error);
    return null;
  }
}

export async function chooseBotVote(room: RoomData, bot: Player, chatMap: Map<string, ChatMessage[]>): Promise<string | null> {
  const ai = getClient();
  if (!ai || !bot.role || !room.gameState?.votingState) return null;

  const role = ROLES_DATABASE[bot.role];
  const alive = room.players.filter((p) => p.isAlive && p.id !== bot.id);
  if (!alive.length) return null;

  const prompt = `Bạn là người chơi bot trong game Ma Sói đang bỏ phiếu ban ngày.
Bot: ${bot.nickname}
Vai trò bí mật: ${role.vietnameseName} (${bot.role})
Phe: ${role.team}
Mục tiêu: ${role.objective}
Điều kiện thắng: ${role.winCondition}

Thông tin bí mật:
${knownPrivateInfo(room, bot)}

Người còn sống để bỏ phiếu:
${JSON.stringify(alive.map((p) => ({ id: p.id, name: p.nickname })))}

Tin nhắn chung gần đây:
${recentPublicChat(room.id, chatMap)}

Chọn đúng một targetPlayerId. Hãy suy luận theo vai trò và những gì mọi người nói. Không được chọn bot.
Chỉ trả JSON: {"targetPlayerId":"ID"}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 100,
        responseMimeType: 'application/json',
      },
    });
    const data = cleanJson(response.text || '');
    const id = data?.targetPlayerId;
    return typeof id === 'string' && alive.some((p) => p.id === id) ? id : null;
  } catch (error) {
    console.error('[GEMINI BOT VOTE]', error);
    return null;
  }
}
// ============================================================
// LINH AI - TEXT TO SPEECH
// ============================================================

export async function generateLinhSpeech(
  text: string,
): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[GEMINI TTS] GEMINI_API_KEY is missing.');
    return null;
  }

  const cleanText = text.trim();

  if (!cleanText) {
    return null;
  }

  const ttsModel =
    process.env.GEMINI_TTS_MODEL ||
    'gemini-3.1-flash-tts-preview';

  const voice =
    process.env.GEMINI_TTS_VOICE ||
    'Kore';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Bạn là Linh AI trong trò chơi Ma Sói. Hãy đọc tự nhiên, rõ ràng và thân thiện câu sau bằng tiếng Việt:\n\n${cleanText}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        `[GEMINI TTS] HTTP ${response.status}: ${errorText}`,
      );

      return null;
    }

    const data = await response.json();

    const audioBase64 =
      data?.candidates?.[0]?.content?.parts?.find(
        (part: any) =>
          typeof part?.inlineData?.data === 'string',
      )?.inlineData?.data;

    if (!audioBase64) {
      console.error(
        '[GEMINI TTS] Response không chứa dữ liệu audio.',
      );

      return null;
    }

    return Buffer.from(audioBase64, 'base64');
  } catch (error) {
    console.error('[GEMINI TTS]', error);
    return null;
  }
}