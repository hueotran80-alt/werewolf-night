// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Realtime WebSocket Game Context
// ============================================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

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

import {
  getApiBaseUrl,
  getWsUrl,
  getSavedServerRaw,
  saveServer,
  parseServerInput,
} from '../lib/serverConfig';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface GameContextType {
  isConnected: boolean;
  isConnecting: boolean;

  playerId: string | null;
  nickname: string;
  sessionToken: string | null;

  setNickname: (name: string) => void;

  currentRoom: RoomData | null;
  gameState: GameState | null;
  myPlayer: Player | null;
  myRole: RoleId | null;

  isHost: boolean;
  isAlive: boolean;

  chatMessages: ChatMessage[];

  sendChat: (
    text: string,
    channel?:
      | 'LOBBY'
      | 'DAY_PUBLIC'
      | 'GHOST_PRIVATE'
      | 'WOLF_PRIVATE'
  ) => void;

  createRoom: (
    nickname: string,
    settings?: Partial<RoomSettings>
  ) => Promise<string>;

  joinRoom: (
    roomCode: string,
    nickname: string
  ) => Promise<boolean>;

  leaveRoom: () => void;

  updateDeck: (newDeck: DeckCardConfig[]) => void;

  updateSettings: (
    newSettings: Partial<RoomSettings>
  ) => void;

  startGame: () => void;

  submitAction: (action: GameAction) => void;

  submitVote: (targetPlayerId: string) => void;

  transferHost: (targetPlayerId: string) => void;

  respondHostTransfer: (accept: boolean) => void;

  addBotPlayer: () => void;

  kickPlayer: (targetPlayerId: string) => void;

  returnToLobby: () => void;

  restartWithSamePlayers: () => void;

  error: string | null;

  clearError: () => void;

  activeTransferRequest: HostTransferRequest | null;

  seerResultPopup: {
    targetName: string;
    isWerewolf: boolean;
  } | null;

  clearSeerPopup: () => void;

  // VOICE
  voiceStates: Record<string, VoiceUserState>;

  isMyMicMuted: boolean;
  isMySpeaking: boolean;
  isMyDeafened: boolean;
  myAudioLevel: number;

  toggleMic: () => Promise<boolean>;
  toggleDeafen: () => boolean;

  isSilenced: boolean;

  // CLOUD
  cloudServerAddress: string;

  setCloudServerAddress: (raw: string) => void;
}

const GameContext =
  createContext<GameContextType | undefined>(
    undefined
  );

// ============================================================================
// PROVIDER
// ============================================================================

export const GameProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {

  // ==========================================================================
  // SESSION
  // ==========================================================================

  const [isConnected, setIsConnected] =
    useState(false);

  const [isConnecting, setIsConnecting] =
    useState(false);

  const [playerId, setPlayerId] =
    useState<string | null>(() =>
      safeStorage.getItem(
        'werewolf_player_id'
      )
    );

  const [nickname, setNicknameState] =
    useState<string>(() =>
      safeStorage.getItem(
        'werewolf_nickname'
      ) || ''
    );

  const [sessionToken, setSessionToken] =
    useState<string | null>(() =>
      safeStorage.getItem(
        'werewolf_session_token'
      )
    );

  const [currentRoom, setCurrentRoom] =
    useState<RoomData | null>(null);

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([]);

  const [error, setError] =
    useState<string | null>(null);

  const [seerResultPopup, setSeerResultPopup] =
    useState<{
      targetName: string;
      isWerewolf: boolean;
    } | null>(null);

  const [activeTransferRequest, setActiveTransferRequest] =
    useState<HostTransferRequest | null>(
      null
    );

  // ==========================================================================
  // VOICE STATE
  // ==========================================================================

  const [voiceStates, setVoiceStates] =
    useState<Record<string, VoiceUserState>>(
      {}
    );

  const [isMyMicMuted, setIsMyMicMuted] =
    useState(true);

  const [isMySpeaking, setIsMySpeaking] =
    useState(false);

  const [isMyDeafened, setIsMyDeafened] =
    useState(false);

  const [myAudioLevel, setMyAudioLevel] =
    useState(0);

  // ==========================================================================
  // WEBSOCKET
  // ==========================================================================

  const socketRef =
    useRef<WebSocket | null>(null);

  const reconnectTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const playerIdRef =
    useRef<string | null>(playerId);

  const sessionTokenRef =
    useRef<string | null>(sessionToken);

  const roomIdRef =
    useRef<string | null>(
      currentRoom?.id || null
    );

  const manuallyClosingRef =
    useRef(false);

  /*
   * Quan trọng:
   *
   * Socket có thể CONNECTING trong khi createRoom/joinRoom
   * vừa hoàn thành.
   *
   * Những message cần gửi sẽ được đợi tới khi socket OPEN.
   */
  const pendingWsMessagesRef =
    useRef<Array<{
      type: string;
      payload?: any;
      roomId?: string | null;
      playerId?: string | null;
      sessionToken?: string | null;
    }>>([]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    sessionTokenRef.current =
      sessionToken;
  }, [sessionToken]);

  useEffect(() => {
    roomIdRef.current =
      currentRoom?.id || null;
  }, [currentRoom]);

  // ==========================================================================
  // CLOUD SERVER
  // ==========================================================================

  const [
    cloudServerAddress,
    setCloudServerAddressState,
  ] = useState<string>(() =>
    getSavedServerRaw()
  );

  // ==========================================================================
  // DERIVED GAME STATE
  // ==========================================================================

  const gameState =
    currentRoom?.gameState || null;

  const myPlayer =
    currentRoom?.players.find(
      (p) => p.id === playerId
    ) || null;

  const myRole =
    myPlayer?.role || null;

  const isHost =
    myPlayer?.isHost ||
    currentRoom?.hostPlayerId === playerId ||
    false;

  const isAlive =
    myPlayer
      ? myPlayer.isAlive
      : true;

  const isSilenced =
    !!myPlayer?.isSilenced;

  // ==========================================================================
  // NICKNAME
  // ==========================================================================

  const setNickname =
    useCallback((name: string) => {

      setNicknameState(name);

      safeStorage.setItem(
        'werewolf_nickname',
        name
      );

    }, []);

  // ==========================================================================
  // ERROR
  // ==========================================================================

  const clearError =
    useCallback(() => {
      setError(null);
    }, []);

  const clearSeerPopup =
    useCallback(() => {
      setSeerResultPopup(null);
    }, []);

  // ==========================================================================
  // FLUSH PENDING WEBSOCKET MESSAGES
  // ==========================================================================

  const flushPendingWsMessages =
    useCallback(() => {

      const ws =
        socketRef.current;

      if (
        !ws ||
        ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      const queue =
        pendingWsMessagesRef.current;

      if (!queue.length) {
        return;
      }

      pendingWsMessagesRef.current = [];

      console.log(
        `[WS] Flushing ${queue.length} queued messages`
      );

      for (const item of queue) {

        try {

          ws.send(
            JSON.stringify({
              type: item.type,

              roomId:
                item.roomId ??
                roomIdRef.current ??
                undefined,

              playerId:
                item.playerId ??
                playerIdRef.current ??
                undefined,

              sessionToken:
                item.sessionToken ??
                sessionTokenRef.current ??
                undefined,

              payload:
                item.payload,
            })
          );

        } catch (error) {

          console.warn(
            '[WS] Failed to flush queued message:',
            error
          );

        }
      }

    }, []);

  // ==========================================================================
  // WEBSOCKET SEND
  // ==========================================================================

  const sendWs =
    useCallback(
      (
        type: string,
        payload?: any,
        overrides?: {
          roomId?: string | null;
          playerId?: string | null;
          sessionToken?: string | null;
        }
      ): boolean => {

        const ws =
          socketRef.current;

        const finalRoomId =
          overrides?.roomId !== undefined
            ? overrides.roomId
            : roomIdRef.current;

        const finalPlayerId =
          overrides?.playerId !== undefined
            ? overrides.playerId
            : playerIdRef.current;

        const finalSessionToken =
          overrides?.sessionToken !== undefined
            ? overrides.sessionToken
            : sessionTokenRef.current;

        /*
         * Nếu socket chưa OPEN:
         *
         * - Không bỏ message.
         * - Queue lại.
         *
         * Điều này đặc biệt quan trọng cho VOICE_SIGNAL.
         */

        if (
          !ws ||
          ws.readyState !== WebSocket.OPEN
        ) {

          console.warn(
            `[WS] Queue message because socket is not OPEN: ${type}`
          );

          pendingWsMessagesRef.current.push({
            type,
            payload,
            roomId: finalRoomId,
            playerId: finalPlayerId,
            sessionToken:
              finalSessionToken,
          });

          return false;
        }

        const msg: WsMessagePayload = {
          type: type as any,

          roomId:
            finalRoomId || undefined,

          playerId:
            finalPlayerId || undefined,

          sessionToken:
            finalSessionToken || undefined,

          payload,
        };

        try {

          ws.send(
            JSON.stringify(msg)
          );

          return true;

        } catch (error) {

          console.warn(
            `[WS] Send failed: ${type}`,
            error
          );

          pendingWsMessagesRef.current.push({
            type,
            payload,
            roomId: finalRoomId,
            playerId: finalPlayerId,
            sessionToken:
              finalSessionToken,
          });

          return false;
        }
      },
      []
    );

  // ==========================================================================
  // WEBSOCKET CONNECTION
  // ==========================================================================

  const connectSocket =
    useCallback(() => {

      const existing =
        socketRef.current;

      if (
        existing &&
        (
          existing.readyState ===
            WebSocket.OPEN ||
          existing.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        return;
      }

      manuallyClosingRef.current =
        false;

      try {

        setIsConnecting(true);

        const wsUrl =
          getWsUrl();

        console.log(
          '[WS] Connecting:',
          wsUrl
        );

        const ws =
          new WebSocket(wsUrl);

        socketRef.current =
          ws;

        // ====================================================================
        // OPEN
        // ====================================================================

        ws.onopen = () => {

          console.log(
            '[WS] ✅ Connected'
          );

          setIsConnected(true);
          setIsConnecting(false);

          /*
           * Luôn đọc refs mới nhất.
           */

          const savedRoomId =
            safeStorage.getItem(
              'werewolf_room_id'
            ) ||
            roomIdRef.current;

          const savedPlayerId =
            safeStorage.getItem(
              'werewolf_player_id'
            ) ||
            playerIdRef.current;

          const savedToken =
            safeStorage.getItem(
              'werewolf_session_token'
            ) ||
            sessionTokenRef.current;

          if (
            savedPlayerId &&
            savedRoomId
          ) {

            console.log(
              '[WS] 🔄 Reconnect player:',
              savedPlayerId,
              'room:',
              savedRoomId
            );

            try {

              ws.send(
                JSON.stringify({
                  type:
                    'RECONNECT_REQUEST',

                  roomId:
                    savedRoomId,

                  playerId:
                    savedPlayerId,

                  sessionToken:
                    savedToken,

                  payload: {},
                })
              );

            } catch (error) {

              console.warn(
                '[WS] Reconnect request failed:',
                error
              );

            }

          }

          /*
           * Flush các message bị queue.
           *
           * Thường sẽ rỗng nếu đây là socket reconnect,
           * nhưng giữ lại để không mất VOICE_SIGNAL.
           */

          flushPendingWsMessages();

        };

        // ====================================================================
        // MESSAGE
        // ====================================================================

        ws.onmessage = (event) => {

          try {

            const data: WsMessagePayload =
              JSON.parse(
                event.data
              );

            switch (data.type) {

              // ==============================================================
              // AUTH SUCCESS
              // ==============================================================

              case 'AUTH_SUCCESS': {

                const newPlayerId =
                  data.payload?.playerId;

                const newToken =
                  data.payload?.sessionToken;

                if (newPlayerId) {

                  playerIdRef.current =
                    newPlayerId;

                  setPlayerId(
                    newPlayerId
                  );

                  safeStorage.setItem(
                    'werewolf_player_id',
                    newPlayerId
                  );

                  voiceService.setLocalPlayerId(
                    newPlayerId
                  );
                }

                if (newToken) {

                  sessionTokenRef.current =
                    newToken;

                  setSessionToken(
                    newToken
                  );

                  safeStorage.setItem(
                    'werewolf_session_token',
                    newToken
                  );
                }

                break;
              }

              // ==============================================================
              // ROOM STATE
              // ==============================================================

              case 'ROOM_STATE':
              case 'RECONNECT_STATE': {

                const room =
                  data.payload?.room as
                    | RoomData
                    | undefined;

                if (!room) {
                  break;
                }

                roomIdRef.current =
                  room.id;

                setCurrentRoom(
                  room
                );

                safeStorage.setItem(
                  'werewolf_room_id',
                  room.id
                );

                if (
                  room.hostTransferRequest
                ) {

                  if (
                    room
                      .hostTransferRequest
                      .toPlayerId ===
                    playerIdRef.current
                  ) {

                    setActiveTransferRequest(
                      room.hostTransferRequest
                    );

                  }

                } else {

                  setActiveTransferRequest(
                    null
                  );
                }

                /*
                 * WebRTC peer sẽ được sync
                 * qua useEffect.
                 */

                break;
              }

              // ==============================================================
              // PHASE CHANGED
              // ==============================================================

              case 'PHASE_CHANGED': {

                const newPhase =
                  data.payload?.newPhase;

                if (newPhase) {

                  if (
                    newPhase ===
                    'NIGHT'
                  ) {

                    soundManager.playWolfHowl();

                    voiceService.forceMute();

                  } else if (
                    newPhase ===
                      'DAY_ANNOUNCEMENT' ||
                    newPhase ===
                      'DAY_DISCUSSION'
                  ) {

                    soundManager.playMorningBell();

                  } else if (
                    newPhase ===
                    'VOTING'
                  ) {

                    soundManager.playGavelStrike();

                  } else if (
                    newPhase ===
                    'GAME_OVER'
                  ) {

                    soundManager.playVictory();

                  }

                }

                if (
                  data.payload?.room
                ) {

                  const room =
                    data.payload.room;

                  roomIdRef.current =
                    room.id;

                  setCurrentRoom(
                    room
                  );

                }

                break;
              }

              // ==============================================================
              // ROLE ASSIGNED
              // ==============================================================

              case 'ROLE_ASSIGNED': {

                soundManager.playCardFlip();

                if (
                  data.payload?.room
                ) {

                  const room =
                    data.payload.room;

                  roomIdRef.current =
                    room.id;

                  setCurrentRoom(
                    room
                  );

                }

                break;
              }

              // ==============================================================
              // ACTION RESULT
              // ==============================================================

              case 'ACTION_RESULT': {

                if (
                  data.payload?.actionType ===
                  'SEER_CHECK'
                ) {

                  setSeerResultPopup({
                    targetName:
                      data.payload
                        .targetName ||
                      'Mục tiêu',

                    isWerewolf:
                      !!data.payload
                        .isWerewolf,
                  });

                }

                break;
              }

              // ==============================================================
              // CHAT
              // ==============================================================

              case 'NEW_CHAT': {

                const message =
                  data.payload?.message;

                if (!message?.id) {
                  break;
                }

                setChatMessages(
                  (previous) => {

                    if (
                      previous.some(
                        (m) =>
                          m.id ===
                          message.id
                      )
                    ) {
                      return previous;
                    }

                    return [
                      ...previous.slice(
                        -99
                      ),
                      message,
                    ];

                  }
                );

                break;
              }

              // ==============================================================
              // HOST TRANSFER
              // ==============================================================

              case 'HOST_TRANSFER_REQUEST': {

                if (
                  data.payload?.request
                ) {

                  setActiveTransferRequest(
                    data.payload.request
                  );

                }

                break;
              }

              // ==============================================================
              // VOICE STATUS
              // ==============================================================

              case 'VOICE_STATUS_UPDATE': {

                if (
                  data.payload?.voiceStates
                ) {

                  setVoiceStates(
                    data.payload.voiceStates
                  );

                }

                break;
              }

              // ==============================================================
              // FORCE MUTE
              // ==============================================================

              case 'VOICE_FORCE_MUTE_ALL': {

                voiceService.forceMute();

                break;
              }

              // ==============================================================
              // WEBRTC SIGNAL
              // ==============================================================

              case 'VOICE_SIGNAL': {

                const fromPlayerId =
                  data.payload
                    ?.fromPlayerId;

                const signal =
                  data.payload?.signal;

                if (
                  !fromPlayerId ||
                  !signal
                ) {
                  break;
                }

                /*
                 * TUYỆT ĐỐI không xử lý signal
                 * do chính mình phát ra.
                 */

                if (
                  fromPlayerId ===
                  playerIdRef.current
                ) {

                  console.warn(
                    '[VOICE] Ignoring own signal'
                  );

                  break;
                }

                console.log(
                  '[VOICE] 📥 Signal received from:',
                  fromPlayerId,
                  signal.kind
                );

                void voiceService
                  .handleRemoteSignal(
                    fromPlayerId,
                    signal
                  );

                break;
              }

              // ==============================================================
              // ERROR
              // ==============================================================

              case 'ERROR': {

                setError(
                  data.payload?.message ||
                    'Có lỗi xảy ra từ máy chủ.'
                );

                break;
              }

              default:
                break;
            }

          } catch (error) {

            console.error(
              '[WS] Message parse error:',
              error
            );

          }
        };

        // ====================================================================
        // CLOSE
        // ====================================================================

        ws.onclose = () => {

          console.log(
            '[WS] ❌ Disconnected'
          );

          setIsConnected(false);
          setIsConnecting(false);

          if (
            socketRef.current ===
            ws
          ) {

            socketRef.current =
              null;

          }

          if (
            manuallyClosingRef.current
          ) {

            return;

          }

          if (
            reconnectTimeoutRef.current
          ) {

            clearTimeout(
              reconnectTimeoutRef.current
            );

          }

          reconnectTimeoutRef.current =
            setTimeout(() => {

              reconnectTimeoutRef.current =
                null;

              connectSocket();

            }, 3000);

        };

        // ====================================================================
        // ERROR
        // ====================================================================

        ws.onerror = (event) => {

          console.warn(
            '[WS] WebSocket error:',
            event
          );

          setIsConnected(false);
          setIsConnecting(false);

        };

      } catch (error) {

        console.error(
          '[WS] Failed to create WebSocket:',
          error
        );

        setIsConnecting(false);
        setIsConnected(false);

      }

    }, [
      flushPendingWsMessages,
    ]);

  // ==========================================================================
  // CLOUD SERVER
  // ==========================================================================

  const setCloudServerAddress =
    useCallback(
      (raw: string) => {

        const parsed =
          parseServerInput(raw);

        saveServer(
          parsed
            ? raw.trim()
            : ''
        );

        setCloudServerAddressState(
          parsed
            ? raw.trim()
            : ''
        );

        manuallyClosingRef.current =
          true;

        if (
          reconnectTimeoutRef.current
        ) {

          clearTimeout(
            reconnectTimeoutRef.current
          );

          reconnectTimeoutRef.current =
            null;
        }

        pendingWsMessagesRef.current =
          [];

        if (
          socketRef.current
        ) {

          try {

            socketRef.current.close();

          } catch {}

          socketRef.current =
            null;

        }

        voiceService.teardownAllPeers();

        safeStorage.removeItem(
          'werewolf_room_id'
        );

        safeStorage.removeItem(
          'werewolf_player_id'
        );

        safeStorage.removeItem(
          'werewolf_session_token'
        );

        playerIdRef.current =
          null;

        sessionTokenRef.current =
          null;

        roomIdRef.current =
          null;

        setPlayerId(null);
        setSessionToken(null);
        setCurrentRoom(null);
        setChatMessages([]);
        setVoiceStates({});
        setIsConnected(false);

        setTimeout(() => {

          manuallyClosingRef.current =
            false;

          connectSocket();

        }, 100);

      },
      [connectSocket]
    );

  // ==========================================================================
  // VOICE SIGNAL SENDER
  // ==========================================================================

  useEffect(() => {

    /*
     * voiceService không gửi trực tiếp WebSocket.
     *
     * Luồng:
     *
     * WebRTC
     *    ↓
     * voiceService
     *    ↓
     * signalSender
     *    ↓
     * GameContext
     *    ↓
     * WebSocket
     *    ↓
     * server.ts
     *    ↓
     * người chơi đích
     */

    voiceService.setSignalSender(
      (
        targetPlayerId,
        signal
      ) => {

        if (
          !targetPlayerId ||
          !signal
        ) {
          return;
        }

        console.log(
          '[VOICE] 📤 Sending signal:',
          signal.kind,
          'to',
          targetPlayerId
        );

        sendWs(
          'VOICE_SIGNAL',
          {
            targetPlayerId,
            signal,
          }
        );

      }
    );

    voiceService.setLocalPlayerId(
      playerId
    );

  }, [
    playerId,
    sendWs,
  ]);

  // ==========================================================================
  // SYNC WEBRTC PEERS
  // ==========================================================================

  useEffect(() => {

    if (
      !currentRoom ||
      !playerId
    ) {

      voiceService.teardownAllPeers();

      return;
    }

    /*
     * Chỉ lấy người thật.
     */

    const otherRealPlayerIds =
      currentRoom.players
        .filter(
          (player) =>
            player.id !== playerId &&
            !player.isBot
        )
        .map(
          (player) =>
            player.id
        )
        .filter(Boolean);

    console.log(
      '[VOICE] 🔄 Sync peers:',
      otherRealPlayerIds
    );

    voiceService.syncRoomPeers(
      otherRealPlayerIds
    );

  }, [
    currentRoom,
    playerId,
  ]);

  // ==========================================================================
  // VOICE STATUS
  // ==========================================================================

  useEffect(() => {

    const unsubscribe =
      voiceService.subscribe(
        (status) => {

          setIsMyMicMuted(
            status.isMuted
          );

          setIsMySpeaking(
            status.isSpeaking
          );

          setIsMyDeafened(
            status.isDeafened
          );

          setMyAudioLevel(
            status.audioLevel
          );

        }
      );

    /*
     * Chỉ gửi khi speaking thay đổi.
     */

    voiceService.setOnSpeakingChange(
      (speaking) => {

        sendWs(
          'VOICE_STATUS_UPDATE',
          {
            isMuted:
              voiceService.isMuted,

            isSpeaking:
              speaking,

            isDeafened:
              voiceService.isDeafened,
          }
        );

      }
    );

    return () => {

      unsubscribe();

      /*
       * Không để callback cũ tồn tại
       * khi component bị unmount.
       */

      voiceService.setOnSpeakingChange(
        () => {}
      );

    };

  }, [
    sendWs,
  ]);

  // ==========================================================================
  // AUTOMATIC NIGHT MUTE
  // ==========================================================================

  useEffect(() => {

    const phase =
      gameState?.currentPhase;

    const night =
      phase === 'NIGHT' ||
      phase === 'ROLE_REVEAL' ||
      phase === 'HUNTER_REVENGE';

    if (!night) {
      return;
    }

    voiceService.forceMute();

    sendWs(
      'VOICE_STATUS_UPDATE',
      {
        isMuted: true,
        isSpeaking: false,
        isDeafened:
          voiceService.isDeafened,
      }
    );

  }, [
    gameState?.currentPhase,
    sendWs,
  ]);

  // ==========================================================================
  // AUTOMATIC SILENCE MUTE
  // ==========================================================================

  useEffect(() => {

    if (!isSilenced) {
      return;
    }

    voiceService.forceMute();

    voiceService.playSilenceCurseSound();

    sendWs(
      'VOICE_STATUS_UPDATE',
      {
        isMuted: true,
        isSpeaking: false,
        isDeafened:
          voiceService.isDeafened,
      }
    );

  }, [
    isSilenced,
    sendWs,
  ]);

  // ==========================================================================
  // MICROPHONE
  // ==========================================================================

  const toggleMic =
    useCallback(
      async (): Promise<boolean> => {

        const phase =
          gameState?.currentPhase;

        const night =
          phase === 'NIGHT' ||
          phase === 'ROLE_REVEAL' ||
          phase === 'HUNTER_REVENGE';

        if (night) {

          setError(
            '🌙 Đêm đã xuống! Toàn bộ người chơi không thể mở mic để giữ bí mật.'
          );

          return false;
        }

        if (isSilenced) {

          setError(
            '🤐 Bạn đang bị Liễu phong ấn câm lặng! Không thể mở mic trong ngày hôm nay.'
          );

          return false;
        }

        if (
          !isAlive &&
          gameState &&
          phase !== 'LOBBY' &&
          phase !== 'GAME_OVER'
        ) {

          setError(
            '👻 Linh hồn người đã chết không thể mở mic nói chuyện với người sống.'
          );

          return false;
        }

        /*
         * voiceService.toggleMute()
         *
         * Nếu chưa có MediaStream:
         *
         * navigator.mediaDevices.getUserMedia()
         *
         * sẽ được gọi tại đây.
         *
         * Đây là nơi browser/WebView yêu cầu quyền microphone.
         */

        console.log(
          '[VOICE] 🎤 Toggle microphone'
        );

        const unmuted =
          await voiceService.toggleMute();

        setIsMyMicMuted(
          voiceService.isMuted
        );

        setIsMySpeaking(
          voiceService.isSpeaking
        );

        /*
         * Gửi trạng thái microphone lên server.
         */

        sendWs(
          'VOICE_STATUS_UPDATE',
          {
            isMuted:
              voiceService.isMuted,

            isSpeaking:
              voiceService.isSpeaking,

            isDeafened:
              voiceService.isDeafened,
          }
        );

        return unmuted;

      },
      [
        gameState,
        isSilenced,
        isAlive,
        sendWs,
      ]
    );

  // ==========================================================================
  // DEAFEN
  // ==========================================================================

  const toggleDeafen =
    useCallback(() => {

      const deafened =
        voiceService.toggleDeafen();

      setIsMyDeafened(
        deafened
      );

      sendWs(
        'VOICE_STATUS_UPDATE',
        {
          isMuted:
            voiceService.isMuted,

          isSpeaking:
            false,

          isDeafened:
            deafened,
        }
      );

      return deafened;

    }, [
      sendWs,
    ]);

  // ==========================================================================
  // INITIAL SOCKET
  // ==========================================================================

  useEffect(() => {

    connectSocket();

    return () => {

      manuallyClosingRef.current =
        true;

      if (
        reconnectTimeoutRef.current
      ) {

        clearTimeout(
          reconnectTimeoutRef.current
        );

        reconnectTimeoutRef.current =
          null;
      }

      pendingWsMessagesRef.current =
        [];

      if (
        socketRef.current
      ) {

        try {

          socketRef.current.close();

        } catch {}

        socketRef.current =
          null;
      }

      voiceService.teardownAllPeers();

    };

  }, [
    connectSocket,
  ]);

  // ==========================================================================
  // CREATE ROOM
  // ==========================================================================

  const createRoom = async (
    pName: string,
    settings?: Partial<RoomSettings>
  ): Promise<string> => {

    setNickname(pName);

    const response =
      await fetch(
        `${getApiBaseUrl()}/api/room/create`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            nickname: pName,
            settings,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      setError(
        data.error ||
          'Không thể tạo phòng.'
      );

      throw new Error(
        data.error
      );
    }

    playerIdRef.current =
      data.playerId;

    sessionTokenRef.current =
      data.sessionToken;

    roomIdRef.current =
      data.room.id;

    setPlayerId(
      data.playerId
    );

    setSessionToken(
      data.sessionToken
    );

    setCurrentRoom(
      data.room
    );

    safeStorage.setItem(
      'werewolf_player_id',
      data.playerId
    );

    safeStorage.setItem(
      'werewolf_session_token',
      data.sessionToken
    );

    safeStorage.setItem(
      'werewolf_room_id',
      data.room.id
    );

    voiceService.setLocalPlayerId(
      data.playerId
    );

    /*
     * AUTH.
     *
     * sendWs() sẽ queue nếu WebSocket
     * chưa OPEN.
     */

    sendWs(
      'AUTH',
      {},
      {
        roomId:
          data.room.id,

        playerId:
          data.playerId,

        sessionToken:
          data.sessionToken,
      }
    );

    return data.room.code;
  };

  // ==========================================================================
  // JOIN ROOM
  // ==========================================================================

  const joinRoom = async (
    roomCode: string,
    pName: string
  ): Promise<boolean> => {

    setNickname(pName);

    const response =
      await fetch(
        `${getApiBaseUrl()}/api/room/join`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            code:
              roomCode
                .trim()
                .toUpperCase(),

            nickname:
              pName,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {

      setError(
        data.error ||
          'Không thể vào phòng.'
      );

      return false;
    }

    playerIdRef.current =
      data.playerId;

    sessionTokenRef.current =
      data.sessionToken;

    roomIdRef.current =
      data.room.id;

    setPlayerId(
      data.playerId
    );

    setSessionToken(
      data.sessionToken
    );

    setCurrentRoom(
      data.room
    );

    safeStorage.setItem(
      'werewolf_player_id',
      data.playerId
    );

    safeStorage.setItem(
      'werewolf_session_token',
      data.sessionToken
    );

    safeStorage.setItem(
      'werewolf_room_id',
      data.room.id
    );

    voiceService.setLocalPlayerId(
      data.playerId
    );

    sendWs(
      'AUTH',
      {},
      {
        roomId:
          data.room.id,

        playerId:
          data.playerId,

        sessionToken:
          data.sessionToken,
      }
    );

    return true;
  };

  // ==========================================================================
  // LEAVE ROOM
  // ==========================================================================

  const leaveRoom = () => {

    sendWs(
      'PLAYER_LEFT'
    );

    /*
     * Đóng WebRTC trước khi xóa room.
     */

    voiceService.teardownAllPeers();

    safeStorage.removeItem(
      'werewolf_room_id'
    );

    roomIdRef.current =
      null;

    setCurrentRoom(
      null
    );

    setChatMessages([]);

    setVoiceStates({});

  };

  // ==========================================================================
  // GAME ACTIONS
  // ==========================================================================

  const updateDeck = (
    newDeck: DeckCardConfig[]
  ) => {

    sendWs(
      'DECK_UPDATED',
      {
        deck:
          newDeck,
      }
    );

  };

  const updateSettings = (
    newSettings: Partial<RoomSettings>
  ) => {

    sendWs(
      'SETTINGS_UPDATED',
      {
        settings:
          newSettings,
      }
    );

  };

  const startGame = () => {

    sendWs(
      'GAME_START_REQUEST'
    );

  };

  const submitAction = (
    action: GameAction
  ) => {

    sendWs(
      'ACTION_SUBMIT',
      action
    );

  };

  const submitVote = (
    targetPlayerId: string
  ) => {

    sendWs(
      'VOTE_SUBMIT',
      {
        targetPlayerId,
      }
    );

  };

  const transferHost = (
    targetPlayerId: string
  ) => {

    sendWs(
      'HOST_TRANSFER_REQUEST',
      {
        targetPlayerId,
      }
    );

  };

  const respondHostTransfer = (
    accept: boolean
  ) => {

    sendWs(
      'HOST_TRANSFER_RESPOND',
      {
        accept,
      }
    );

    setActiveTransferRequest(
      null
    );

  };

  const addBotPlayer = () => {

    sendWs(
      'ADD_BOT_REQUEST'
    );

  };

  const kickPlayer = (
    targetPlayerId: string
  ) => {

    sendWs(
      'KICK_PLAYER_REQUEST',
      {
        targetPlayerId,
      }
    );

  };

  const returnToLobby = () => {

    sendWs(
      'RETURN_TO_LOBBY'
    );

  };

  const restartWithSamePlayers = () => {

    sendWs(
      'GAME_START_REQUEST'
    );

  };

  // ==========================================================================
  // CHAT
  // ==========================================================================

  const sendChat = (
    text: string,
    channel:
      | 'LOBBY'
      | 'DAY_PUBLIC'
      | 'GHOST_PRIVATE'
      | 'WOLF_PRIVATE' = 'LOBBY'
  ) => {

    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }

    sendWs(
      'CHAT_MESSAGE',
      {
        text:
          cleanText,

        channel,
      }
    );

  };

  // ==========================================================================
  // PROVIDER
  // ==========================================================================

  return (
    <GameContext.Provider
      value={{

        // SESSION
        isConnected,
        isConnecting,

        playerId,
        nickname,
        sessionToken,

        setNickname,

        // GAME
        currentRoom,
        gameState,

        myPlayer,
        myRole,

        isHost,
        isAlive,

        // CHAT
        chatMessages,
        sendChat,

        // ACTIONS
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

        // ERRORS
        error,
        clearError,

        activeTransferRequest,

        seerResultPopup,
        clearSeerPopup,

        // VOICE
        voiceStates,

        isMyMicMuted,
        isMySpeaking,
        isMyDeafened,
        myAudioLevel,

        toggleMic,
        toggleDeafen,

        isSilenced,

        // CLOUD
        cloudServerAddress,
        setCloudServerAddress,

      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// ============================================================================
// HOOK
// ============================================================================

export const useGame = () => {

  const context =
    useContext(GameContext);

  if (!context) {

    throw new Error(
      'useGame must be used within a GameProvider'
    );

  }

  return context;
};