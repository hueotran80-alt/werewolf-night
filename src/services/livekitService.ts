import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  Track,
  ConnectionState,
  LocalTrackPublication,
  createLocalAudioTrack,
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

type DebugState = {
  roomConnected: boolean;
  localMicCreated: boolean;
  localMicPublished: boolean;
  remoteParticipantConnected: boolean;
  remoteAudioTrackReceived: boolean;
  remoteAudioAttached: boolean;
  remoteAudioPlaying: boolean;
};

class LiveKitService {
  private room: Room | null = null;
  private config: LiveKitConfig | null = null;
  private callbacks: LiveKitCallbacks = {};

  private connected = false;
  private microphoneEnabled = false;
  private microphoneWanted = false;
  private microphonePublishPromise: Promise<boolean> | null = null;
  private signalConnected = false;

  private remoteAudioElements =
    new Map<string, HTMLAudioElement>();

  private debug: DebugState = {
    roomConnected: false,
    localMicCreated: false,
    localMicPublished: false,
    remoteParticipantConnected: false,
    remoteAudioTrackReceived: false,
    remoteAudioAttached: false,
    remoteAudioPlaying: false,
  };

  // =========================================================
  // DEBUG
  // =========================================================

  private resetDebug() {
    this.debug = {
      roomConnected: false,
      localMicCreated: false,
      localMicPublished: false,
      remoteParticipantConnected: false,
      remoteAudioTrackReceived: false,
      remoteAudioAttached: false,
      remoteAudioPlaying: false,
    };
  }

  private printDebug() {
    console.log('');
    console.log(
      '%c========== LIVEKIT DEBUG ==========',
      'font-weight:bold;font-size:14px'
    );

    console.log(
      '[1] Room connected       ',
      this.debug.roomConnected ? '✅' : '❌'
    );

    console.log(
      '[2] Local microphone     ',
      this.debug.localMicCreated ? '✅' : '❌'
    );

    console.log(
      '[3] Audio published      ',
      this.debug.localMicPublished ? '✅' : '❌'
    );

    console.log(
      '[4] Remote participant   ',
      this.debug.remoteParticipantConnected ? '✅' : '❌'
    );

    console.log(
      '[5] Remote audio track   ',
      this.debug.remoteAudioTrackReceived ? '✅' : '❌'
    );

    console.log(
      '[6] Audio element        ',
      this.debug.remoteAudioAttached ? '✅' : '❌'
    );

    console.log(
      '[7] Audio playback       ',
      this.debug.remoteAudioPlaying ? '✅' : '❌'
    );

    console.log(
      '%c===================================',
      'font-weight:bold;font-size:14px'
    );

    console.log(
      '[LIVEKIT][DEBUG] State:',
      { ...this.debug }
    );

    console.log('');
  }

  /**
   * Có thể gọi từ code khác để xem trạng thái debug.
   */
  getDebugState(): DebugState {
    return { ...this.debug };
  }

  /**
   * In trạng thái debug hiện tại.
   */
  showDebug() {
    this.printDebug();
  }

  // =========================================================
  // INITIALIZE
  // =========================================================

  initialize(
    config: LiveKitConfig,
    callbacks: LiveKitCallbacks = {}
  ) {
    this.config = config;
    this.callbacks = callbacks;

    this.resetDebug();

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

  // =========================================================
  // CONNECT
  // =========================================================

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

    if (this.connected && this.room) {
      console.log(
        '[LIVEKIT] Already connected'
      );

      return true;
    }

    try {
      this.resetDebug();

      console.log(
        '[LIVEKIT] Connecting...'
      );

      console.log(
        '[LIVEKIT] Server:',
        this.config.url
      );

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.registerRoomEvents();

      await this.room.connect(
        this.config.url,
        this.config.token,
        {
          autoSubscribe: true,
          maxRetries: 5,
        }
      );

      // room.connect() has completed, but keep a small safety wait so
      // microphone publishing never races the LiveKit signaling state.
      await this.waitForSignalReady(5000);

      this.connected = true;

      this.debug.roomConnected = true;

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

      this.printDebug();

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

      this.printDebug();

      return false;
    }
  }

  private async waitForSignalReady(timeoutMs = 5000): Promise<boolean> {
    const started = Date.now();

    while (this.room) {
      const state = this.room.state;

      if (state === ConnectionState.Connected || this.signalConnected) {
        return true;
      }

      if (Date.now() - started >= timeoutMs) {
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  private async ensureRemoteAudioSubscriptions() {
    if (!this.room) return;

    for (const participant of this.room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        try {
          if (!publication.isSubscribed) {
            console.log('[LIVEKIT][SUBSCRIBE] Subscribing existing audio:', {
              participant: participant.identity,
              sid: publication.trackSid,
            });
            publication.setSubscribed(true);
          }
        } catch (error) {
          console.warn('[LIVEKIT][SUBSCRIBE] Failed to subscribe:', error);
        }
      }
    }
  }

  // =========================================================
  // ROOM EVENTS
  // =========================================================

  private registerRoomEvents() {
    if (!this.room) return;

    this.room.on(
      RoomEvent.Connected,
      () => {
        console.log(
          '[LIVEKIT][ROOM] ✅ Connected'
        );

        this.debug.roomConnected = true;

        this.printDebug();
      }
    );

    this.room.on(
      RoomEvent.SignalConnected,
      () => {
        this.signalConnected = true;
        console.log('[LIVEKIT][SIGNAL] ✅ Signal connected - publishing is ready');
      }
    );

    this.room.on(
      RoomEvent.SignalReconnecting,
      () => {
        this.signalConnected = false;
        console.warn('[LIVEKIT][SIGNAL] ⚠️ Signal reconnecting');
      }
    );

    this.room.on(
      RoomEvent.Reconnecting,
      () => {
        console.warn('[LIVEKIT][ROOM] ⚠️ Media reconnecting');
      }
    );

    this.room.on(
      RoomEvent.Reconnected,
      async () => {
        console.log('[LIVEKIT][ROOM] ✅ Reconnected');
        this.connected = true;
        this.debug.roomConnected = true;
        this.signalConnected = true;

        await this.ensureRemoteAudioSubscriptions();

        if (this.microphoneWanted) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          await this.publishMicrophoneWithRetry();
        }
      }
    );

    this.room.on(
      RoomEvent.Disconnected,
      (reason) => {
        console.log(
          '[LIVEKIT][ROOM] ❌ Disconnected:',
          reason
        );

        this.connected = false;
        this.signalConnected = false;

        this.debug.roomConnected = false;

        this.callbacks.onDisconnected?.(
          reason
            ? String(reason)
            : undefined
        );

        this.printDebug();
      }
    );

    this.room.on(
      RoomEvent.ParticipantConnected,
      (participant) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] ✅ Connected:',
          participant.identity
        );

        this.debug.remoteParticipantConnected = true;

        console.log(
          '[LIVEKIT][PARTICIPANT] Audio publications:',
          participant
            .audioTrackPublications
            .size
        );

        this.printDebug();

        this.callbacks.onParticipantConnected?.(
          participant
        );

        // The participant may already have published the microphone before
        // this client finished joining. Explicitly subscribe to any existing
        // audio publication.
        setTimeout(() => {
          for (const publication of participant.audioTrackPublications.values()) {
            try {
              if (!publication.isSubscribed) {
                publication.setSubscribed(true);
              }
            } catch (error) {
              console.warn('[LIVEKIT][SUBSCRIBE] Participant audio subscribe failed:', error);
            }
          }
        }, 0);
      }
    );

    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (participant) => {
        console.log(
          '[LIVEKIT][PARTICIPANT] ❌ Disconnected:',
          participant.identity
        );

        this.removeRemoteAudio(
          participant.identity
        );

        this.debug.remoteParticipantConnected = false;
        this.debug.remoteAudioTrackReceived = false;
        this.debug.remoteAudioAttached = false;
        this.debug.remoteAudioPlaying = false;

        this.callbacks.onParticipantDisconnected?.(
          participant
        );

        this.printDebug();
      }
    );

    // =======================================================
    // QUAN TRỌNG NHẤT
    // Remote audio nhận được ở đây
    // =======================================================

    this.room.on(
      RoomEvent.TrackPublished,
      (publication, participant) => {
        if (publication.kind !== Track.Kind.Audio) return;

        console.log('[LIVEKIT][TRACK] 🎤 Remote audio published:', {
          participant: participant.identity,
          sid: publication.trackSid,
          subscribed: publication.isSubscribed,
        });

        if (!publication.isSubscribed) {
          try {
            publication.setSubscribed(true);
          } catch (error) {
            console.warn('[LIVEKIT][SUBSCRIBE] TrackPublished subscribe failed:', error);
          }
        }
      }
    );

    this.room.on(
      RoomEvent.TrackSubscriptionFailed,
      (trackSid, participant) => {
        console.warn('[LIVEKIT][SUBSCRIBE] ❌ Track subscription failed:', {
          trackSid,
          participant: participant?.identity,
        });

        setTimeout(() => {
          if (!this.room) return;
          const p = participant ? this.room.remoteParticipants.get(participant.identity) : undefined;
          const publication = p?.audioTrackPublications.get(trackSid);
          if (publication && !publication.isSubscribed) {
            try {
              publication.setSubscribed(true);
            } catch (error) {
              console.warn('[LIVEKIT][SUBSCRIBE] Retry failed:', error);
            }
          }
        }, 500);
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
          '[LIVEKIT][TRACK] ================================='
        );

        console.log(
          '[LIVEKIT][TRACK] ✅ TrackSubscribed'
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
          publication
        );

        if (
          track.kind === Track.Kind.Audio
        ) {
          this.debug.remoteAudioTrackReceived = true;

          console.log(
            '[LIVEKIT][REMOTE AUDIO] 🎧 Audio track received'
          );

          this.attachRemoteAudio(
            track,
            participant
          );
        }

        this.printDebug();

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
          '[LIVEKIT][TRACK] ❌ TrackUnsubscribed:',
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

          this.debug.remoteAudioTrackReceived =
            false;

          this.debug.remoteAudioAttached =
            false;

          this.debug.remoteAudioPlaying =
            false;
        }

        this.callbacks.onTrackUnsubscribed?.(
          track,
          publication,
          participant
        );

        this.printDebug();
      }
    );

    // =======================================================
    // LOCAL AUDIO PUBLISHED
    // =======================================================

    this.room.on(
      RoomEvent.LocalTrackPublished,
      (
        publication: LocalTrackPublication
      ) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] ================================='
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Published'
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] Kind:',
          publication.kind
        );

        console.log(
          '[LIVEKIT][LOCAL TRACK] SID:',
          publication.trackSid
        );

        if (
          publication.kind === Track.Kind.Audio
        ) {
          this.debug.localMicPublished = true;

          console.log(
            '[LIVEKIT][PUBLISH] 🎤 Microphone audio published successfully'
          );
        }

        this.printDebug();
      }
    );

    this.room.on(
      RoomEvent.LocalTrackUnpublished,
      (
        publication
      ) => {
        console.log(
          '[LIVEKIT][LOCAL TRACK] ❌ Unpublished:',
          {
            kind: publication.kind,
            trackSid: publication.trackSid,
          }
        );

        if (
          publication.kind === Track.Kind.Audio
        ) {
          this.debug.localMicPublished =
            false;
        }

        this.printDebug();
      }
    );

    // =======================================================
    // CONNECTION STATE
    // =======================================================

    this.room.on(
      RoomEvent.ConnectionStateChanged,
      (
        state: ConnectionState
      ) => {
        console.log(
          '[LIVEKIT][CONNECTION] State:',
          state
        );
      }
    );

    // =======================================================
    // ACTIVE SPEAKERS
    // =======================================================

    this.room.on(
      RoomEvent.ActiveSpeakersChanged,
      (speakers) => {
        console.log(
          '[LIVEKIT][SPEAKERS]',
          speakers.map(
            (p) => p.identity
          )
        );
      }
    );
  }

  // =========================================================
  // MICROPHONE
  // =========================================================

  private async publishMicrophoneWithRetry(): Promise<boolean> {
    if (!this.room) return false;

    if (this.microphonePublishPromise) {
      return this.microphonePublishPromise;
    }

    this.microphonePublishPromise = (async () => {
      const participant = this.room!.localParticipant;

      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          if (!this.room) return false;

          const ready = await this.waitForSignalReady(3000);
          if (!ready) {
            console.warn('[LIVEKIT][MIC] Signal not ready, retrying...', attempt);
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
            continue;
          }

          // Unlock browser audio output from the user's mic-button gesture when possible.
          try {
            await (this.room as any).startAudio?.();
          } catch {
            // Not all browsers require/allow startAudio here.
          }

          console.log(`[LIVEKIT][MIC] Publish attempt ${attempt}/4`);

          const publication = await participant.setMicrophoneEnabled(
            true,
            {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            {
              source: Track.Source.Microphone,
            }
          );

          const micPublication =
            publication ??
            Array.from(participant.audioTrackPublications.values()).find(
              (pub) => pub.source === Track.Source.Microphone
            );

          if (micPublication && micPublication.track) {
            // setMicrophoneEnabled(true) should unmute an existing publication.
            if (micPublication.isMuted) {
              micPublication.setMuted(false);
            }

            this.microphoneEnabled = true;
            this.debug.localMicCreated = true;
            this.debug.localMicPublished = true;

            console.log('[LIVEKIT][MIC] ✅ Published and verified:', {
              sid: micPublication.trackSid,
              source: micPublication.source,
              muted: micPublication.isMuted,
              hasTrack: !!micPublication.track,
              mediaTrackState: micPublication.track.mediaStreamTrack.readyState,
              mediaTrackEnabled: micPublication.track.mediaStreamTrack.enabled,
            });

            this.printDebug();
            return true;
          }

          console.warn('[LIVEKIT][MIC] Publication not available after enable, retrying...');
        } catch (error) {
          console.warn(`[LIVEKIT][MIC] Publish attempt ${attempt} failed:`, error);

          if (attempt === 4) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.callbacks.onError?.(err);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }

      this.microphoneEnabled = false;
      this.debug.localMicPublished = false;
      this.printDebug();
      return false;
    })();

    try {
      return await this.microphonePublishPromise;
    } finally {
      this.microphonePublishPromise = null;
    }
  }

  async enableMicrophone(): Promise<boolean> {
    if (!this.room) {
      console.error('[LIVEKIT][MIC] ❌ Room chưa kết nối');
      return false;
    }

    this.microphoneWanted = true;
    return this.publishMicrophoneWithRetry();
  }

  // =========================================================
  // DISABLE MICROPHONE
  // =========================================================

  async disableMicrophone(): Promise<boolean> {
    this.microphoneWanted = false;

    if (!this.room) {
      return false;
    }

    try {
      await this.room.localParticipant
        .setMicrophoneEnabled(false);

      this.microphoneEnabled = false;

      this.debug.localMicCreated = false;
      this.debug.localMicPublished = false;

      console.log(
        '[LIVEKIT][MIC] 🔇 Microphone disabled'
      );

      this.printDebug();

      return true;
    } catch (error) {
      console.error(
        '[LIVEKIT][MIC] ❌ Disable failed:',
        error
      );

      return false;
    }
  }

  // =========================================================
  // TOGGLE
  // =========================================================

  async toggleMicrophone(): Promise<boolean> {
    console.log(
      '[LIVEKIT][MIC] toggle:',
      {
        current:
          this.microphoneEnabled,
        next:
          !this.microphoneEnabled,
      }
    );

    if (this.microphoneEnabled) {
      return this.disableMicrophone();
    }

    return this.enableMicrophone();
  }

  // =========================================================
  // MIC STATUS
  // =========================================================

  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }

  // =========================================================
  // LOCAL PARTICIPANT
  // =========================================================

  getLocalParticipant():
    LocalParticipant | null {
    return (
      this.room?.localParticipant ??
      null
    );
  }

  // =========================================================
  // ROOM
  // =========================================================

  getRoom(): Room | null {
    return this.room;
  }

  // =========================================================
  // CONNECTION
  // =========================================================

  isConnected(): boolean {
    return (
      this.connected &&
      !!this.room
    );
  }

  // =========================================================
  // REMOTE AUDIO
  // =========================================================

  private attachRemoteAudio(
    track: RemoteTrack,
    participant: RemoteParticipant
  ) {
    if (
      track.kind !== Track.Kind.Audio
    ) {
      return;
    }

    try {
      console.log(
        '[LIVEKIT][AUDIO] ================================='
      );

      console.log(
        '[LIVEKIT][AUDIO] Attaching remote audio:',
        participant.identity
      );

      this.removeRemoteAudio(
        participant.identity
      );

      const audioElement =
        track.attach() as HTMLAudioElement;

      audioElement.autoplay = true;
      audioElement.controls = false;
      audioElement.playsInline = true;

      audioElement.volume = 1;

      audioElement.muted = false;

      audioElement.dataset
        .livekitParticipant =
        participant.identity;

      document.body.appendChild(
        audioElement
      );

      this.remoteAudioElements.set(
        participant.identity,
        audioElement
      );

      this.debug.remoteAudioAttached =
        true;

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

      // =====================================================
      // AUDIO EVENTS
      // =====================================================

      audioElement.onplay = () => {
        console.log(
          '[LIVEKIT][AUDIO] ▶️ onplay'
        );

        this.debug.remoteAudioPlaying =
          true;

        this.printDebug();
      };

      audioElement.onplaying = () => {
        console.log(
          '[LIVEKIT][AUDIO] ▶️ onplaying'
        );

        this.debug.remoteAudioPlaying =
          true;

        this.printDebug();
      };

      audioElement.onpause = () => {
        console.log(
          '[LIVEKIT][AUDIO] ⏸️ onpause'
        );

        this.debug.remoteAudioPlaying =
          false;
      };

      audioElement.onwaiting = () => {
        console.warn(
          '[LIVEKIT][AUDIO] ⏳ waiting'
        );
      };

      audioElement.onerror = () => {
        console.error(
          '[LIVEKIT][AUDIO] ❌ HTML audio error:',
          audioElement.error
        );
      };

      // =====================================================
      // PLAY
      // =====================================================

      audioElement
        .play()
        .then(() => {
          console.log(
            '[LIVEKIT][AUDIO] ▶️ Playback started'
          );

          this.debug.remoteAudioPlaying =
            true;

          this.printDebug();
        })
        .catch((error) => {
          console.warn(
            '[LIVEKIT][AUDIO] ⚠️ Playback blocked:',
            error
          );

          console.warn(
            '[LIVEKIT][AUDIO] User interaction may be required'
          );

          this.printDebug();
        });
    } catch (error) {
      console.error(
        '[LIVEKIT][AUDIO] ❌ Attach failed:',
        error
      );

      this.debug.remoteAudioAttached =
        false;

      this.debug.remoteAudioPlaying =
        false;

      this.printDebug();
    }
  }

  // =========================================================
  // REMOVE REMOTE AUDIO
  // =========================================================

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

  // =========================================================
  // DISCONNECT
  // =========================================================

  async disconnect() {
    console.log(
      '[LIVEKIT] Disconnecting...'
    );

    for (
      const [
        participantIdentity,
        element,
      ]
      of this.remoteAudioElements
    ) {
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
    this.microphoneWanted = false;
    this.microphonePublishPromise = null;
    this.signalConnected = false;

    this.resetDebug();

    console.log(
      '[LIVEKIT] ✅ Disconnected'
    );
  }

  // =========================================================
  // DESTROY
  // =========================================================

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
