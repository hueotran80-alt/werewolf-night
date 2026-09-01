import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  Track,
  ConnectionState,
  LocalAudioTrack,
  RemoteAudioTrack,
} from 'livekit-client';

export interface LiveKitConfig {
  url: string;
  token: string;
}

export interface LiveKitCallbacks {
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;

  onParticipantConnected?: (
    participant: RemoteParticipant
  ) => void;

  onParticipantDisconnected?: (
    participant: RemoteParticipant
  ) => void;

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
 * LiveKit Voice Service
 *
 * Kiến trúc:
 *
 * Microphone
 *     ↓
 * LocalAudioTrack
 *     ↓
 * LiveKit
 *     ↓
 * RemoteAudioTrack
 *     ↓
 * HTMLAudioElement
 *
 * Không tự xử lý:
 * - RTCPeerConnection
 * - SDP
 * - ICE candidate
 * - STUN
 * - TURN
 */

class LiveKitService {
  private room: Room | null = null;

  private config: LiveKitConfig | null = null;

  private callbacks: LiveKitCallbacks = {};

  private connected = false;

  private microphoneEnabled = false;

  private connecting = false;

  private remoteAudioElements =
    new Map<string, HTMLAudioElement>();

  private remoteAudioTracks =
    new Map<string, RemoteAudioTrack>();

  /**
   * Khởi tạo service
   */
  initialize(
    config: LiveKitConfig,
    callbacks: LiveKitCallbacks = {}
  ) {
    this.config = config;
    this.callbacks = callbacks;

    console.log(
      '[LIVEKIT] ========================================'
    );

    console.log(
      '[LIVEKIT] Initializing'
    );

    console.log(
      '[LIVEKIT] URL:',
      config.url
    );

    console.log(
      '[LIVEKIT] Token:',
      config.token
        ? `${config.token.substring(0, 20)}...`
        : '(empty)'
    );

    console.log(
      '[LIVEKIT] ========================================'
    );
  }

  /**
   * Kết nối LiveKit
   */
  async connect(): Promise<boolean> {
    if (!this.config) {
      const error = new Error(
        'LiveKit chưa được initialize.'
      );

      console.error(
        '[LIVEKIT] ❌',
        error
      );

      this.callbacks.onError?.(error);

      return false;
    }

    if (
      this.connected &&
      this.room
    ) {
      console.log(
        '[LIVEKIT] Already connected'
      );

      return true;
    }

    if (this.connecting) {
      console.log(
        '[LIVEKIT] Connection already in progress'
      );

      return false;
    }

    this.connecting = true;

    try {
      console.log(
        '[LIVEKIT] ========================================'
      );

      console.log(
        '[LIVEKIT] Connecting...'
      );

      console.log(
        '[LIVEKIT] Server:',
        this.config.url
      );

      /**
       * Cấu hình Room
       *
       * adaptiveStream:
       * LiveKit tự điều chỉnh stream.
       *
       * dynacast:
       * Giúp tối ưu bandwidth.
       */
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,

        // Giữ kết nối ổn định hơn khi mạng thay đổi.
        disconnectOnPageLeave: false,
      });

      this.registerRoomEvents();

      await this.room.connect(
        this.config.url,
        this.config.token,
        {
          autoSubscribe: true,
        }
      );

      this.connected = true;

      console.log(
        '[LIVEKIT] ✅ Connected'
      );

      console.log(
        '[LIVEKIT] Room:',
        this.room.name
      );

      console.log(
        '[LIVEKIT] Local participant:',
        this.room.localParticipant.identity
      );

      /**
       * Kiểm tra participant đã có sẵn
       *
       * Trường hợp:
       * Máy B vào sau máy A.
       *
       * Máy A đã publish microphone.
       *
       * Khi B connect, phải kiểm tra các
       * participant hiện tại.
       */
      this.processExistingParticipants();

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
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Xử lý participant đã tồn tại khi vừa join room
   */
  private processExistingParticipants() {
    if (!this.room) {
      return;
    }

    console.log(
      '[LIVEKIT][ROOM] Existing participants:',
      this.room.remoteParticipants.size
    );

    this.room.remoteParticipants.forEach(
      (participant) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] Existing:',
          participant.identity
        );

        participant.trackPublications.forEach(
          (publication) => {
            if (
              publication.kind !== Track.Kind.Audio
            ) {
              return;
            }

            console.log(
              '[LIVEKIT][TRACK] Existing audio publication:',
              {
                participant:
                  participant.identity,
                trackSid:
                  publication.trackSid,
                subscribed:
                  publication.isSubscribed,
              }
            );

            if (
              publication.isSubscribed &&
              publication.track
            ) {
              const track =
                publication.track;

              if (
                track.kind ===
                Track.Kind.Audio
              ) {
                this.attachRemoteAudio(
                  track,
                  participant
                );
              }
            }
          }
        );
      }
    );
  }

  /**
   * Đăng ký Room events
   */
  private registerRoomEvents() {
    if (!this.room) {
      return;
    }

    /**
     * Connected
     */
    this.room.on(
      RoomEvent.Connected,
      () => {
        console.log(
          '[LIVEKIT][ROOM] Connected'
        );
      }
    );

    /**
     * Disconnected
     */
    this.room.on(
      RoomEvent.Disconnected,
      (reason) => {
        console.log(
          '[LIVEKIT][ROOM] Disconnected:',
          reason
        );

        this.connected = false;

        this.callbacks.onDisconnected?.(
          reason
            ? String(reason)
            : undefined
        );
      }
    );

    /**
     * Participant connected
     */
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

    /**
     * Participant disconnected
     */
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

    /**
     * Track subscribed
     *
     * Đây là event quan trọng nhất
     * đối với việc nghe người khác.
     */
    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track,
        publication,
        participant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] ✅ Subscribed:',
          {
            kind: track.kind,
            participant:
              participant.identity,
            trackSid:
              publication.trackSid,
            muted:
              track.isMuted,
          }
        );

        if (
          track.kind ===
          Track.Kind.Audio
        ) {
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

    /**
     * Track unsubscribed
     */
    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track,
        publication,
        participant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] ❌ Unsubscribed:',
          {
            kind: track.kind,
            participant:
              participant.identity,
            trackSid:
              publication.trackSid,
          }
        );

        if (
          track.kind ===
          Track.Kind.Audio
        ) {
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

    /**
     * Local track published
     */
    this.room.on(
      RoomEvent.LocalTrackPublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] ✅ Published:',
          {
            kind: publication.kind,
            trackSid:
              publication.trackSid,
          }
        );

        if (
          publication.kind ===
          Track.Kind.Audio
        ) {
          console.log(
            '[LIVEKIT][MIC] Local audio published'
          );
        }
      }
    );

    /**
     * Local track unpublished
     */
    this.room.on(
      RoomEvent.LocalTrackUnpublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] Unpublished:',
          {
            kind: publication.kind,
            trackSid:
              publication.trackSid,
          }
        );
      }
    );

    /**
     * Connection state
     */
    this.room.on(
      RoomEvent.ConnectionStateChanged,
      (state) => {
        console.log(
          '[LIVEKIT][CONNECTION] State:',
          state
        );

        if (
          state ===
          ConnectionState.Connected
        ) {
          this.connected = true;
        }

        if (
          state ===
          ConnectionState.Disconnected
        ) {
          this.connected = false;
        }
      }
    );

    /**
     * Reconnecting
     */
    this.room.on(
      RoomEvent.Reconnecting,
      () => {
        console.warn(
          '[LIVEKIT][CONNECTION] ⚠️ Reconnecting...'
        );
      }
    );

    /**
     * Reconnected
     */
    this.room.on(
      RoomEvent.Reconnected,
      () => {
        console.log(
          '[LIVEKIT][CONNECTION] ✅ Reconnected'
        );

        this.connected = true;

        /**
         * Kiểm tra lại audio sau reconnect.
         */
        this.processExistingParticipants();
      }
    );

    /**
     * Audio playback status
     */
    this.room.on(
      RoomEvent.AudioPlaybackStatusChanged,
      () => {
        console.log(
          '[LIVEKIT][AUDIO] Playback status changed:',
          this.room?.canPlaybackAudio
        );
      }
    );
  }

  /**
   * Bật microphone
   *
   * Quan trọng:
   * Chủ động bật:
   *
   * echoCancellation
   * noiseSuppression
   * autoGainControl
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
        '[LIVEKIT][MIC] ========================================'
      );

      console.log(
        '[LIVEKIT][MIC] Enabling microphone...'
      );

      /**
       * LiveKit sẽ tạo LocalAudioTrack
       * với các constraint này.
       */
      await this.room.localParticipant.setMicrophoneEnabled(
        true,
        {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,

          channelCount: 1,

          sampleRate: 48000,
        }
      );

      this.microphoneEnabled = true;

      /**
       * Kiểm tra track thực tế
       */
      const publication =
        this.room.localParticipant
          .getTrackPublication(
            Track.Source.Microphone
          );

      if (publication) {
        console.log(
          '[LIVEKIT][MIC] Publication:',
          {
            trackSid:
              publication.trackSid,
            muted:
              publication.isMuted,
            subscribed:
              publication.isSubscribed,
            kind:
              publication.kind,
          }
        );
      }

      console.log(
        '[LIVEKIT][MIC] ✅ Microphone enabled'
      );

      console.log(
        '[LIVEKIT][MIC] ========================================'
      );

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT][MIC] ❌ Failed:',
        error
      );

      this.microphoneEnabled = false;

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
      console.log(
        '[LIVEKIT][MIC] Disabling microphone...'
      );

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
    console.log(
      '[LIVEKIT][MIC] toggle:',
      this.microphoneEnabled
    );

    if (this.microphoneEnabled) {
      return this.disableMicrophone();
    }

    return this.enableMicrophone();
  }

  /**
   * Kiểm tra microphone
   */
  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }

  /**
   * Lấy local participant
   */
  getLocalParticipant():
    LocalParticipant | null {
    return (
      this.room?.localParticipant ??
      null
    );
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
    return (
      this.connected &&
      !!this.room
    );
  }

  /**
   * Gắn remote audio
   */
  private attachRemoteAudio(
    track: RemoteTrack,
    participant: RemoteParticipant
  ) {
    if (
      track.kind !==
      Track.Kind.Audio
    ) {
      return;
    }

    const identity =
      participant.identity;

    try {
      console.log(
        '[LIVEKIT][AUDIO] Attaching:',
        identity
      );

      /**
       * Không tạo 2 audio element
       * cho cùng một participant.
       */
      this.removeRemoteAudio(
        identity
      );

      const audioElement =
        track.attach() as HTMLAudioElement;

      audioElement.autoplay = true;

      audioElement.controls = false;

      audioElement.playsInline = true;

      /**
       * Không mute remote audio.
       */
      audioElement.muted = false;

      audioElement.volume = 1;

      audioElement.setAttribute(
        'playsinline',
        ''
      );

      audioElement.setAttribute(
        'autoplay',
        ''
      );

      audioElement.dataset.livekitParticipant =
        identity;

      /**
       * Ẩn audio element.
       *
       * Không dùng display:none vì một số
       * browser/WebView có thể xử lý media
       * khác khi element bị display:none.
       */
      audioElement.style.position =
        'fixed';

      audioElement.style.width =
        '1px';

      audioElement.style.height =
        '1px';

      audioElement.style.opacity =
        '0';

      audioElement.style.pointerEvents =
        'none';

      audioElement.style.left =
        '-10000px';

      document.body.appendChild(
        audioElement
      );

      this.remoteAudioElements.set(
        identity,
        audioElement
      );

      /**
       * Lưu track
       */
      if (
        track instanceof
        RemoteAudioTrack
      ) {
        this.remoteAudioTracks.set(
          identity,
          track
        );
      }

      console.log(
        '[LIVEKIT][AUDIO] 🔊 Remote audio attached:',
        {
          participant: identity,
          readyState:
            audioElement.readyState,
          volume:
            audioElement.volume,
          muted:
            audioElement.muted,
        }
      );

      /**
       * Thử playback.
       */
      audioElement
        .play()
        .then(() => {
          console.log(
            '[LIVEKIT][AUDIO] ▶️ Playback started:',
            identity
          );
        })
        .catch((error) => {
          console.warn(
            '[LIVEKIT][AUDIO] ⚠️ Playback blocked:',
            {
              participant: identity,
              error,
            }
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
   * Xóa remote audio
   */
  private removeRemoteAudio(
    participantIdentity: string
  ) {
    const element =
      this.remoteAudioElements.get(
        participantIdentity
      );

    if (element) {
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
    }

    this.remoteAudioTracks.delete(
      participantIdentity
    );

    console.log(
      '[LIVEKIT][AUDIO] Removed:',
      participantIdentity
    );
  }

  /**
   * Ngắt kết nối
   */
  async disconnect() {
    console.log(
      '[LIVEKIT] Disconnecting...'
    );

    /**
     * Xóa remote audio.
     */
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

    this.remoteAudioTracks.clear();

    /**
     * Disconnect room.
     */
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

    this.connecting = false;

    this.microphoneEnabled = false;

    console.log(
      '[LIVEKIT] ✅ Disconnected'
    );
  }

  /**
   * Cleanup toàn bộ service
   */
  async destroy() {
    console.log(
      '[LIVEKIT] Destroying...'
    );

    await this.disconnect();

    this.config = null;

    this.callbacks = {};

    console.log(
      '[LIVEKIT] ✅ Destroyed'
    );
  }
}

export const liveKitService =
  new LiveKitService();

export default liveKitService;