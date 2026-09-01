import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  Track,
  ConnectionState,
  DisconnectReason,
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

class LiveKitService {
  private room: Room | null = null;

  private config: LiveKitConfig | null = null;

  private callbacks: LiveKitCallbacks = {};

  private connected = false;

  private microphoneEnabled = false;

  private remoteAudioElements =
    new Map<string, HTMLAudioElement>();

  /**
   * ========================================
   * INITIALIZE
   * ========================================
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
      '[LIVEKIT] Initializing LiveKit Service'
    );

    console.log(
      '[LIVEKIT] Server:',
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
   * ========================================
   * CONNECT
   * ========================================
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

    try {
      console.log(
        '[LIVEKIT] ========================================'
      );

      console.log(
        '[LIVEKIT] Connecting...'
      );

      console.log(
        '[LIVEKIT] URL:',
        this.config.url
      );

      /**
       * Audio configuration
       *
       * Quan trọng:
       * - Echo cancellation
       * - Noise suppression
       * - Auto gain control
       * - Mono microphone
       */

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,

        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      console.log(
        '[LIVEKIT] Room created'
      );

      this.registerRoomEvents();

      await this.room.connect(
        this.config.url,
        this.config.token
      );

      this.connected = true;

      console.log(
        '[LIVEKIT] ✅ CONNECTED'
      );

      console.log(
        '[LIVEKIT] Room name:',
        this.room.name
      );

      console.log(
        '[LIVEKIT] Local identity:',
        this.room.localParticipant.identity
      );

      console.log(
        '[LIVEKIT] Remote participants:',
        this.room.remoteParticipants.size
      );

      this.room.remoteParticipants.forEach(
        (participant) => {
          console.log(
            '[LIVEKIT][REMOTE] Existing participant:',
            participant.identity
          );
        }
      );

      console.log(
        '[LIVEKIT] ========================================'
      );

      this.callbacks.onConnected?.();

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT] ❌ CONNECTION FAILED:',
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
   * ========================================
   * ROOM EVENTS
   * ========================================
   */

  private registerRoomEvents() {
    if (!this.room) {
      return;
    }

    /**
     * CONNECTED
     */

    this.room.on(
      RoomEvent.Connected,
      () => {
        console.log(
          '[LIVEKIT][ROOM] ✅ Connected event'
        );
      }
    );

    /**
     * DISCONNECTED
     */

    this.room.on(
      RoomEvent.Disconnected,
      (
        reason?: DisconnectReason
      ) => {
        console.log(
          '[LIVEKIT][ROOM] ❌ Disconnected:',
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
     * PARTICIPANT CONNECTED
     */

    this.room.on(
      RoomEvent.ParticipantConnected,
      (
        participant: RemoteParticipant
      ) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] ========================================'
        );

        console.log(
          '[LIVEKIT][PARTICIPANT] ✅ Connected:',
          participant.identity
        );

        console.log(
          '[LIVEKIT][PARTICIPANT] SID:',
          participant.sid
        );

        console.log(
          '[LIVEKIT][PARTICIPANT] Publications:',
          participant.trackPublications.size
        );

        console.log(
          '[LIVEKIT][PARTICIPANT] ========================================'
        );

        this.callbacks.onParticipantConnected?.(
          participant
        );
      }
    );

    /**
     * PARTICIPANT DISCONNECTED
     */

    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (
        participant: RemoteParticipant
      ) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] ❌ Disconnected:',
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
     * TRACK SUBSCRIBED
     *
     * Đây là event cực kỳ quan trọng.
     *
     * Nếu máy tính thấy:
     *
     * TRACK SUBSCRIBED
     *
     * thì máy tính đã nhận được
     * audio từ điện thoại.
     */

    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] ========================================'
        );

        console.log(
          '[LIVEKIT][TRACK] ✅ SUBSCRIBED'
        );

        console.log(
          '[LIVEKIT][TRACK] Kind:',
          track.kind
        );

        console.log(
          '[LIVEKIT][TRACK] Participant:',
          participant.identity
        );

        console.log(
          '[LIVEKIT][TRACK] Track SID:',
          publication.trackSid
        );

        console.log(
          '[LIVEKIT][TRACK] Publication:',
          {
            kind: publication.kind,
            source: publication.source,
            trackSid: publication.trackSid,
            trackName: publication.trackName,
            muted: publication.isMuted,
          }
        );

        if (
          track.kind === Track.Kind.Audio
        ) {
          console.log(
            '[LIVEKIT][TRACK] 🎤 Remote AUDIO detected'
          );

          this.attachRemoteAudio(
            track,
            participant
          );
        }

        console.log(
          '[LIVEKIT][TRACK] ========================================'
        );

        this.callbacks.onTrackSubscribed?.(
          track,
          publication,
          participant
        );
      }
    );

    /**
     * TRACK UNSUBSCRIBED
     */

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        console.log(
          '[LIVEKIT][TRACK] ❌ UNSUBSCRIBED:',
          {
            kind: track.kind,
            participant:
              participant.identity,
            trackSid:
              publication.trackSid,
          }
        );

        if (
          track.kind === Track.Kind.Audio
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
     * LOCAL TRACK PUBLISHED
     *
     * Đây là log quan trọng nhất
     * để biết điện thoại đã đưa mic
     * lên LiveKit hay chưa.
     */

    this.room.on(
      RoomEvent.LocalTrackPublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] ========================================'
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] ✅ PUBLISHED'
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Kind:',
          publication.kind
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Source:',
          publication.source
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] SID:',
          publication.trackSid
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Name:',
          publication.trackName
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Muted:',
          publication.isMuted
        );

        if (
          publication.kind ===
          Track.Kind.Audio
        ) {
          console.log(
            '[LIVEKIT][LOCAL TRACK] 🎤 MICROPHONE AUDIO PUBLISHED'
          );
        }

        console.log(
          '[LIVEKIT][LOCAL TRACK] ========================================'
        );
      }
    );

    /**
     * LOCAL TRACK UNPUBLISHED
     */

    this.room.on(
      RoomEvent.LocalTrackUnpublished,
      (publication) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] ❌ UNPUBLISHED:',
          {
            kind: publication.kind,
            source: publication.source,
            trackSid: publication.trackSid,
          }
        );
      }
    );

    /**
     * CONNECTION STATE
     */

    this.room.on(
      RoomEvent.ConnectionStateChanged,
      (
        state: ConnectionState
      ) => {
        console.log(
          '[LIVEKIT][CONNECTION]',
          state
        );
      }
    );

    /**
     * ACTIVE SPEAKERS
     */

    this.room.on(
      RoomEvent.ActiveSpeakersChanged,
      (speakers) => {
        if (speakers.length > 0) {
          console.log(
            '[LIVEKIT][SPEAKER] Active:',
            speakers.map(
              (speaker) =>
                speaker.identity
            )
          );
        }
      }
    );
  }

  /**
   * ========================================
   * MICROPHONE
   * ========================================
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
        '[LIVEKIT][MIC] 🎤 ENABLE MICROPHONE'
      );

      console.log(
        '[LIVEKIT][MIC] Participant:',
        this.room.localParticipant.identity
      );

      console.log(
        '[LIVEKIT][MIC] Browser:',
        navigator.userAgent
      );

      console.log(
        '[LIVEKIT][MIC] Protocol:',
        window.location.protocol
      );

      console.log(
        '[LIVEKIT][MIC] Host:',
        window.location.host
      );

      /**
       * Kiểm tra MediaDevices
       */

      console.log(
        '[LIVEKIT][MIC] mediaDevices:',
        !!navigator.mediaDevices
      );

      console.log(
        '[LIVEKIT][MIC] getUserMedia:',
        !!navigator.mediaDevices?.getUserMedia
      );

      /**
       * Kiểm tra permission nếu browser hỗ trợ
       */

      try {
        if (
          navigator.permissions
        ) {
          const permission =
            await navigator.permissions.query({
              name: 'microphone' as PermissionName,
            });

          console.log(
            '[LIVEKIT][MIC] Permission state:',
            permission.state
          );
        }
      } catch (permissionError) {
        console.log(
          '[LIVEKIT][MIC] Permission query unavailable:',
          permissionError
        );
      }

      /**
       * Bật microphone
       */

      console.log(
        '[LIVEKIT][MIC] Requesting microphone...'
      );

      await this.room.localParticipant.setMicrophoneEnabled(
        true
      );

      this.microphoneEnabled = true;

      console.log(
        '[LIVEKIT][MIC] ✅ setMicrophoneEnabled SUCCESS'
      );

      /**
       * Lấy tất cả local publications
       */

      const publications =
        Array.from(
          this.room.localParticipant
            .trackPublications
            .values()
        );

      console.log(
        '[LIVEKIT][MIC] Local publications count:',
        publications.length
      );

      console.log(
        '[LIVEKIT][MIC] Local publications:',
        publications.map(
          (publication) => ({
            kind: publication.kind,
            source: publication.source,
            trackSid:
              publication.trackSid,
            trackName:
              publication.trackName,
            muted:
              publication.isMuted,
          })
        )
      );

      /**
       * Tìm microphone publication
       */

      const micPublication =
        this.room.localParticipant.getTrackPublication(
          Track.Source.Microphone
        );

      if (!micPublication) {
        console.error(
          '[LIVEKIT][MIC] ❌❌❌ MICROPHONE PUBLICATION NOT FOUND'
        );

        console.error(
          '[LIVEKIT][MIC] Có nghĩa là setMicrophoneEnabled() chạy nhưng microphone chưa được publish.'
        );

        return false;
      }

      console.log(
        '[LIVEKIT][MIC] 🎤 Microphone publication FOUND'
      );

      console.log(
        '[LIVEKIT][MIC] Publication info:',
        {
          sid:
            micPublication.trackSid,
          kind:
            micPublication.kind,
          source:
            micPublication.source,
          name:
            micPublication.trackName,
          muted:
            micPublication.isMuted,
        }
      );

      /**
       * Kiểm tra LocalTrack
       */

      if (!micPublication.track) {
        console.error(
          '[LIVEKIT][MIC] ❌ Microphone publication has NO TRACK'
        );

        return false;
      }

      console.log(
        '[LIVEKIT][MIC] 🎤 Local audio track FOUND'
      );

      const mediaStreamTrack =
        micPublication.track
          .mediaStreamTrack;

      console.log(
        '[LIVEKIT][MIC] MediaTrack:',
        mediaStreamTrack
      );

      console.log(
        '[LIVEKIT][MIC] Track ID:',
        mediaStreamTrack.id
      );

      console.log(
        '[LIVEKIT][MIC] Track enabled:',
        mediaStreamTrack.enabled
      );

      console.log(
        '[LIVEKIT][MIC] Track readyState:',
        mediaStreamTrack.readyState
      );

      console.log(
        '[LIVEKIT][MIC] Track muted:',
        mediaStreamTrack.muted
      );

      /**
       * Lấy thông tin microphone
       */

      try {
        console.log(
          '[LIVEKIT][MIC] Track settings:',
          mediaStreamTrack.getSettings()
        );
      } catch {
        console.log(
          '[LIVEKIT][MIC] Track settings unavailable'
        );
      }

      console.log(
        '[LIVEKIT][MIC] ========================================'
      );

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT][MIC] ❌ ENABLE FAILED:',
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
   * ========================================
   * DISABLE MICROPHONE
   * ========================================
   */

  async disableMicrophone(): Promise<boolean> {
    if (!this.room) {
      console.error(
        '[LIVEKIT][MIC] ❌ Room chưa kết nối'
      );

      return false;
    }

    try {
      console.log(
        '[LIVEKIT][MIC] 🔇 Disabling microphone...'
      );

      await this.room.localParticipant.setMicrophoneEnabled(
        false
      );

      this.microphoneEnabled = false;

      console.log(
        '[LIVEKIT][MIC] ✅ Microphone disabled'
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
   * ========================================
   * TOGGLE MICROPHONE
   * ========================================
   */

  async toggleMicrophone(): Promise<boolean> {
    console.log(
      '[LIVEKIT][MIC] toggleMicrophone()'
    );

    console.log(
      '[LIVEKIT][MIC] Current state:',
      this.microphoneEnabled
    );

    if (
      this.microphoneEnabled
    ) {
      return this.disableMicrophone();
    }

    return this.enableMicrophone();
  }

  /**
   * ========================================
   * MICROPHONE STATE
   * ========================================
   */

  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }

  /**
   * ========================================
   * AUDIO START
   *
   * Dùng cho Android/WebView khi autoplay
   * bị trình duyệt chặn.
   *
   * Nên gọi hàm này từ một nút mà người
   * dùng trực tiếp bấm, ví dụ nút "Nghe".
   * ========================================
   */

  async startAudio(): Promise<boolean> {
    if (!this.room) {
      console.error(
        '[LIVEKIT][AUDIO] ❌ Room chưa kết nối'
      );

      return false;
    }

    try {
      console.log(
        '[LIVEKIT][AUDIO] Starting audio playback...'
      );

      await this.room.startAudio();

      console.log(
        '[LIVEKIT][AUDIO] ✅ Audio playback started'
      );

      /**
       * Thử play lại tất cả remote audio
       */

      for (const [
        identity,
        element,
      ] of this.remoteAudioElements) {
        try {
          await element.play();

          console.log(
            '[LIVEKIT][AUDIO] ▶️ Playback resumed:',
            identity
          );
        } catch (error) {
          console.warn(
            '[LIVEKIT][AUDIO] ⚠️ Playback still blocked:',
            identity,
            error
          );
        }
      }

      return true;
    } catch (error) {
      console.warn(
        '[LIVEKIT][AUDIO] ⚠️ startAudio failed:',
        error
      );

      return false;
    }
  }

  /**
   * ========================================
   * LOCAL PARTICIPANT
   * ========================================
   */

  getLocalParticipant():
    LocalParticipant | null {
    return (
      this.room?.localParticipant ??
      null
    );
  }

  /**
   * ========================================
   * ROOM
   * ========================================
   */

  getRoom(): Room | null {
    return this.room;
  }

  /**
   * ========================================
   * CONNECTED
   * ========================================
   */

  isConnected(): boolean {
    return (
      this.connected &&
      !!this.room
    );
  }

  /**
   * ========================================
   * DEBUG MICROPHONE
   *
   * Có thể gọi trong console:
   *
   * liveKitService.debugMicrophone()
   * ========================================
   */

  debugMicrophone() {
    console.log(
      '[LIVEKIT][DEBUG MIC] ========================================'
    );

    if (!this.room) {
      console.error(
        '[LIVEKIT][DEBUG MIC] ❌ No room'
      );

      return;
    }

    const participant =
      this.room.localParticipant;

    console.log(
      '[LIVEKIT][DEBUG MIC] Participant:',
      participant.identity
    );

    console.log(
      '[LIVEKIT][DEBUG MIC] Connected:',
      this.connected
    );

    console.log(
      '[LIVEKIT][DEBUG MIC] Microphone flag:',
      this.microphoneEnabled
    );

    const publications =
      Array.from(
        participant.trackPublications.values()
      );

    console.log(
      '[LIVEKIT][DEBUG MIC] Publications:',
      publications.map(
        (publication) => ({
          kind: publication.kind,
          source: publication.source,
          sid: publication.trackSid,
          name: publication.trackName,
          muted: publication.isMuted,
          hasTrack:
            !!publication.track,
        })
      )
    );

    const micPublication =
      participant.getTrackPublication(
        Track.Source.Microphone
      );

    if (!micPublication) {
      console.error(
        '[LIVEKIT][DEBUG MIC] ❌ NO MICROPHONE PUBLICATION'
      );

      return;
    }

    console.log(
      '[LIVEKIT][DEBUG MIC] Microphone publication:',
      micPublication
    );

    if (!micPublication.track) {
      console.error(
        '[LIVEKIT][DEBUG MIC] ❌ NO LOCAL TRACK'
      );

      return;
    }

    const mediaTrack =
      micPublication.track
        .mediaStreamTrack;

    console.log(
      '[LIVEKIT][DEBUG MIC] MediaTrack:',
      mediaTrack
    );

    console.log(
      '[LIVEKIT][DEBUG MIC] enabled:',
      mediaTrack.enabled
    );

    console.log(
      '[LIVEKIT][DEBUG MIC] muted:',
      mediaTrack.muted
    );

    console.log(
      '[LIVEKIT][DEBUG MIC] readyState:',
      mediaTrack.readyState
    );

    try {
      console.log(
        '[LIVEKIT][DEBUG MIC] settings:',
        mediaTrack.getSettings()
      );
    } catch {}

    console.log(
      '[LIVEKIT][DEBUG MIC] ========================================'
    );
  }

  /**
   * ========================================
   * REMOTE AUDIO
   * ========================================
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
        '[LIVEKIT][AUDIO] ========================================'
      );

      console.log(
        '[LIVEKIT][AUDIO] Attaching remote audio'
      );

      console.log(
        '[LIVEKIT][AUDIO] Participant:',
        identity
      );

      console.log(
        '[LIVEKIT][AUDIO] Track kind:',
        track.kind
      );

      /**
       * Xóa audio cũ nếu tồn tại
       */

      this.removeRemoteAudio(
        identity
      );

      /**
       * Attach LiveKit track
       */

      const attached =
        track.attach();

      let audioElement: HTMLAudioElement;

      if (
        attached instanceof
        HTMLAudioElement
      ) {
        audioElement = attached;
      } else {
        /**
         * Trong một số môi trường,
         * attach() có thể trả HTMLElement.
         */

        audioElement =
          document.createElement(
            'audio'
          );

        audioElement.autoplay =
          true;

        audioElement.playsInline =
          true;

        audioElement.srcObject =
          (
            attached as HTMLMediaElement
          ).srcObject;
      }

      audioElement.autoplay =
        true;

      audioElement.controls =
        false;

      audioElement.playsInline =
        true;

      audioElement.muted =
        false;

      audioElement.volume = 1;

      audioElement.setAttribute(
        'playsinline',
        ''
      );

      audioElement.dataset.livekitParticipant =
        identity;

      /**
       * Đưa vào DOM
       */

      if (
        !audioElement.isConnected
      ) {
        document.body.appendChild(
          audioElement
        );
      }

      this.remoteAudioElements.set(
        identity,
        audioElement
      );

      console.log(
        '[LIVEKIT][AUDIO] ✅ Audio element attached'
      );

      console.log(
        '[LIVEKIT][AUDIO] Element:',
        audioElement
      );

      console.log(
        '[LIVEKIT][AUDIO] muted:',
        audioElement.muted
      );

      console.log(
        '[LIVEKIT][AUDIO] volume:',
        audioElement.volume
      );

      console.log(
        '[LIVEKIT][AUDIO] autoplay:',
        audioElement.autoplay
      );

      /**
       * Thử phát ngay
       */

      audioElement
        .play()
        .then(() => {
          console.log(
            '[LIVEKIT][AUDIO] ✅ ▶️ Remote playback started:',
            identity
          );
        })
        .catch((error) => {
          console.warn(
            '[LIVEKIT][AUDIO] ⚠️ Autoplay blocked:',
            identity,
            error
          );

          console.warn(
            '[LIVEKIT][AUDIO] Hãy gọi liveKitService.startAudio() từ thao tác người dùng.'
          );
        });

      console.log(
        '[LIVEKIT][AUDIO] ========================================'
      );
    } catch (error) {
      console.error(
        '[LIVEKIT][AUDIO] ❌ ATTACH FAILED:',
        error
      );
    }
  }

  /**
   * ========================================
   * REMOVE REMOTE AUDIO
   * ========================================
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

      if (
        element.isConnected
      ) {
        element.remove();
      }
    } catch (error) {
      console.warn(
        '[LIVEKIT][AUDIO] Remove warning:',
        error
      );
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
   * ========================================
   * DISCONNECT
   * ========================================
   */

  async disconnect() {
    console.log(
      '[LIVEKIT] ========================================'
    );

    console.log(
      '[LIVEKIT] Disconnecting...'
    );

    /**
     * Xóa remote audio
     */

    for (const [
      participantIdentity,
      element,
    ] of this.remoteAudioElements) {
      try {
        element.pause();

        element.srcObject = null;

        if (
          element.isConnected
        ) {
          element.remove();
        }
      } catch {
        // ignore
      }

      console.log(
        '[LIVEKIT][AUDIO] Removed:',
        participantIdentity
      );
    }

    this.remoteAudioElements.clear();

    /**
     * Disconnect room
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

    this.microphoneEnabled =
      false;

    console.log(
      '[LIVEKIT] ✅ Disconnected'
    );

    console.log(
      '[LIVEKIT] ========================================'
    );
  }

  /**
   * ========================================
   * DESTROY
   * ========================================
   */

  async destroy() {
    console.log(
      '[LIVEKIT] Destroying service...'
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