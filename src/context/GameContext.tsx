// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Realtime WebSocket Game Context
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Player,
  RoomData,
  GameState,
  RoleId,
  WsMessagePayload,
  ChatMessage,
  GameAction,
  DeckCardConfig,
  RoomSettings,
  HostTransferRequest,
  VoiceUserState,
} from '../types';
import { soundManager } from '../services/soundService';
import { voiceService } from '../services/voiceService';
import { safeStorage } from '../lib/storage';
import { getApiBaseUrl, getWsUrl, getSavedServerRaw, saveServer, parseServerInput } from '../lib/serverConfig';

interface GameContextType {
  // Session & Connection
  isConnected: boolean;
  isConnecting: boolean;
  playerId: string | null;
  nickname: string;
  sessionToken: string | null;
  setNickname: (name: string) => void;

  // Active Game Data
  currentRoom: RoomData | null;
  gameState: GameState | null;
  myPlayer: Player | null;
  myRole: RoleId | null;
  isHost: boolean;
  isAlive: boolean;

  // Messages & Chat
  chatMessages: ChatMessage[];
  sendChat: (text: string, channel?: 'LOBBY' | 'DAY_PUBLIC' | 'GHOST_PRIVATE' | 'WOLF_PRIVATE') => void;

  // Actions & Controls
  createRoom: (nickname: string, settings?: Partial<RoomSettings>) => Promise<string>;
  joinRoom: (roomCode: string, nickname: string) => Promise<boolean>;
  leaveRoom: () => void;
  updateDeck: (newDeck: DeckCardConfig[]) => void;
  updateSettings: (newSettings: Partial<RoomSettings>) => void;
  startGame: () => void;
  submitAction: (action: GameAction) => void;
  submitVote: (targetPlayerId: string) => void;
  transferHost: (targetPlayerId: string) => void;
  respondHostTransfer: (accept: boolean) => void;
  addBotPlayer: () => void;
  kickPlayer: (targetPlayerId: string) => void;
  returnToLobby: () => void;
  restartWithSamePlayers: () => void;

  // Error & Notification
  error: string | null;
  clearError: () => void;
  activeTransferRequest: HostTransferRequest | null;
  seerResultPopup: { targetName: string; isWerewolf: boolean } | null;
  clearSeerPopup: () => void;

  // Voice Chat State & Controls
  voiceStates: Record<string, VoiceUserState>;
  isMyMicMuted: boolean;
  isMySpeaking: boolean;
  isMyDeafened: boolean;
  myAudioLevel: number;
  toggleMic: () => Promise<boolean>;
  toggleDeafen: () => boolean;
  isSilenced: boolean;

  // Cloud Server (mạng trung gian) - cho phép đổi máy chủ ngay trong app,
  // để người chơi khác mạng vẫn có thể vào cùng một máy chủ trung gian.
  cloudServerAddress: string;
  setCloudServerAddress: (raw: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(() => safeStorage.getItem('werewolf_player_id'));
  const [nickname, setNicknameState] = useState<string>(() => safeStorage.getItem('werewolf_nickname') || '');
  const [sessionToken, setSessionToken] = useState<string | null>(() => safeStorage.getItem('werewolf_session_token'));
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seerResultPopup, setSeerResultPopup] = useState<{ targetName: string; isWerewolf: boolean } | null>(null);
  const [activeTransferRequest, setActiveTransferRequest] = useState<HostTransferRequest | null>(null);

  // Voice state
  const [voiceStates, setVoiceStates] = useState<Record<string, VoiceUserState>>({});
  const [isMyMicMuted, setIsMyMicMuted] = useState<boolean>(true);
  const [isMySpeaking, setIsMySpeaking] = useState<boolean>(false);
  const [isMyDeafened, setIsMyDeafened] = useState<boolean>(false);
  const [myAudioLevel, setMyAudioLevel] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const [cloudServerAddress, setCloudServerAddressState] = useState<string>(() => getSavedServerRaw());

  const setNickname = (name: string) => {
    setNicknameState(name);
    safeStorage.setItem('werewolf_nickname', name);
  };

  const gameState = currentRoom?.gameState || null;
  const myPlayer = currentRoom?.players.find((p) => p.id === playerId) || null;
  const myRole = myPlayer?.role || null;
  const isHost = myPlayer?.isHost || currentRoom?.hostPlayerId === playerId || false;
  const isAlive = myPlayer ? myPlayer.isAlive : true;
  const isSilenced = !!myPlayer?.isSilenced;

  // Clear error utility
  const clearError = useCallback(() => setError(null), []);
  const clearSeerPopup = useCallback(() => setSeerResultPopup(null), []);

  // Send raw WS message
  const sendWs = useCallback(
    (type: string, payload?: any) => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        const msg: WsMessagePayload = {
          type: type as any,
          roomId: currentRoom?.id,
          playerId: playerId || undefined,
          sessionToken: sessionToken || undefined,
          payload,
        };
        try {
          socketRef.current.send(JSON.stringify(msg));
        } catch (e) {
          console.warn('WS send failed:', e);
        }
      }
    },
    [currentRoom?.id, playerId, sessionToken]
  );

  // Initialize WebSocket connection
  const connectSocket = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      setIsConnecting(true);
      // wsUrl trỏ tới máy chủ trung gian (cloud relay) đã cấu hình - xem
      // src/lib/serverConfig.ts. Nhờ đó dù app chạy trên máy/mạng nào (web,
      // APK Android cài từ máy khác, 4G, wifi khác...) cũng đều nối cùng 1
      // máy chủ và thấy chung phòng chơi.
      const wsUrl = getWsUrl();

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        // Auto authenticate or reconnect if playerId & room saved
        const savedRoomId = safeStorage.getItem('werewolf_room_id');
        const savedPlayerId = safeStorage.getItem('werewolf_player_id');
        const savedToken = safeStorage.getItem('werewolf_session_token');

        if (savedPlayerId && savedRoomId) {
          try {
            ws.send(
              JSON.stringify({
                type: 'RECONNECT_REQUEST',
                roomId: savedRoomId,
                playerId: savedPlayerId,
                sessionToken: savedToken,
              })
            );
          } catch (e) {
            console.warn('Reconnect send failed:', e);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessagePayload = JSON.parse(event.data);

          switch (data.type) {
            case 'AUTH_SUCCESS':
              if (data.payload?.playerId) {
                setPlayerId(data.payload.playerId);
                safeStorage.setItem('werewolf_player_id', data.payload.playerId);
              }
              if (data.payload?.sessionToken) {
                setSessionToken(data.payload.sessionToken);
                safeStorage.setItem('werewolf_session_token', data.payload.sessionToken);
              }
              break;

            case 'ROOM_STATE':
            case 'RECONNECT_STATE':
              if (data.payload?.room) {
                const r: RoomData = data.payload.room;
                setCurrentRoom(r);
                safeStorage.setItem('werewolf_room_id', r.id);

                if (r.hostTransferRequest) {
                  if (r.hostTransferRequest.toPlayerId === playerId) {
                    setActiveTransferRequest(r.hostTransferRequest);
                  }
                } else {
                  setActiveTransferRequest(null);
                }
              }
              break;

          case 'PHASE_CHANGED':
            if (data.payload?.newPhase) {
              if (data.payload.newPhase === 'NIGHT') {
                soundManager.playWolfHowl();
              } else if (data.payload.newPhase === 'DAY_ANNOUNCEMENT' || data.payload.newPhase === 'DAY_DISCUSSION') {
                soundManager.playMorningBell();
              } else if (data.payload.newPhase === 'VOTING') {
                soundManager.playGavelStrike();
              } else if (data.payload.newPhase === 'GAME_OVER') {
                soundManager.playVictory();
              }
            }
            if (data.payload?.room) {
              setCurrentRoom(data.payload.room);
            }
            break;

          case 'ROLE_ASSIGNED':
            soundManager.playCardFlip();
            if (data.payload?.room) {
              setCurrentRoom(data.payload.room);
            }
            break;

          case 'ACTION_RESULT':
            if (data.payload?.actionType === 'SEER_CHECK') {
              setSeerResultPopup({
                targetName: data.payload.targetName || 'Mục tiêu',
                isWerewolf: !!data.payload.isWerewolf,
              });
            }
            break;

          case 'NEW_CHAT':
            if (data.payload?.message) {
              setChatMessages((prev) => [...prev.slice(-99), data.payload.message]);
            }
            break;

          case 'HOST_TRANSFER_REQUEST':
            if (data.payload?.request) {
              setActiveTransferRequest(data.payload.request);
            }
            break;

          case 'VOICE_STATUS_UPDATE':
            if (data.payload?.voiceStates) {
              setVoiceStates(data.payload.voiceStates);
            }
            break;

          case 'VOICE_FORCE_MUTE_ALL':
            voiceService.forceMute();
            break;

          case 'VOICE_SIGNAL':
            if (data.payload?.fromPlayerId) {
              voiceService.handleRemoteSignal(data.payload.fromPlayerId, data.payload.signal);
            }
            break;

          case 'ERROR':
            setError(data.payload?.message || 'Có lỗi xảy ra từ máy chủ.');
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WS Parse error', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      socketRef.current = null;
      // Reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocket();
      }, 3000);
    };

    ws.onerror = () => {
      setIsConnected(false);
      setIsConnecting(false);
    };
  } catch (err) {
    console.warn('Failed to establish WebSocket connection:', err);
    setIsConnecting(false);
    setIsConnected(false);
  }
}, [playerId]);

  // Đổi địa chỉ máy chủ trung gian (cloud relay) đang dùng. Vì phòng chơi &
  // session cũ chỉ tồn tại trên máy chủ CŨ, ta phải ngắt kết nối hiện tại,
  // xoá session đã lưu rồi kết nối lại tới máy chủ MỚI từ đầu.
  const setCloudServerAddress = useCallback(
    (raw: string) => {
      const parsed = parseServerInput(raw);
      saveServer(parsed ? raw.trim() : '');
      setCloudServerAddressState(parsed ? raw.trim() : '');

      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
        socketRef.current = null;
      }

      voiceService.teardownAllPeers();
      safeStorage.removeItem('werewolf_room_id');
      safeStorage.removeItem('werewolf_player_id');
      safeStorage.removeItem('werewolf_session_token');
      setPlayerId(null);
      setSessionToken(null);
      setCurrentRoom(null);
      setChatMessages([]);
      setIsConnected(false);

      // Kết nối ngay tới máy chủ mới (không chờ effect, vì playerId có thể
      // đã sẵn là null từ trước nên effect phụ thuộc [connectSocket] sẽ
      // không tự chạy lại trong trường hợp đó).
      setTimeout(() => connectSocket(), 50);
    },
    [connectSocket]
  );

  // Cấp cho voiceService "đường dây" gửi tín hiệu WebRTC (offer/answer/ICE)
  // qua chính máy chủ trung gian cloud (WebSocket), và cập nhật ID của mình.
  useEffect(() => {
    voiceService.setSignalSender((targetPlayerId, signal) => {
      sendWs('VOICE_SIGNAL', { targetPlayerId, signal });
    });
    voiceService.setLocalPlayerId(playerId);
  }, [sendWs, playerId]);

  // Mỗi khi danh sách người chơi thật (không phải bot) trong phòng thay đổi,
  // đồng bộ lại "lưới" kết nối thoại WebRTC peer-to-peer tương ứng.
  useEffect(() => {
    if (!currentRoom || !playerId) {
      voiceService.teardownAllPeers();
      return;
    }
    const otherRealPlayerIds = currentRoom.players
      .filter((p) => p.id !== playerId && !p.isBot)
      .map((p) => p.id);
    voiceService.syncRoomPeers(otherRealPlayerIds);
  }, [currentRoom, playerId]);

  // Subscribe to local voice audio levels & mute state
  useEffect(() => {
    const unsub = voiceService.subscribe((status) => {
      setIsMyMicMuted(status.isMuted);
      setIsMySpeaking(status.isSpeaking);
      setIsMyDeafened(status.isDeafened);
      setMyAudioLevel(status.audioLevel);
    });

    voiceService.setOnSpeakingChange((speaking) => {
      sendWs('VOICE_STATUS_UPDATE', {
        isMuted: voiceService.isMuted,
        isSpeaking: speaking,
        isDeafened: voiceService.isDeafened,
      });
    });

    // Hiện lỗi rõ ràng cho người dùng khi không xin được quyền Micro
    // (ví dụ trên Android bị từ chối quyền RECORD_AUDIO), thay vì để nút
    // "Bật Mic" không phản ứng gì mà không rõ lý do.
    voiceService.setOnMicError((message) => {
      setError(message);
    });

    return () => {
      unsub();
    };
  }, [sendWs]);

  // Handle automatic mute on Night phase or Silence curse
  useEffect(() => {
    if (gameState?.currentPhase === 'NIGHT' || gameState?.currentPhase === 'ROLE_REVEAL' || gameState?.currentPhase === 'HUNTER_REVENGE') {
      if (!isMyMicMuted) {
        voiceService.forceMute();
      }
    }
  }, [gameState?.currentPhase, isMyMicMuted]);

  useEffect(() => {
    if (isSilenced) {
      voiceService.forceMute();
      voiceService.playSilenceCurseSound();
    }
  }, [isSilenced]);

  // Toggle Mic
  const toggleMic = async (): Promise<boolean> => {
    if (gameState?.currentPhase === 'NIGHT' || gameState?.currentPhase === 'ROLE_REVEAL' || gameState?.currentPhase === 'HUNTER_REVENGE') {
      setError('🌙 Đêm đã xuống! Toàn bộ người chơi không thể mở mic để giữ bí mật.');
      return false;
    }
    if (isSilenced) {
      setError('🤐 Bạn đang bị Liễu phong ấn câm lặng! Không thể mở mic trong ngày hôm nay.');
      return false;
    }
    if (!isAlive && gameState && gameState.currentPhase !== 'LOBBY' && gameState.currentPhase !== 'GAME_OVER') {
      setError('👻 Linh hồn người đã chết không thể mở mic nói chuyện với người sống.');
      return false;
    }

    const unmuted = await voiceService.toggleMute();
    sendWs('VOICE_STATUS_UPDATE', {
      isMuted: !unmuted,
      isSpeaking: false,
      isDeafened: voiceService.isDeafened,
    });
    return unmuted;
  };

  // Toggle Deafen
  const toggleDeafen = (): boolean => {
    const deafened = voiceService.toggleDeafen();
    sendWs('VOICE_STATUS_UPDATE', {
      isMuted: voiceService.isMuted,
      isSpeaking: false,
      isDeafened: deafened,
    });
    return deafened;
  };

  useEffect(() => {
    connectSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [connectSocket]);

  // REST or WS Room Actions
  const createRoom = async (pName: string, settings?: Partial<RoomSettings>): Promise<string> => {
    setNickname(pName);
    const res = await fetch(`${getApiBaseUrl()}/api/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: pName, settings }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Không thể tạo phòng.');
      throw new Error(data.error);
    }

    setPlayerId(data.playerId);
    setSessionToken(data.sessionToken);
    setCurrentRoom(data.room);
    safeStorage.setItem('werewolf_player_id', data.playerId);
    safeStorage.setItem('werewolf_session_token', data.sessionToken);
    safeStorage.setItem('werewolf_room_id', data.room.id);

    // Send auth over socket
    sendWs('AUTH', {
      roomId: data.room.id,
      playerId: data.playerId,
      sessionToken: data.sessionToken,
    });

    return data.room.code;
  };

  const joinRoom = async (roomCode: string, pName: string): Promise<boolean> => {
    setNickname(pName);
    const res = await fetch(`${getApiBaseUrl()}/api/room/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: roomCode.trim().toUpperCase(), nickname: pName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Không thể vào phòng.');
      return false;
    }

    setPlayerId(data.playerId);
    setSessionToken(data.sessionToken);
    setCurrentRoom(data.room);
    safeStorage.setItem('werewolf_player_id', data.playerId);
    safeStorage.setItem('werewolf_session_token', data.sessionToken);
    safeStorage.setItem('werewolf_room_id', data.room.id);

    sendWs('AUTH', {
      roomId: data.room.id,
      playerId: data.playerId,
      sessionToken: data.sessionToken,
    });

    return true;
  };

  const leaveRoom = () => {
    sendWs('PLAYER_LEFT');
    safeStorage.removeItem('werewolf_room_id');
    voiceService.teardownAllPeers();
    setCurrentRoom(null);
    setChatMessages([]);
  };

  const updateDeck = (newDeck: DeckCardConfig[]) => {
    sendWs('DECK_UPDATED', { deck: newDeck });
  };

  const updateSettings = (newSettings: Partial<RoomSettings>) => {
    sendWs('SETTINGS_UPDATED', { settings: newSettings });
  };

  const startGame = () => {
    sendWs('GAME_START_REQUEST');
  };

  const submitAction = (action: GameAction) => {
    sendWs('ACTION_SUBMIT', action);
  };

  const submitVote = (targetPlayerId: string) => {
    sendWs('VOTE_SUBMIT', { targetPlayerId });
  };

  const transferHost = (targetPlayerId: string) => {
    sendWs('HOST_TRANSFER_REQUEST', { targetPlayerId });
  };

  const respondHostTransfer = (accept: boolean) => {
    sendWs('HOST_TRANSFER_RESPOND', { accept });
    setActiveTransferRequest(null);
  };

  const addBotPlayer = () => {
    sendWs('ADD_BOT_REQUEST');
  };

  const kickPlayer = (targetPlayerId: string) => {
    sendWs('KICK_PLAYER_REQUEST', { targetPlayerId });
  };

  const returnToLobby = () => {
    sendWs('RETURN_TO_LOBBY');
  };

  const restartWithSamePlayers = () => {
    sendWs('GAME_START_REQUEST');
  };

  const sendChat = (text: string, channel: 'LOBBY' | 'DAY_PUBLIC' | 'GHOST_PRIVATE' | 'WOLF_PRIVATE' = 'LOBBY') => {
    if (!text.trim()) return;
    sendWs('CHAT_MESSAGE', { text: text.trim(), channel });
  };

  return (
    <GameContext.Provider
      value={{
        isConnected,
        isConnecting,
        playerId,
        nickname,
        sessionToken,
        setNickname,
        currentRoom,
        gameState,
        myPlayer,
        myRole,
        isHost,
        isAlive,
        chatMessages,
        sendChat,
        createRoom,
        joinRoom,
        leaveRoom,
        updateDeck,
        updateSettings,
        startGame,
        submitAction,
        submitVote,
        transferHost,
        respondHostTransfer,
        addBotPlayer,
        kickPlayer,
        returnToLobby,
        restartWithSamePlayers,
        error,
        clearError,
        activeTransferRequest,
        seerResultPopup,
        clearSeerPopup,
        voiceStates,
        isMyMicMuted,
        isMySpeaking,
        isMyDeafened,
        myAudioLevel,
        toggleMic,
        toggleDeafen,
        isSilenced,
        cloudServerAddress,
        setCloudServerAddress,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};