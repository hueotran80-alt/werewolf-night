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
import { liveKitService } from '../services/livekitService';
import { safeStorage } from '../lib/storage';
import { ROLES_DATABASE } from '../data/rolesData';
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

  sendChat: (
    text: string,
    channel?:
      | 'LOBBY'
      | 'DAY_PUBLIC'
      | 'GHOST_PRIVATE'
      | 'WOLF_PRIVATE'
  ) => void;

  // Actions & Controls
  createRoom: (
    nickname: string,
    settings?: Partial<RoomSettings>
  ) => Promise<string>;

  joinRoom: (
    roomCode: string,
    nickname: string
  ) => Promise<boolean>;

  leaveRoom: () => void;

  updateDeck: (
    newDeck: DeckCardConfig[]
  ) => void;

  updateSettings: (
    newSettings: Partial<RoomSettings>
  ) => void;

  startGame: () => void;

  submitAction: (
    action: GameAction
  ) => void;

  submitVote: (
    targetPlayerId: string
  ) => void;

  transferHost: (
    targetPlayerId: string
  ) => void;

  respondHostTransfer: (
    accept: boolean
  ) => void;

  addBotPlayer: () => void;
  addSmartBotPlayer: () => void;

  kickPlayer: (
    targetPlayerId: string
  ) => void;

  returnToLobby: () => void;

  restartWithSamePlayers: () => void;

  // Error & Notification
  error: string | null;
  clearError: () => void;

  activeTransferRequest:
    | HostTransferRequest
    | null;

  seerResultPopup:
    | {
        targetName: string;
        isWerewolf: boolean;
      }
    | null;

  clearSeerPopup: () => void;

  // Voice Chat
  voiceStates: Record<
    string,
    VoiceUserState
  >;

  isMyMicMuted: boolean;
  isMySpeaking: boolean;
  isMyDeafened: boolean;
  myAudioLevel: number;

  toggleMic: () => Promise<boolean>;
  toggleDeafen: () => boolean;

  isSilenced: boolean;

  // Cloud Server
  cloudServerAddress: string;

  setCloudServerAddress: (
    raw: string
  ) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

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
  // --------------------------------------------------------------------------
  // CONNECTION STATE
  // --------------------------------------------------------------------------

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

  const [
    seerResultPopup,
    setSeerResultPopup,
  ] = useState<{
    targetName: string;
    isWerewolf: boolean;
  } | null>(null);

  const [
    activeTransferRequest,
    setActiveTransferRequest,
  ] = useState<HostTransferRequest | null>(
    null
  );

  // --------------------------------------------------------------------------
  // VOICE STATE
  // --------------------------------------------------------------------------

  const [
    voiceStates,
    setVoiceStates,
  ] = useState<
    Record<string, VoiceUserState>
  >({});

  const [
    isMyMicMuted,
    setIsMyMicMuted,
  ] = useState(true);

  const [
    isMySpeaking,
    setIsMySpeaking,
  ] = useState(false);

  const [
    isMyDeafened,
    setIsMyDeafened,
  ] = useState(false);

  const [
    myAudioLevel,
    setMyAudioLevel,
  ] = useState(0);

  // --------------------------------------------------------------------------
  // REFS
  // --------------------------------------------------------------------------

  const lastChatTimeRef =
    useRef<number>(0);

  const socketRef =
    useRef<WebSocket | null>(null);

  const reconnectTimeoutRef =
    useRef<any>(null);

  const liveKitRoomRef =
    useRef<string | null>(null);

  const liveKitConnectingRef =
    useRef(false);

  const [cloudServerAddress, setCloudServerAddressState] =
    useState<string>(() =>
      getSavedServerRaw()
    );

  // --------------------------------------------------------------------------
  // BASIC DERIVED DATA
  // --------------------------------------------------------------------------

  const setNickname = (
    name: string
  ) => {
    setNicknameState(name);

    safeStorage.setItem(
      'werewolf_nickname',
      name
    );
  };

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
    currentRoom?.hostPlayerId ===
      playerId ||
    false;

  const isAlive =
    myPlayer
      ? myPlayer.isAlive
      : true;

  const isSilenced =
    !!myPlayer?.isSilenced;

  // --------------------------------------------------------------------------
  // ERROR HELPERS
  // --------------------------------------------------------------------------

  const clearError =
    useCallback(
      () => setError(null),
      []
    );

  const clearSeerPopup =
    useCallback(
      () =>
        setSeerResultPopup(null),
      []
    );

  // ==========================================================================
  // WEBSOCKET
  // ==========================================================================

  const sendWs =
    useCallback(
      (
        type: string,
        payload?: any
      ) => {
        if (
          socketRef.current &&
          socketRef.current.readyState ===
            WebSocket.OPEN
        ) {
          const msg: WsMessagePayload = {
            type: type as any,
            roomId:
              currentRoom?.id,
            playerId:
              playerId || undefined,
            sessionToken:
              sessionToken || undefined,
            payload,
          };

          try {
            socketRef.current.send(
              JSON.stringify(msg)
            );
          } catch (e) {
            console.warn(
              'WS send failed:',
              e
            );
          }
        }
      },
      [
        currentRoom?.id,
        playerId,
        sessionToken,
      ]
    );

  // ==========================================================================
  // LIVEKIT HELPERS
  // ==========================================================================

  /**
   * Tạm thời mute/unmute tất cả audio element
   * mà liveKitService đã attach vào document.
   */
  const applyDeafenState =
    useCallback(
      (deafened: boolean) => {
        const audioElements =
          document.querySelectorAll(
            'audio[data-livekit-participant]'
          );

        audioElements.forEach(
          (element) => {
            const audio =
              element as HTMLAudioElement;

            audio.muted = deafened;

            if (deafened) {
              audio.volume = 0;
            } else {
              audio.volume = 1;
            }
          }
        );
      },
      []
    );

  /**
   * Lấy token LiveKit từ server.
   *
   * Server cần cung cấp:
   *
   * POST /api/livekit/token
   *
   * body:
   * {
   *   roomName,
   *   identity
   * }
   *
   * response:
   * {
   *   token
   * }
   */
  const getLiveKitToken =
    useCallback(
      async (
        roomName: string,
        identity: string
      ): Promise<string | null> => {
        try {
          const response =
            await fetch(
              `${getApiBaseUrl()}/api/livekit/token`,
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  roomName,
                  identity,
                }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error ||
                'Không thể lấy LiveKit token.'
            );
          }

          if (!data?.token) {
            throw new Error(
              'Server không trả về LiveKit token.'
            );
          }

          return data.token;
        } catch (err) {
          console.error(
            '[LIVEKIT] Token error:',
            err
          );

          const message =
            err instanceof Error
              ? err.message
              : String(err);

          setError(
            `LiveKit: ${message}`
          );

          return null;
        }
      },
      []
    );

  /**
   * Lấy LiveKit server URL.
   *
   * Ưu tiên:
   *
   * VITE_LIVEKIT_URL
   *
   * Ví dụ:
   *
   * VITE_LIVEKIT_URL=wss://your-livekit-server
   */
  const getLiveKitUrl =
    useCallback((): string => {
      const envUrl = import.meta.env.VITE_LIVEKIT_URL;

      if (
        envUrl &&
        typeof envUrl === 'string'
      ) {
        return envUrl;
      }

      return '';
    }, []);

  // ==========================================================================
  // CONNECT LIVEKIT
  // ==========================================================================

  const connectLiveKit =
    useCallback(
      async (
        room: RoomData | null,
        currentPlayerId: string | null
      ) => {
        if (
          !room ||
          !currentPlayerId
        ) {
          return false;
        }

        if (
          liveKitConnectingRef.current
        ) {
          return false;
        }

        if (
          liveKitRoomRef.current ===
          room.id &&
          liveKitService.isConnected()
        ) {
          return true;
        }

        const liveKitUrl =
          getLiveKitUrl();

        if (!liveKitUrl) {
          console.warn(
            '[LIVEKIT] VITE_LIVEKIT_URL chưa được cấu hình.'
          );

          setError(
            'Chưa cấu hình VITE_LIVEKIT_URL cho LiveKit.'
          );

          return false;
        }

        liveKitConnectingRef.current =
          true;

        try {
          console.log(
            '[LIVEKIT] Connecting to room:',
            room.id
          );

          const token =
            await getLiveKitToken(
              room.id,
              currentPlayerId
            );

          if (!token) {
            return false;
          }

          // KHÔNG destroy LiveKit mỗi lần React chạy lại connectLiveKit().
          // destroy() trong lúc participant/track đang join hoặc publish có thể
          // làm room hiện tại bị ngắt và tạo race condition, đặc biệt khi người
          // chơi rời/vào lại phòng. Chỉ ngắt kết nối nếu service đang ở room khác.
          if (
            liveKitService.isConnected() &&
            liveKitRoomRef.current !== room.id
          ) {
            console.log(
              '[LIVEKIT] Switching voice room:',
              liveKitRoomRef.current,
              '->',
              room.id
            );

            await liveKitService.disconnect();
            liveKitRoomRef.current = null;
          }

          liveKitService.initialize(
            {
              url: liveKitUrl,
              token,
            },
            {
              onConnected: () => {
                console.log(
                  '[LIVEKIT] ✅ Connected to voice room:',
                  room.id
                );

                liveKitRoomRef.current =
                  room.id;
              },

              onDisconnected: (
                reason
              ) => {
                console.warn(
                  '[LIVEKIT] Disconnected:',
                  reason
                );

                if (
                  liveKitRoomRef.current ===
                  room.id
                ) {
                  liveKitRoomRef.current =
                    null;
                }

                setIsMyMicMuted(
                  true
                );
              },

              onParticipantConnected:
                (
                  participant
                ) => {
                  console.log(
                    '[LIVEKIT] Participant joined:',
                    participant.identity
                  );
                },

              onParticipantDisconnected:
                (
                  participant
                ) => {
                  console.log(
                    '[LIVEKIT] Participant left:',
                    participant.identity
                  );
                },

              onTrackSubscribed:
                (
                  track,
                  publication,
                  participant
                ) => {
                  console.log(
                    '[LIVEKIT] Remote track:',
                    {
                      kind:
                        track.kind,
                      participant:
                        participant.identity,
                      trackSid:
                        publication.trackSid,
                    }
                  );

                  if (
                    isMyDeafened
                  ) {
                    setTimeout(
                      () =>
                        applyDeafenState(
                          true
                        ),
                      50
                    );
                  }
                },

              onTrackUnsubscribed:
                (
                  track,
                  publication,
                  participant
                ) => {
                  console.log(
                    '[LIVEKIT] Remote track removed:',
                    {
                      kind:
                        track.kind,
                      participant:
                        participant.identity,
                      trackSid:
                        publication.trackSid,
                    }
                  );
                },

              onError: (
                err
              ) => {
                console.error(
                  '[LIVEKIT] Error:',
                  err
                );

                setError(
                  `LiveKit: ${err.message}`
                );
              },
            }
          );

          const connected =
            await liveKitService.connect();

          if (!connected) {
            return false;
          }

          /*
           * Không tự động mở mic.
           *
           * Mic mặc định:
           * MUTED
           *
           * Người chơi bấm nút mic
           * mới publish microphone.
           */
          setIsMyMicMuted(
            true
          );

          return true;
        } catch (err) {
          console.error(
            '[LIVEKIT] Connection failed:',
            err
          );

          const message =
            err instanceof Error
              ? err.message
              : String(err);

          setError(
            `Không thể kết nối voice: ${message}`
          );

          return false;
        } finally {
          liveKitConnectingRef.current =
            false;
        }
      },
      [
        getLiveKitUrl,
        getLiveKitToken,
        applyDeafenState,
        isMyDeafened,
      ]
    );

  // ==========================================================================
  // DISCONNECT LIVEKIT
  // ==========================================================================

  const disconnectLiveKit =
    useCallback(
      async () => {
        console.log(
          '[LIVEKIT] Disconnecting voice...'
        );

        try {
          await liveKitService.disconnect();
        } catch (err) {
          console.warn(
            '[LIVEKIT] Disconnect warning:',
            err
          );
        }

        liveKitRoomRef.current =
          null;

        setIsMyMicMuted(true);
        setIsMySpeaking(false);
        setMyAudioLevel(0);
      },
      []
    );

  // ==========================================================================
  // WEBSOCKET CONNECTION
  // ==========================================================================

  const connectSocket =
    useCallback(() => {
      if (
        socketRef.current &&
        (
          socketRef.current.readyState ===
            WebSocket.OPEN ||
          socketRef.current.readyState ===
            WebSocket.CONNECTING
        )
      ) {
        return;
      }

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

        ws.onopen = () => {
          console.log(
            '[WS] ✅ Connected'
          );

          setIsConnected(true);
          setIsConnecting(false);

          const savedRoomId =
            safeStorage.getItem(
              'werewolf_room_id'
            );

          const savedPlayerId =
            safeStorage.getItem(
              'werewolf_player_id'
            );

          const savedToken =
            safeStorage.getItem(
              'werewolf_session_token'
            );

          if (
            savedPlayerId &&
            savedRoomId
          ) {
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
                })
              );
            } catch (e) {
              console.warn(
                'Reconnect send failed:',
                e
              );
            }
          }
        };

        ws.onmessage = (
          event
        ) => {
          try {
            const data:
              WsMessagePayload =
              JSON.parse(
                event.data
              );

            switch (
              data.type
            ) {
              // --------------------------------------------------------------
              // AUTH
              // --------------------------------------------------------------

              case 'AUTH_SUCCESS':
                if (
                  data.payload
                    ?.playerId
                ) {
                  setPlayerId(
                    data.payload.playerId
                  );

                  safeStorage.setItem(
                    'werewolf_player_id',
                    data.payload.playerId
                  );
                }

                if (
                  data.payload
                    ?.sessionToken
                ) {
                  setSessionToken(
                    data.payload.sessionToken
                  );

                  safeStorage.setItem(
                    'werewolf_session_token',
                    data.payload.sessionToken
                  );
                }

                break;

              // --------------------------------------------------------------
              // ROOM
              // --------------------------------------------------------------

              case 'ROOM_STATE':
              case 'RECONNECT_STATE':
                if (
                  data.payload
                    ?.room
                ) {
                  const r:
                    RoomData =
                    data.payload.room;

                  setCurrentRoom(
                    r
                  );

                  safeStorage.setItem(
                    'werewolf_room_id',
                    r.id
                  );

                  if (
                    r.hostTransferRequest
                  ) {
                    if (
                      r.hostTransferRequest
                        .toPlayerId ===
                      playerId
                    ) {
                      setActiveTransferRequest(
                        r.hostTransferRequest
                      );
                    }
                  } else {
                    setActiveTransferRequest(
                      null
                    );
                  }
                }

                break;

              // --------------------------------------------------------------
              // PHASE
              // --------------------------------------------------------------

              case 'PHASE_CHANGED':
                if (
                  data.payload
                    ?.newPhase
                ) {
                  if (
                    data.payload
                      .newPhase ===
                    'NIGHT'
                  ) {
                    soundManager.playWolfHowl();
                  } else if (
                    data.payload
                      .newPhase ===
                      'DAY_ANNOUNCEMENT' ||
                    data.payload
                      .newPhase ===
                      'DAY_DISCUSSION'
                  ) {
                    soundManager.playMorningBell();
                  } else if (
                    data.payload
                      .newPhase ===
                    'VOTING'
                  ) {
                    soundManager.playGavelStrike();
                  } else if (
                    data.payload
                      .newPhase ===
                    'GAME_OVER'
                  ) {
                    soundManager.playVictory();
                  }
                }

                if (
                  data.payload?.room
                ) {
                  setCurrentRoom(
                    data.payload.room
                  );
                }

                break;

              // --------------------------------------------------------------
              // ROLE
              // --------------------------------------------------------------

              case 'ROLE_ASSIGNED':
                soundManager.playCardFlip();

                if (
                  data.payload?.room
                ) {
                  setCurrentRoom(
                    data.payload.room
                  );
                }

                break;

              // --------------------------------------------------------------
              // ACTION
              // --------------------------------------------------------------

              case 'ACTION_RESULT':
                if (
                  data.payload
                    ?.actionType ===
                  'SEER_CHECK'
                ) {
                  setSeerResultPopup(
                    {
                      targetName:
                        data.payload
                          .targetName ||
                        'Mục tiêu',

                      isWerewolf:
                        !!data.payload
                          .isWerewolf,
                    }
                  );
                }

                break;

              // --------------------------------------------------------------
              // CHAT
              // --------------------------------------------------------------

              case 'NEW_CHAT':
                if (
                  data.payload
                    ?.message
                ) {
                  const newMsg =
                    data.payload.message;

                  setChatMessages(
                    (prev) => {
                      if (
                        newMsg.id &&
                        prev.some(
                          (m) =>
                            m.id ===
                            newMsg.id
                        )
                      ) {
                        return prev;
                      }

                      return [
                        ...prev.slice(
                          -99
                        ),
                        newMsg,
                      ];
                    }
                  );
                }

                break;

              // --------------------------------------------------------------
              // HOST TRANSFER
              // --------------------------------------------------------------

              case 'HOST_TRANSFER_REQUEST':
                if (
                  data.payload
                    ?.request
                ) {
                  setActiveTransferRequest(
                    data.payload.request
                  );
                }

                break;

              // --------------------------------------------------------------
              // VOICE STATE
              //
              // Chỉ dùng WebSocket để đồng bộ:
              //
              // muted
              // speaking
              // deafened
              //
              // Không còn VOICE_SIGNAL.
              // --------------------------------------------------------------

              case 'VOICE_STATUS_UPDATE':
                if (
                  data.payload
                    ?.voiceStates
                ) {
                  setVoiceStates(
                    data.payload
                      .voiceStates
                  );
                }

                break;

              case 'VOICE_FORCE_MUTE_ALL':
                if (
                  liveKitService.isConnected()
                ) {
                  liveKitService
                    .disableMicrophone()
                    .catch(
                      (err) =>
                        console.warn(
                          '[LIVEKIT] Force mute failed:',
                          err
                        )
                    );
                }

                setIsMyMicMuted(
                  true
                );

                break;

              // --------------------------------------------------------------
              // ERROR
              // --------------------------------------------------------------

              case 'ERROR':
                setError(
                  data.payload
                    ?.message ||
                    'Có lỗi xảy ra từ máy chủ.'
                );

                break;

              default:
                break;
            }
          } catch (err) {
            console.error(
              'WS Parse error:',
              err
            );
          }
        };

        ws.onclose = () => {
          console.warn(
            '[WS] Connection closed'
          );

          setIsConnected(false);
          setIsConnecting(false);

          socketRef.current =
            null;

          reconnectTimeoutRef.current =
            setTimeout(() => {
              connectSocket();
            }, 3000);
        };

        ws.onerror = (
          event
        ) => {
          console.warn(
            '[WS] Error:',
            event
          );

          setIsConnected(false);
          setIsConnecting(false);
        };
      } catch (err) {
        console.warn(
          'Failed to establish WebSocket connection:',
          err
        );

        setIsConnecting(false);
        setIsConnected(false);
      }
    }, [playerId]);

  // ==========================================================================
  // CHANGE CLOUD SERVER
  // ==========================================================================

  const setCloudServerAddress =
    useCallback(
      (raw: string) => {
        const parsed =
          parseServerInput(
            raw
          );

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

        if (
          reconnectTimeoutRef.current
        ) {
          clearTimeout(
            reconnectTimeoutRef.current
          );
        }

        if (
          socketRef.current
        ) {
          try {
            socketRef.current.close();
          } catch {
            // ignore
          }

          socketRef.current =
            null;
        }

        // Ngắt LiveKit hiện tại
        disconnectLiveKit();

        safeStorage.removeItem(
          'werewolf_room_id'
        );

        safeStorage.removeItem(
          'werewolf_player_id'
        );

        safeStorage.removeItem(
          'werewolf_session_token'
        );

        setPlayerId(null);
        setSessionToken(null);
        setCurrentRoom(null);
        setChatMessages([]);
        setIsConnected(false);

        setTimeout(
          () => connectSocket(),
          50
        );
      },
      [
        connectSocket,
        disconnectLiveKit,
      ]
    );

  // ==========================================================================
  // LIVEKIT ROOM SYNCHRONIZATION
  // ==========================================================================

  useEffect(() => {
    if (
      !currentRoom ||
      !playerId
    ) {
      disconnectLiveKit();
      return;
    }

    connectLiveKit(
      currentRoom,
      playerId
    );
  }, [
    currentRoom?.id,
    playerId,
    connectLiveKit,
    disconnectLiveKit,
  ]);

  // ==========================================================================
  // CLEAN LIVEKIT WHEN PROVIDER UNMOUNTS
  // ==========================================================================

  useEffect(() => {
    return () => {
      disconnectLiveKit();
    };
  }, [
    disconnectLiveKit,
  ]);

  // ==========================================================================
  // NIGHT VOICE ACCESS
  // ==========================================================================
  // During the Werewolf step, only living werewolves may hear/speak. In every
  // other night step everyone is muted. The server enforces the same rule.
  useEffect(() => {
    if (!gameState || !currentRoom || !playerId) return;

    const isNight = gameState.currentPhase === 'NIGHT';
    const isWolfStep =
      isNight &&
      gameState.nightState?.currentStep === 'WEREWOLF_HUNT' &&
      !!myRole &&
      ROLES_DATABASE[myRole]?.team === 'WEREWOLF' &&
      !!myPlayer?.isAlive;

    const isRoleReveal = gameState.currentPhase === 'ROLE_REVEAL';
    const isHunterRevenge = gameState.currentPhase === 'HUNTER_REVENGE';
    const isDeathRebuttal = gameState.currentPhase === 'DEATH_REBUTTAL';
    const canDeathRebuttalTalk =
      isDeathRebuttal &&
      !myPlayer?.isAlive &&
      !!playerId &&
      (gameState.deathRebuttalPlayerIds || []).includes(playerId);

    if (isNight || isRoleReveal || isHunterRevenge) {
      const shouldMute = !isWolfStep;

      if (shouldMute && !isMyMicMuted && liveKitService.isConnected()) {
        liveKitService.disableMicrophone().then(() => {
          setIsMyMicMuted(true);
          setIsMySpeaking(false);
          sendWs('VOICE_STATUS_UPDATE', {
            isMuted: true,
            isSpeaking: false,
            isDeafened: isMyDeafened,
          });
        }).catch(() => {});
      } else if (shouldMute) {
        sendWs('VOICE_STATUS_UPDATE', {
          isMuted: true,
          isSpeaking: false,
          isDeafened: isMyDeafened,
        });
      }

      applyDeafenState(isNight && !isWolfStep);
    } else if (isDeathRebuttal) {
      if (!canDeathRebuttalTalk && !isMyMicMuted && liveKitService.isConnected()) {
        liveKitService.disableMicrophone().then(() => {
          setIsMyMicMuted(true);
          setIsMySpeaking(false);
        }).catch(() => {});
      }
      applyDeafenState(false);
    } else {
      applyDeafenState(isMyDeafened);
    }
  }, [
    gameState?.currentPhase,
    gameState?.nightState?.currentStep,
    myRole,
    myPlayer?.isAlive,
    playerId,
    currentRoom,
    isMyMicMuted,
    isMyDeafened,
    sendWs,
    applyDeafenState,
  ]);

  // ==========================================================================
  // SILENCE CURSE
  // ==========================================================================

  useEffect(() => {
    if (isSilenced) {
      liveKitService
        .disableMicrophone()
        .then(() => {
          setIsMyMicMuted(
            true
          );

          setIsMySpeaking(
            false
          );

          sendWs(
            'VOICE_STATUS_UPDATE',
            {
              isMuted: true,
              isSpeaking: false,
              isDeafened:
                isMyDeafened,
            }
          );
        })
        .catch((err) => {
          console.warn(
            '[LIVEKIT] Silence mute failed:',
            err
          );
        });

      soundManager.playSilenceCurseSound();
    }
  }, [
    isSilenced,
    isMyDeafened,
    sendWs,
  ]);

  // ==========================================================================
  // TOGGLE MIC
  // ==========================================================================

  const toggleMic =
    async (): Promise<boolean> => {
      const canDeathRebuttalTalk =
        gameState?.currentPhase === 'DEATH_REBUTTAL' &&
        !myPlayer?.isAlive &&
        !!playerId &&
        (gameState?.deathRebuttalPlayerIds || []).includes(playerId);

      const canWolfTalk =
        gameState?.currentPhase === 'NIGHT' &&
        gameState?.nightState?.currentStep === 'WEREWOLF_HUNT' &&
        !!myRole &&
        ROLES_DATABASE[myRole]?.team === 'WEREWOLF' &&
        !!myPlayer?.isAlive;

      if (
        (gameState?.currentPhase === 'NIGHT' && !canWolfTalk) ||
        (gameState?.currentPhase === 'DEATH_REBUTTAL' && !canDeathRebuttalTalk) ||
        gameState?.currentPhase === 'ROLE_REVEAL' ||
        gameState?.currentPhase === 'HUNTER_REVENGE'
      ) {
        setError(
          gameState?.currentPhase === 'DEATH_REBUTTAL'
            ? '⚰️ Chỉ người vừa chết mới được mở mic trong 30 giây phản biện.'
            : '🌙 Hiện tại chỉ Ma Sói được phép mở mic và nghe thảo luận của bầy.'
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
        gameState.currentPhase !==
          'LOBBY' &&
        gameState.currentPhase !==
          'GAME_OVER'
      ) {
        setError(
          '👻 Linh hồn người đã chết không thể mở mic nói chuyện với người sống.'
        );

        return false;
      }

      if (
        !liveKitService.isConnected()
      ) {
        if (
          currentRoom &&
          playerId
        ) {
          const connected =
            await connectLiveKit(
              currentRoom,
              playerId
            );

          if (!connected) {
            setError(
              'Không thể kết nối hệ thống voice.'
            );

            return false;
          }
        } else {
          setError(
            'Chưa kết nối phòng voice.'
          );

          return false;
        }
      }

      try {
        // ------------------------------------------------------------
        // Đang bật mic -> tắt
        // ------------------------------------------------------------

        if (
          !isMyMicMuted
        ) {
          const success =
            await liveKitService
              .disableMicrophone();

          if (!success) {
            return false;
          }

          setIsMyMicMuted(
            true
          );

          setIsMySpeaking(
            false
          );

          setMyAudioLevel(
            0
          );

          sendWs(
            'VOICE_STATUS_UPDATE',
            {
              isMuted: true,
              isSpeaking: false,
              isDeafened:
                isMyDeafened,
            }
          );

          return false;
        }

        // ------------------------------------------------------------
        // Đang tắt mic -> bật
        // ------------------------------------------------------------

        const success =
          await liveKitService
            .enableMicrophone();

        if (!success) {
          return false;
        }

        setIsMyMicMuted(
          false
        );

        setIsMySpeaking(
          false
        );

        sendWs(
          'VOICE_STATUS_UPDATE',
          {
            isMuted: false,
            isSpeaking: false,
            isDeafened:
              isMyDeafened,
          }
        );

        return true;
      } catch (err) {
        console.error(
          '[LIVEKIT] Toggle mic error:',
          err
        );

        const message =
          err instanceof Error
            ? err.message
            : String(err);

        setError(
          `Không thể bật microphone: ${message}`
        );

        return false;
      }
    };

  // ==========================================================================
  // TOGGLE DEAFEN
  // ==========================================================================

  const toggleDeafen =
    (): boolean => {
      const nextState =
        !isMyDeafened;

      setIsMyDeafened(
        nextState
      );

      applyDeafenState(
        nextState
      );

      sendWs(
        'VOICE_STATUS_UPDATE',
        {
          isMuted:
            isMyMicMuted,
          isSpeaking:
            false,
          isDeafened:
            nextState,
        }
      );

      return nextState;
    };

  // ==========================================================================
  // WEBSOCKET INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    connectSocket();

    return () => {
      if (
        reconnectTimeoutRef.current
      ) {
        clearTimeout(
          reconnectTimeoutRef.current
        );
      }

      if (
        socketRef.current
      ) {
        try {
          socketRef.current.close();
        } catch {
          // ignore
        }
      }

      disconnectLiveKit();
    };
  }, [
    connectSocket,
    disconnectLiveKit,
  ]);

  // ==========================================================================
  // CREATE ROOM
  // ==========================================================================

  const createRoom =
    async (
      pName: string,
      settings?: Partial<RoomSettings>
    ): Promise<string> => {
      setNickname(pName);

      const res =
        await fetch(
          `${getApiBaseUrl()}/api/room/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              nickname:
                pName,
              settings,
            }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            'Không thể tạo phòng.'
        );

        throw new Error(
          data.error
        );
      }

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

      sendWs(
        'AUTH',
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

  const joinRoom =
    async (
      roomCode: string,
      pName: string
    ): Promise<boolean> => {
      setNickname(pName);

      const res =
        await fetch(
          `${getApiBaseUrl()}/api/room/join`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              code: roomCode
                .trim()
                .toUpperCase(),

              nickname:
                pName,
            }),
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            'Không thể vào phòng.'
        );

        return false;
      }

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

      sendWs(
        'AUTH',
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

  const leaveRoom =
    () => {
      sendWs(
        'PLAYER_LEFT'
      );

      safeStorage.removeItem(
        'werewolf_room_id'
      );

      disconnectLiveKit();

      setCurrentRoom(
        null
      );

      setChatMessages(
        []
      );

      setVoiceStates(
        {}
      );

      setIsMyMicMuted(
        true
      );

      setIsMySpeaking(
        false
      );

      setIsMyDeafened(
        false
      );

      setMyAudioLevel(
        0
      );
    };

  // ==========================================================================
  // UPDATE DECK
  // ==========================================================================

  const updateDeck =
    (
      newDeck: DeckCardConfig[]
    ) => {
      sendWs(
        'DECK_UPDATED',
        {
          deck: newDeck,
        }
      );
    };

  // ==========================================================================
  // UPDATE SETTINGS
  // ==========================================================================

  const updateSettings =
    (
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

  // ==========================================================================
  // START GAME
  // ==========================================================================

  const startGame =
    () => {
      sendWs(
        'GAME_START_REQUEST'
      );
    };

  // ==========================================================================
  // SUBMIT ACTION
  // ==========================================================================

  const submitAction =
    (
      action: GameAction
    ) => {
      sendWs(
        'ACTION_SUBMIT',
        action
      );
    };

  // ==========================================================================
  // SUBMIT VOTE
  // ==========================================================================

  const submitVote =
    (
      targetPlayerId: string
    ) => {
      sendWs(
        'VOTE_SUBMIT',
        {
          targetPlayerId,
        }
      );
    };

  // ==========================================================================
  // TRANSFER HOST
  // ==========================================================================

  const transferHost =
    (
      targetPlayerId: string
    ) => {
      sendWs(
        'HOST_TRANSFER_REQUEST',
        {
          targetPlayerId,
        }
      );
    };

  // ==========================================================================
  // RESPOND HOST TRANSFER
  // ==========================================================================

  const respondHostTransfer =
    (
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

  // ==========================================================================
  // ADD BOT
  // ==========================================================================

  const addBotPlayer =
    () => {
      sendWs(
        'ADD_BOT_REQUEST'
      );
    };

  const addSmartBotPlayer =
    () => {
      sendWs(
        'ADD_SMART_BOT_REQUEST'
      );
    };

  // ==========================================================================
  // KICK PLAYER
  // ==========================================================================

  const kickPlayer =
    (
      targetPlayerId: string
    ) => {
      sendWs(
        'KICK_PLAYER_REQUEST',
        {
          targetPlayerId,
        }
      );
    };

  // ==========================================================================
  // RETURN TO LOBBY
  // ==========================================================================

  const returnToLobby =
    () => {
      sendWs(
        'RETURN_TO_LOBBY'
      );
    };

  // ==========================================================================
  // RESTART GAME
  // ==========================================================================

  const restartWithSamePlayers =
    () => {
      sendWs(
        'GAME_START_REQUEST'
      );
    };

  // ==========================================================================
  // SEND CHAT
  // ==========================================================================

  const sendChat =
    (
      text: string,
      channel:
        | 'LOBBY'
        | 'DAY_PUBLIC'
        | 'GHOST_PRIVATE'
        | 'WOLF_PRIVATE' =
        'LOBBY'
    ) => {
      const trimmed =
        text.trim();

      if (!trimmed) {
        return;
      }

      const now =
        Date.now();

      const COOLDOWN_MS =
        4000;

      if (
        now -
          lastChatTimeRef.current <
        COOLDOWN_MS
      ) {
        const remaining =
          Math.ceil(
            (
              COOLDOWN_MS -
              (
                now -
                lastChatTimeRef.current
              )
            ) / 1000
          );

        setError(
          `⏱️ Vui lòng chờ ${remaining} giây trước khi gửi tin nhắn tiếp theo.`
        );

        return;
      }

      lastChatTimeRef.current =
        now;

      sendWs(
        'CHAT_MESSAGE',
        {
          text: trimmed,
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
        // --------------------------------------------------------------
        // Connection
        // --------------------------------------------------------------

        isConnected,
        isConnecting,

        playerId,
        nickname,
        sessionToken,

        setNickname,

        // --------------------------------------------------------------
        // Game
        // --------------------------------------------------------------

        currentRoom,
        gameState,
        myPlayer,
        myRole,

        isHost,
        isAlive,

        // --------------------------------------------------------------
        // Chat
        // --------------------------------------------------------------

        chatMessages,
        sendChat,

        // --------------------------------------------------------------
        // Actions
        // --------------------------------------------------------------

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
        addSmartBotPlayer,
        kickPlayer,

        returnToLobby,
        restartWithSamePlayers,

        // --------------------------------------------------------------
        // Error
        // --------------------------------------------------------------

        error,
        clearError,

        activeTransferRequest,

        seerResultPopup,
        clearSeerPopup,

        // --------------------------------------------------------------
        // Voice
        // --------------------------------------------------------------

        voiceStates,

        isMyMicMuted,
        isMySpeaking,
        isMyDeafened,
        myAudioLevel,

        toggleMic,
        toggleDeafen,

        isSilenced,

        // --------------------------------------------------------------
        // Cloud server
        // --------------------------------------------------------------

        cloudServerAddress,
        setCloudServerAddress,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// ============================================================================
// useGame
// ============================================================================

export const useGame =
  () => {
    const context =
      useContext(
        GameContext
      );

    if (!context) {
      throw new Error(
        'useGame must be used within a GameProvider'
      );
    }

    return context;
  };