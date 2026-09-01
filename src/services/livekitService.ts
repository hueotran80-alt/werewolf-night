import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  Track,
} from 'livekit-client';

export interface LiveKitConfig {
  url: string;
  token: string;
}

export interface LiveKitCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;

  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;

  onTrackSubscribed?: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => void;

  onTrackUnsubscribed?: (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => void;

  onError?: (error: Error) => void;
}

/**
 * LiveKit voice service
 *
 * Kiến trúc mới:
 *
 * Browser / Android
 *       ↓
 *   LiveKit Room
 *       ↓
 *   Audio Track
 *
 * Không tự quản lý:
 * - RTCPeerConnection
 * - ICE candidate
 * - STUN
 * - TURN
 *
 * LiveKit sẽ xử lý phần WebRTC transport.
 */
class LiveKitService {
  private room: Room | null = null;

  private config: LiveKitConfig | null = null;

  private callbacks: LiveKitCallbacks = {};

  private connected = false;

  private microphoneEnabled = false;

  private remoteAudioElements = new Map<string, HTMLAudioElement>();

  /**
   * Khởi tạo service
   */
  initialize(
    config: LiveKitConfig,
    callbacks: LiveKitCallbacks = {}
  ) {
    this.config = config;
    this.callbacks = callbacks;

    console.log('[LIVEKIT] ========================================');
    console.log('[LIVEKIT] Initializing');
    console.log('[LIVEKIT] URL:', config.url);
    console.log(
      '[LIVEKIT] Token:',
      config.token ? `${config.token.substring(0, 20)}...` : '(empty)'
    );
    console.log('[LIVEKIT] ========================================');
  }

  /**
   * Kết nối vào LiveKit room
   */
  async connect(): Promise<boolean> {
    if (!this.config) {
      const error = new Error(
        'LiveKit chưa được initialize. Hãy gọi initialize() trước.'
      );

      console.error('[LIVEKIT] ❌', error);
      this.callbacks.onError?.(error);

      return false;
    }

    if (this.connected && this.room) {
      console.log('[LIVEKIT] Already connected');
      return true;
    }

    try {
      console.log('[LIVEKIT] Connecting...');
      console.log('[LIVEKIT] Server:', this.config.url);

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.registerRoomEvents();

      await this.room.connect(
        this.config.url,
        this.config.token
      );

      this.connected = true;

      console.log('[LIVEKIT] ✅ Connected');
      console.log(
        '[LIVEKIT] Room:',
        this.room.name
      );

      console.log(
        '[LIVEKIT] Local participant:',
        this.room.localParticipant.identity
      );

      this.callbacks.onConnected?.();

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT] ❌ Connection failed:',
        error
      );

      this.connected = false;

      const err =
        error instanceof Error
          ? error
          : new Error(String(error));

      this.callbacks.onError?.(err);

      return false;
    }
  }

  /**
   * Đăng ký các event của LiveKit Room
   */
  private registerRoomEvents() {
    if (!this.room) return;

    this.room.on(
      RoomEvent.Connected,
      () => {
        console.log(
          '[LIVEKIT][ROOM] Connected'
        );
      }
    );

    this.room.on(
      RoomEvent.Disconnected,
      (reason) => {
        console.log(
          '[LIVEKIT][ROOM] Disconnected:',
          reason
        );

        this.connected = false;

        this.callbacks.onDisconnected?.(
          reason ? String(reason) : undefined
        );
      }
    );

    this.room.on(
      RoomEvent.ParticipantConnected,
      (participant) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] Connected:',
          participant.identity
        );

        this.callbacks.onParticipantConnected?.(
          participant
        );
      }
    );

    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (participant) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] Disconnected:',
          participant.identity
        );

        this.removeRemoteAudio(
          participant.identity
        );

        this.callbacks.onParticipantDisconnected?.(
          participant
        );
      }
    );

    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track,
        publication,
        participant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] Subscribed:',
          {
            kind: track.kind,
            participant:
              participant.identity,
            trackSid: publication.trackSid,
          }
        );

        if (track.kind === Track.Kind.Audio) {
          this.attachRemoteAudio(
            track,
            participant
          );
        }

        this.callbacks.onTrackSubscribed?.(
          track,
          publication,
          participant
        );
      }
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track,
        publication,
        participant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] Unsubscribed:',
          {
            kind: track.kind,
            participant:
              participant.identity,
            trackSid: publication.trackSid,
          }
        );

        if (track.kind === Track.Kind.Audio) {
          this.removeRemoteAudio(
            participant.identity
          );
        }

        this.callbacks.onTrackUnsubscribed?.(
          track,
          publication,
          participant
        );
      }
    );

    this.room.on(
      RoomEvent.LocalTrackPublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] Published:',
          {
            kind: publication.kind,
            trackSid: publication.trackSid,
          }
        );
      }
    );

    this.room.on(
      RoomEvent.LocalTrackUnpublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] Unpublished:',
          {
            kind: publication.kind,
            trackSid: publication.trackSid,
          }
        );
      }
    );

    this.room.on(
      RoomEvent.ConnectionStateChanged,
      (state) => {
        console.log(
          '[LIVEKIT][CONNECTION]',
          state
        );
      }
    );
  }

  /**
   * Bật microphone
   */
  async enableMicrophone(): Promise<boolean> {
    if (!this.room) {
      console.error(
        '[LIVEKIT][MIC] ❌ Room chưa kết nối'
      );

      return false;
    }

    try {
      console.log(
        '[LIVEKIT][MIC] Requesting microphone...'
      );

      await this.room.localParticipant.setMicrophoneEnabled(
        true
      );

      this.microphoneEnabled = true;

      console.log(
        '[LIVEKIT][MIC] ✅ Microphone enabled'
      );

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT][MIC] ❌ Failed:',
        error
      );

      const err =
        error instanceof Error
          ? error
          : new Error(String(error));

      this.callbacks.onError?.(err);

      return false;
    }
  }

  /**
   * Tắt microphone
   */
  async disableMicrophone(): Promise<boolean> {
    if (!this.room) {
      return false;
    }

    try {
      await this.room.localParticipant.setMicrophoneEnabled(
        false
      );

      this.microphoneEnabled = false;

      console.log(
        '[LIVEKIT][MIC] 🔇 Microphone disabled'
      );

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT][MIC] ❌ Disable failed:',
        error
      );

      return false;
    }
  }

  /**
   * Toggle microphone
   */
  async toggleMicrophone(): Promise<boolean> {
    if (this.microphoneEnabled) {
      return this.disableMicrophone();
    }

    return this.enableMicrophone();
  }

  /**
   * Kiểm tra microphone hiện tại
   */
  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }

  /**
   * Lấy local participant
   */
  getLocalParticipant(): LocalParticipant | null {
    return this.room?.localParticipant ?? null;
  }

  /**
   * Lấy Room
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Kiểm tra kết nối
   */
  isConnected(): boolean {
    return this.connected && !!this.room;
  }

  /**
   * Gắn audio của người chơi khác vào HTMLAudioElement
   */
  private attachRemoteAudio(
    track: RemoteTrack,
    participant: RemoteParticipant
  ) {
    if (track.kind !== Track.Kind.Audio) {
      return;
    }

    try {
      this.removeRemoteAudio(
        participant.identity
      );

      const audioElement =
        track.attach() as HTMLAudioElement;

      audioElement.autoplay = true;
      audioElement.controls = false;
      audioElement.playsInline = true;

      audioElement.volume = 1;

      audioElement.dataset.livekitParticipant =
        participant.identity;

      document.body.appendChild(
        audioElement
      );

      this.remoteAudioElements.set(
        participant.identity,
        audioElement
      );

      console.log(
        '[LIVEKIT][AUDIO] 🔊 Remote audio attached:',
        participant.identity
      );

      audioElement
        .play()
        .then(() => {
          console.log(
            '[LIVEKIT][AUDIO] ▶️ Playback started:',
            participant.identity
          );
        })
        .catch((error) => {
          console.warn(
            '[LIVEKIT][AUDIO] ⚠️ Autoplay blocked:',
            error
          );
        });
    } catch (error) {
      console.error(
        '[LIVEKIT][AUDIO] ❌ Attach failed:',
        error
      );
    }
  }

  /**
   * Xóa audio của participant
   */
  private removeRemoteAudio(
    participantIdentity: string
  ) {
    const element =
      this.remoteAudioElements.get(
        participantIdentity
      );

    if (!element) {
      return;
    }

    try {
      element.pause();
      element.srcObject = null;
      element.remove();
    } catch {
      // ignore
    }

    this.remoteAudioElements.delete(
      participantIdentity
    );

    console.log(
      '[LIVEKIT][AUDIO] Removed:',
      participantIdentity
    );
  }

  /**
   * Ngắt kết nối LiveKit
   */
  async disconnect() {
    console.log(
      '[LIVEKIT] Disconnecting...'
    );

    for (const [
      participantIdentity,
      element,
    ] of this.remoteAudioElements) {
      try {
        element.pause();
        element.srcObject = null;
        element.remove();
      } catch {
        // ignore
      }

      console.log(
        '[LIVEKIT][AUDIO] Removed:',
        participantIdentity
      );
    }

    this.remoteAudioElements.clear();

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (error) {
        console.warn(
          '[LIVEKIT] Disconnect warning:',
          error
        );
      }
    }

    this.room = null;
    this.connected = false;
    this.microphoneEnabled = false;

    console.log(
      '[LIVEKIT] ✅ Disconnected'
    );
  }

  /**
   * Cleanup toàn bộ service
   */
  async destroy() {
    await this.disconnect();

    this.config = null;
    this.callbacks = {};

    console.log(
      '[LIVEKIT] Destroyed'
    );
  }
}

export const liveKitService =
  new LiveKitService();

export default liveKitService;