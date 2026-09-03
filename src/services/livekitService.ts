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

class LiveKitService {
  private room: Room | null = null;
  private config: LiveKitConfig | null = null;
  private callbacks: LiveKitCallbacks = {};

  private connected = false;
  private microphoneEnabled = false;
  private microphoneWanted = false;
  private microphonePublishPromise: Promise<boolean> | null = null;
  private signalConnected = false;

  private remoteAudioElements = new Map<string, HTMLAudioElement>();

  initialize(config: LiveKitConfig, callbacks: LiveKitCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  async connect(): Promise<boolean> {
    if (!this.config) {
      const error = new Error('LiveKit chưa được initialize.');
      this.callbacks.onError?.(error);
      return false;
    }

    if (this.connected && this.room) {
      return true;
    }

    try {
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

      await this.room.connect(this.config.url, this.config.token, {
        autoSubscribe: true,
        maxRetries: 5,
      });

      await this.waitForSignalReady(5000);

      this.connected = true;
      this.signalConnected = true;

      this.callbacks.onConnected?.();
      return true;
    } catch (error) {
      this.connected = false;
      this.signalConnected = false;

      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);

      return false;
    }
  }

  private async waitForSignalReady(timeoutMs = 5000): Promise<boolean> {
    const started = Date.now();

    while (this.room) {
      if (
        this.room.state === ConnectionState.Connected ||
        this.signalConnected
      ) {
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
        if (!publication.isSubscribed) {
          try {
            publication.setSubscribed(true);
          } catch {
            // LiveKit sẽ tiếp tục xử lý subscription khi track được publish lại.
          }
        }
      }
    }
  }

  private registerRoomEvents() {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      this.connected = true;
    });

    this.room.on(RoomEvent.SignalConnected, () => {
      this.signalConnected = true;
    });

    this.room.on(RoomEvent.SignalReconnecting, () => {
      this.signalConnected = false;
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      // LiveKit tự xử lý quá trình reconnect media.
    });

    this.room.on(RoomEvent.Reconnected, async () => {
      this.connected = true;
      this.signalConnected = true;

      await this.ensureRemoteAudioSubscriptions();

      if (this.microphoneWanted) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await this.publishMicrophoneWithRetry();
      }
    });

    this.room.on(RoomEvent.Disconnected, (reason) => {
      this.connected = false;
      this.signalConnected = false;
      this.microphoneEnabled = false;

      this.callbacks.onDisconnected?.(reason ? String(reason) : undefined);
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.callbacks.onParticipantConnected?.(participant);

      // Người chơi có thể đã bật mic trước khi client này nhận event.
      setTimeout(() => {
        for (const publication of participant.audioTrackPublications.values()) {
          if (!publication.isSubscribed) {
            try {
              publication.setSubscribed(true);
            } catch {
              // Bỏ qua; LiveKit có thể retry khi publication thay đổi.
            }
          }
        }
      }, 0);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.removeRemoteAudio(participant.identity);
      this.callbacks.onParticipantDisconnected?.(participant);
    });

    this.room.on(
      RoomEvent.TrackPublished,
      (publication, participant) => {
        if (publication.kind !== Track.Kind.Audio) return;

        if (!publication.isSubscribed) {
          try {
            publication.setSubscribed(true);
          } catch {
            // Subscription sẽ được thử lại ở TrackSubscriptionFailed.
          }
        }
      }
    );

    this.room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
      setTimeout(() => {
        if (!this.room || !participant) return;

        const remoteParticipant = this.room.remoteParticipants.get(
          participant.identity
        );
        const publication = remoteParticipant?.audioTrackPublications.get(trackSid);

        if (publication && !publication.isSubscribed) {
          try {
            publication.setSubscribed(true);
          } catch {
            // Bỏ qua lỗi subscription tạm thời.
          }
        }
      }, 500);
    });

    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        if (track.kind === Track.Kind.Audio) {
          this.attachRemoteAudio(track, participant);
        }

        this.callbacks.onTrackSubscribed?.(track, publication, participant);
      }
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: RemoteTrack,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        if (track.kind === Track.Kind.Audio) {
          this.removeRemoteAudio(participant.identity);
        }

        this.callbacks.onTrackUnsubscribed?.(track, publication, participant);
      }
    );

    this.room.on(
      RoomEvent.LocalTrackPublished,
      (publication: LocalTrackPublication) => {
        if (publication.kind === Track.Kind.Audio) {
          this.microphoneEnabled = true;
        }
      }
    );

    this.room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.kind === Track.Kind.Audio) {
        this.microphoneEnabled = false;
      }
    });
  }

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
            await new Promise((resolve) =>
              setTimeout(resolve, 250 * attempt)
            );
            continue;
          }

          try {
            await (this.room as any).startAudio?.();
          } catch {
            // Không phải trình duyệt nào cũng cần startAudio().
          }

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

          if (micPublication?.track) {
            this.microphoneEnabled = true;
            return true;
          }
        } catch (error) {
          if (attempt === 4) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            this.callbacks.onError?.(err);
          }
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 250 * attempt)
        );
      }

      this.microphoneEnabled = false;
      return false;
    })();

    try {
      return await this.microphonePublishPromise;
    } finally {
      this.microphonePublishPromise = null;
    }
  }

  async enableMicrophone(): Promise<boolean> {
    if (!this.room) return false;

    this.microphoneWanted = true;
    return this.publishMicrophoneWithRetry();
  }

  async disableMicrophone(): Promise<boolean> {
    this.microphoneWanted = false;

    if (!this.room) {
      this.microphoneEnabled = false;
      return false;
    }

    try {
      await this.room.localParticipant.setMicrophoneEnabled(false);
      this.microphoneEnabled = false;
      return true;
    } catch (error) {
      this.microphoneEnabled = false;
      return false;
    }
  }

  async toggleMicrophone(): Promise<boolean> {
    if (this.microphoneEnabled) {
      return this.disableMicrophone();
    }

    return this.enableMicrophone();
  }

  isMicrophoneEnabled(): boolean {
    return this.microphoneEnabled;
  }

  getLocalParticipant(): LocalParticipant | null {
    return this.room?.localParticipant ?? null;
  }

  getRoom(): Room | null {
    return this.room;
  }

  isConnected(): boolean {
    return this.connected && !!this.room;
  }

  private attachRemoteAudio(
    track: RemoteTrack,
    participant: RemoteParticipant
  ) {
    if (track.kind !== Track.Kind.Audio) return;

    try {
      this.removeRemoteAudio(participant.identity);

      const audioElement = track.attach() as HTMLAudioElement;

      audioElement.autoplay = true;
      audioElement.controls = false;
      (audioElement as any).playsInline = true;
      audioElement.volume = 1;
      audioElement.muted = false;
      audioElement.dataset.livekitParticipant = participant.identity;

      document.body.appendChild(audioElement);
      this.remoteAudioElements.set(participant.identity, audioElement);

      audioElement.play().catch(() => {
        // Một số WebView yêu cầu tương tác người dùng trước khi phát audio.
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError?.(err);
    }
  }

  private removeRemoteAudio(participantIdentity: string) {
    const element = this.remoteAudioElements.get(participantIdentity);
    if (!element) return;

    try {
      element.pause();
      element.srcObject = null;
      element.remove();
    } catch {
      // ignore
    }

    this.remoteAudioElements.delete(participantIdentity);
  }

  async disconnect() {
    for (const element of this.remoteAudioElements.values()) {
      try {
        element.pause();
        element.srcObject = null;
        element.remove();
      } catch {
        // ignore
      }
    }

    this.remoteAudioElements.clear();

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }

    this.room = null;
    this.connected = false;
    this.microphoneEnabled = false;
    this.microphoneWanted = false;
    this.microphonePublishPromise = null;
    this.signalConnected = false;
  }

  async destroy() {
    await this.disconnect();
    this.config = null;
    this.callbacks = {};
  }
}

export const liveKitService = new LiveKitService();
export default liveKitService;
