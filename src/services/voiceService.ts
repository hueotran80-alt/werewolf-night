// ============================================================================
// WEREWOLF - WebRTC Voice Service
// ============================================================================

export type VoiceStatusListener = (status: {
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened: boolean;
  audioLevel: number;
}) => void;

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  try {
    const raw =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('werewolf_turn_config')
        : null;

    if (raw) {
      const turn = JSON.parse(raw);

      if (turn?.urls) {
        servers.push(turn);
      }
    }
  } catch {
    // Ignore invalid TURN config
  }

  return servers;
}

type SignalSender = (
  targetPlayerId: string,
  signal: any
) => void;

class VoiceService {
  // --------------------------------------------------------------------------
  // LOCAL AUDIO
  // --------------------------------------------------------------------------

  private mediaStream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private animFrameId: number | null = null;

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  public isMuted = true;

  public isDeafened = false;

  public isSpeaking = false;

  public audioLevel = 0;

  private listeners = new Set<VoiceStatusListener>();

  private onSpeakingChangeCallback?: (
    speaking: boolean
  ) => void;

  private speakingThreshold = 10;

  // --------------------------------------------------------------------------
  // WEBRTC
  // --------------------------------------------------------------------------

  private localPlayerId: string | null = null;

  private signalSender: SignalSender | null = null;

  private peers = new Map<string, RTCPeerConnection>();

  private remoteAudioEls = new Map<
    string,
    HTMLAudioElement
  >();

  // Perfect negotiation state

  private makingOffer = new Set<string>();

  private ignoreOffer = new Set<string>();

  private pendingIceCandidates = new Map<
    string,
    RTCIceCandidateInit[]
  >();

  // --------------------------------------------------------------------------
  // SIGNALING
  // --------------------------------------------------------------------------

  public setSignalSender(fn: SignalSender | null) {
    this.signalSender = fn;
  }

  public setLocalPlayerId(id: string | null) {
    this.localPlayerId = id;
  }

  private shouldInitiate(remoteId: string): boolean {
    if (!this.localPlayerId) {
      return false;
    }

    // Chỉ một phía tạo offer đầu tiên.
    return this.localPlayerId < remoteId;
  }

  private sendSignal(
    peerId: string,
    signal: any
  ) {
    if (!this.signalSender) {
      console.warn(
        '[Voice] signalSender chưa được thiết lập'
      );
      return;
    }

    this.signalSender(peerId, signal);
  }

  // --------------------------------------------------------------------------
  // REMOTE AUDIO
  // --------------------------------------------------------------------------

  private ensureRemoteAudioEl(
    peerId: string
  ): HTMLAudioElement {
    let el = this.remoteAudioEls.get(peerId);

    if (!el) {
      el = document.createElement('audio');

      el.autoplay = true;
      el.controls = false;
      el.muted = false;
      el.volume = 1;
      el.playsInline = true;

      // Không display:none để tránh một số WebView
      // coi element là không hợp lệ cho playback.
      el.style.position = 'fixed';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.left = '-9999px';

      el.dataset.peerId = peerId;

      document.body.appendChild(el);

      this.remoteAudioEls.set(peerId, el);
    }

    return el;
  }

  private async playRemoteAudio(
    peerId: string,
    stream: MediaStream
  ) {
    const el = this.ensureRemoteAudioEl(peerId);

    el.srcObject = stream;
    el.muted = this.isDeafened;
    el.volume = 1;
    el.autoplay = true;
    el.playsInline = true;

    try {
      await el.play();

      console.log(
        `[Voice] 🔊 Remote audio PLAYING: ${peerId}`
      );
    } catch (error) {
      console.warn(
        `[Voice] Không autoplay được audio của ${peerId}`,
        error
      );
    }
  }

  private removeRemoteAudioEl(peerId: string) {
    const el = this.remoteAudioEls.get(peerId);

    if (el) {
      try {
        el.pause();
      } catch {}

      el.srcObject = null;
      el.remove();

      this.remoteAudioEls.delete(peerId);
    }
  }

  // --------------------------------------------------------------------------
  // PEER CONNECTION
  // --------------------------------------------------------------------------

  private createPeerConnection(
    peerId: string
  ): RTCPeerConnection {
    const existing = this.peers.get(peerId);

    if (existing) {
      return existing;
    }

    console.log(
      `[Voice] 🔗 Creating peer connection: ${peerId}`
    );

    const pc = new RTCPeerConnection({
      iceServers: getIceServers(),
      iceCandidatePoolSize: 10,
    });

    // Luôn có audio transceiver.
    //
    // Nếu chưa có mic:
    // recvonly.
    //
    // Sau khi getUserMedia:
    // track được add vào connection và renegotiate.
    if (this.mediaStream) {
      for (const track of this.mediaStream.getAudioTracks()) {
        pc.addTrack(track, this.mediaStream);
      }
    } else {
      pc.addTransceiver('audio', {
        direction: 'recvonly',
      });
    }

    // ------------------------------------------------------------------------
    // ICE
    // ------------------------------------------------------------------------

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      console.log(
        `[Voice] ICE -> ${peerId}`
      );

      this.sendSignal(peerId, {
        kind: 'ICE_CANDIDATE',
        candidate: event.candidate.toJSON(),
      });
    };

    // ------------------------------------------------------------------------
    // REMOTE TRACK
    // ------------------------------------------------------------------------

    pc.ontrack = async (event) => {
      console.log(
        `[Voice] 🎧 Remote track received from ${peerId}`,
        event.track.kind
      );

      let stream: MediaStream;

      if (event.streams && event.streams.length > 0) {
        stream = event.streams[0];
      } else {
        stream = new MediaStream();
        stream.addTrack(event.track);
      }

      await this.playRemoteAudio(
        peerId,
        stream
      );
    };

    // ------------------------------------------------------------------------
    // NEGOTIATION
    // ------------------------------------------------------------------------

    pc.onnegotiationneeded = async () => {
      if (!this.shouldInitiate(peerId)) {
        return;
      }

      if (
        pc.signalingState !== 'stable'
      ) {
        return;
      }

      if (this.makingOffer.has(peerId)) {
        return;
      }

      try {
        this.makingOffer.add(peerId);

        console.log(
          `[Voice] 📤 Creating offer -> ${peerId}`
        );

        const offer = await pc.createOffer();

        if (pc.signalingState !== 'stable') {
          return;
        }

        await pc.setLocalDescription(offer);

        this.sendSignal(peerId, {
          kind: 'SDP',
          description: pc.localDescription,
        });
      } catch (error) {
        console.error(
          `[Voice] Offer error -> ${peerId}`,
          error
        );
      } finally {
        this.makingOffer.delete(peerId);
      }
    };

    // ------------------------------------------------------------------------
    // CONNECTION STATE
    // ------------------------------------------------------------------------

    pc.onconnectionstatechange = () => {
      console.log(
        `[Voice] ${peerId} connectionState = ${pc.connectionState}`
      );

      if (
        pc.connectionState === 'failed'
      ) {
        console.warn(
          `[Voice] ❌ Connection failed: ${peerId}`
        );

        // Có thể thử ICE restart ở đây.
        try {
          pc.restartIce();
        } catch {}
      }

      if (
        pc.connectionState === 'closed'
      ) {
        this.closePeer(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(
        `[Voice] ${peerId} iceConnectionState = ${pc.iceConnectionState}`
      );
    };

    this.peers.set(peerId, pc);

    return pc;
  }

  // --------------------------------------------------------------------------
  // CLOSE PEER
  // --------------------------------------------------------------------------

  private closePeer(peerId: string) {
    const pc = this.peers.get(peerId);

    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onnegotiationneeded = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch {}

      this.peers.delete(peerId);
    }

    this.ignoreOffer.delete(peerId);
    this.makingOffer.delete(peerId);
    this.pendingIceCandidates.delete(peerId);

    this.removeRemoteAudioEl(peerId);
  }

  // --------------------------------------------------------------------------
  // SYNC ROOM
  // --------------------------------------------------------------------------

  public syncRoomPeers(
    activePeerIds: string[]
  ) {
    const activeSet =
      new Set(activePeerIds);

    // Đóng peer không còn trong phòng.

    for (
      const peerId of Array.from(
        this.peers.keys()
      )
    ) {
      if (!activeSet.has(peerId)) {
        console.log(
          `[Voice] Removing peer ${peerId}`
        );

        this.closePeer(peerId);
      }
    }

    // Tạo peer mới.

    for (const peerId of activePeerIds) {
      if (
        !peerId ||
        peerId === this.localPlayerId
      ) {
        continue;
      }

      if (!this.peers.has(peerId)) {
        this.createPeerConnection(peerId);
      }
    }
  }

  // --------------------------------------------------------------------------
  // REMOTE SIGNAL
  // --------------------------------------------------------------------------

  public async handleRemoteSignal(
    fromPlayerId: string,
    signal: any
  ) {
    if (!fromPlayerId || !signal) {
      return;
    }

    const pc =
      this.peers.get(fromPlayerId) ||
      this.createPeerConnection(
        fromPlayerId
      );

    try {
      // ----------------------------------------------------------------------
      // SDP
      // ----------------------------------------------------------------------

      if (
        signal.kind === 'SDP' &&
        signal.description
      ) {
        const description =
          signal.description as RTCSessionDescriptionInit;

        const isOffer =
          description.type === 'offer';

        const offerCollision =
          isOffer &&
          (
            this.makingOffer.has(
              fromPlayerId
            ) ||
            pc.signalingState !== 'stable'
          );

        const polite =
          !this.shouldInitiate(
            fromPlayerId
          );

        this.ignoreOffer.delete(
          fromPlayerId
        );

        if (
          offerCollision &&
          !polite
        ) {
          console.log(
            `[Voice] Ignoring collided offer from ${fromPlayerId}`
          );

          this.ignoreOffer.add(
            fromPlayerId
          );

          return;
        }

        // Nếu mình là bên lịch sự và bị collision,
        // rollback offer hiện tại.

        if (
          offerCollision &&
          polite &&
          pc.signalingState !== 'stable'
        ) {
          try {
            await pc.setLocalDescription({
              type: 'rollback',
            });
          } catch (rollbackError) {
            console.warn(
              '[Voice] Rollback failed',
              rollbackError
            );
          }
        }

        await pc.setRemoteDescription(
          description
        );

        // --------------------------------------------------------------------
        // Flush ICE chờ trước đó.
        // --------------------------------------------------------------------

        const pending =
          this.pendingIceCandidates.get(
            fromPlayerId
          ) || [];

        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(
              candidate
            );
          } catch (error) {
            console.warn(
              '[Voice] Pending ICE failed',
              error
            );
          }
        }

        this.pendingIceCandidates.delete(
          fromPlayerId
        );

        // --------------------------------------------------------------------
        // Offer -> Answer
        // --------------------------------------------------------------------

        if (isOffer) {
          const answer =
            await pc.createAnswer();

          await pc.setLocalDescription(
            answer
          );

          console.log(
            `[Voice] 📤 Answer -> ${fromPlayerId}`
          );

          this.sendSignal(
            fromPlayerId,
            {
              kind: 'SDP',
              description:
                pc.localDescription,
            }
          );
        }

        return;
      }

      // ----------------------------------------------------------------------
      // ICE CANDIDATE
      // ----------------------------------------------------------------------

      if (
        signal.kind ===
          'ICE_CANDIDATE' &&
        signal.candidate
      ) {
        const candidate =
          signal.candidate as RTCIceCandidateInit;

        // ICE đến trước remote SDP -> giữ lại.
        if (
          !pc.remoteDescription
        ) {
          const list =
            this.pendingIceCandidates.get(
              fromPlayerId
            ) || [];

          list.push(candidate);

          this.pendingIceCandidates.set(
            fromPlayerId,
            list
          );

          console.log(
            `[Voice] ICE queued -> ${fromPlayerId}`
          );

          return;
        }

        if (
          this.ignoreOffer.has(
            fromPlayerId
          )
        ) {
          return;
        }

        try {
          await pc.addIceCandidate(
            candidate
          );

          console.log(
            `[Voice] ICE added <- ${fromPlayerId}`
          );
        } catch (error) {
          console.warn(
            `[Voice] addIceCandidate failed <- ${fromPlayerId}`,
            error
          );
        }

        return;
      }
    } catch (error) {
      console.error(
        `[Voice] Signal handling failed from ${fromPlayerId}`,
        error
      );
    }
  }

  // --------------------------------------------------------------------------
  // MICROPHONE
  // --------------------------------------------------------------------------

  public async initMicrophone(): Promise<boolean> {
    try {
      if (this.mediaStream) {
        return true;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices
          .getUserMedia !== 'function'
      ) {
        console.error(
          '[Voice] getUserMedia không khả dụng'
        );

        return false;
      }

      console.log(
        '[Voice] 🎤 Requesting microphone permission...'
      );

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
            video: false,
          }
        );

      console.log(
        '[Voice] ✅ Microphone permission granted'
      );

      this.mediaStream = stream;

      // ----------------------------------------------------------------------
      // Audio analyser
      // ----------------------------------------------------------------------

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as any)
            .webkitAudioContext;

        if (AudioCtx) {
          this.audioContext =
            new AudioCtx();

          this.analyser =
            this.audioContext.createAnalyser();

          this.analyser.fftSize = 256;

          this.analyser.smoothingTimeConstant =
            0.4;

          this.sourceNode =
            this.audioContext.createMediaStreamSource(
              stream
            );

          this.sourceNode.connect(
            this.analyser
          );

          this.startLevelMonitoring();
        }
      } catch (error) {
        console.warn(
          '[Voice] Audio analyser failed',
          error
        );
      }

      // Ban đầu muted.

      this.muteTracks(true);

      this.isMuted = true;
      this.isSpeaking = false;
      this.audioLevel = 0;

      this.notify();

      // ----------------------------------------------------------------------
      // Add microphone track vào các peer đang tồn tại.
      // ----------------------------------------------------------------------

      for (const [
        peerId,
        pc,
      ] of this.peers) {
        const hasAudioSender =
          pc
            .getSenders()
            .some(
              (sender) =>
                sender.track?.kind ===
                'audio'
            );

        if (!hasAudioSender) {
          for (const track of stream.getAudioTracks()) {
            pc.addTrack(
              track,
              stream
            );
          }

          console.log(
            `[Voice] 🎤 Audio track added -> ${peerId}`
          );
        }
      }

      return true;
    } catch (error) {
      console.error(
        '[Voice] ❌ Microphone permission/access failed:',
        error
      );

      return false;
    }
  }

  private muteTracks(
    muted: boolean
  ) {
    if (!this.mediaStream) {
      return;
    }

    for (const track of this.mediaStream.getAudioTracks()) {
      track.enabled = !muted;
    }
  }

  // --------------------------------------------------------------------------
  // TOGGLE MICROPHONE
  // --------------------------------------------------------------------------

  public async toggleMute(): Promise<boolean> {
    if (!this.mediaStream) {
      const initialized =
        await this.initMicrophone();

      if (!initialized) {
        return false;
      }
    }

    const nextMuted =
      !this.isMuted;

    this.isMuted = nextMuted;

    this.muteTracks(
      this.isMuted
    );

    if (this.isMuted) {
      this.isSpeaking = false;
      this.audioLevel = 0;

      this.onSpeakingChangeCallback?.(
        false
      );
    } else {
      if (
        this.audioContext &&
        this.audioContext.state ===
          'suspended'
      ) {
        try {
          await this.audioContext.resume();
        } catch {}
      }
    }

    this.notify();

    console.log(
      `[Voice] Mic ${this.isMuted ? 'MUTED' : 'UNMUTED'}`
    );

    return !this.isMuted;
  }

  // --------------------------------------------------------------------------
  // FORCE MUTE
  // --------------------------------------------------------------------------

  public forceMute() {
    this.isMuted = true;

    this.muteTracks(true);

    this.isSpeaking = false;

    this.audioLevel = 0;

    this.onSpeakingChangeCallback?.(
      false
    );

    this.notify();
  }

  // --------------------------------------------------------------------------
  // DEAFEN
  // --------------------------------------------------------------------------

  public toggleDeafen(): boolean {
    this.isDeafened =
      !this.isDeafened;

    if (this.isDeafened) {
      this.forceMute();
    }

    for (const el of this.remoteAudioEls.values()) {
      el.muted =
        this.isDeafened;
    }

    this.notify();

    return this.isDeafened;
  }

  // --------------------------------------------------------------------------
  // SPEAKING DETECTION
  // --------------------------------------------------------------------------

  private startLevelMonitoring() {
    if (!this.analyser) {
      return;
    }

    const bufferLength =
      this.analyser.frequencyBinCount;

    const dataArray =
      new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!this.analyser) {
        return;
      }

      if (this.isMuted) {
        this.audioLevel = 0;

        if (this.isSpeaking) {
          this.isSpeaking = false;

          this.onSpeakingChangeCallback?.(
            false
          );

          this.notify();
        }

        this.animFrameId =
          requestAnimationFrame(
            checkLevel
          );

        return;
      }

      this.analyser.getByteFrequencyData(
        dataArray
      );

      let sum = 0;

      for (
        let i = 0;
        i < bufferLength;
        i++
      ) {
        sum += dataArray[i];
      }

      const average =
        sum / bufferLength;

      const level = Math.min(
        100,
        Math.round(
          (average / 128) * 100
        )
      );

      this.audioLevel = level;

      const speaking =
        level >
        this.speakingThreshold;

      if (
        speaking !==
        this.isSpeaking
      ) {
        this.isSpeaking =
          speaking;

        this.onSpeakingChangeCallback?.(
          speaking
        );
      }

      this.notify();

      this.animFrameId =
        requestAnimationFrame(
          checkLevel
        );
    };

    this.animFrameId =
      requestAnimationFrame(
        checkLevel
      );
  }

  // --------------------------------------------------------------------------
  // SUBSCRIBE
  // --------------------------------------------------------------------------

  public subscribe(
    listener: VoiceStatusListener
  ): () => void {
    this.listeners.add(
      listener
    );

    listener({
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      isDeafened: this.isDeafened,
      audioLevel: this.audioLevel,
    });

    return () => {
      this.listeners.delete(
        listener
      );
    };
  }

  public setOnSpeakingChange(
    callback: (speaking: boolean) => void
  ) {
    this.onSpeakingChangeCallback =
      callback;
  }

  private notify() {
    const status = {
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      isDeafened: this.isDeafened,
      audioLevel: this.audioLevel,
    };

    this.listeners.forEach(
      (listener) =>
        listener(status)
    );
  }

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------

  public teardownAllPeers() {
    for (const peerId of Array.from(
      this.peers.keys()
    )) {
      this.closePeer(peerId);
    }
  }

  public cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(
        this.animFrameId
      );

      this.animFrameId = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }

      this.mediaStream = null;
    }

    if (
      this.audioContext &&
      this.audioContext.state !==
        'closed'
    ) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.teardownAllPeers();
  }
}

export const voiceService =
  new VoiceService();