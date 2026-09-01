// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Voice Call & Audio Service
// ----------------------------------------------------------------------------


export type VoiceStatusListener = (status: {
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened: boolean;
  audioLevel: number;
}) => void;


const DEFAULT_TURN_SERVERS: RTCIceServer[] = [
  {
    urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "8b6f72614578bbef2c456059",
            credential: "/GLSMstQ96xt4dPM",
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "8b6f72614578bbef2c456059",
            credential: "/GLSMstQ96xt4dPM",
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "8b6f72614578bbef2c456059",
            credential: "/GLSMstQ96xt4dPM",
  },
];

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('werewolf_turn_config') : null;
    if (raw) {
      const turn = JSON.parse(raw);
      if (turn?.urls) {
        servers.push(turn);
        // Vẫn giữ TURN mặc định làm phương án dự phòng nếu TURN tùy chỉnh lỗi.
        servers.push(...DEFAULT_TURN_SERVERS);
        return servers;
      }
    }
  } catch {
    // ignore malformed TURN config
  }
  servers.push(...DEFAULT_TURN_SERVERS);
  return servers;
}

type SignalSender = (targetPlayerId: string, signal: any) => void;

class VoiceService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;

  public isMuted: boolean = true;
  public isDeafened: boolean = false;
  public isSpeaking: boolean = false;
  public audioLevel: number = 0; // 0 to 100

  private listeners: Set<VoiceStatusListener> = new Set();
  private speakingThreshold = 12; // Audio level threshold to trigger speaking state
  private onSpeakingChangeCallback?: (isSpeaking: boolean) => void;
  private onMicErrorCallback?: (message: string) => void;

  /** GameContext/VoiceCallBar đăng ký hàm này để hiện thông báo lỗi rõ ràng
   *  cho người dùng khi không xin được quyền micro, thay vì im lặng thất bại. */
  public setOnMicError(cb: (message: string) => void) {
    this.onMicErrorCallback = cb;
  }

  // --- WebRTC mesh state ---
  private localPlayerId: string | null = null;
  private signalSender: SignalSender | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioEls: Map<string, HTMLAudioElement> = new Map();
  private makingOffer: Set<string> = new Set();

  /** GameContext gọi hàm này để cấp "đường dây" gửi tín hiệu qua WebSocket máy chủ cloud. */
  public setSignalSender(fn: SignalSender | null) {
    this.signalSender = fn;
  }

  public setLocalPlayerId(id: string | null) {
    this.localPlayerId = id;
  }

  /** true nếu nên là bên chủ động gửi offer trước (tránh 2 bên cùng gửi offer). */
  private shouldInitiate(remoteId: string): boolean {
    if (!this.localPlayerId) return false;
    return this.localPlayerId < remoteId;
  }

  private ensureRemoteAudioEl(peerId: string): HTMLAudioElement {
    let el = this.remoteAudioEls.get(peerId);
    if (!el && typeof document !== 'undefined') {
      el = document.createElement('audio');
      el.autoplay = true;
      // @ts-ignore - iOS Safari / WebView cần playsInline
      el.playsInline = true;
      el.style.display = 'none';
      el.dataset.peerId = peerId;
      document.body.appendChild(el);
      this.remoteAudioEls.set(peerId, el);
    }
    return el as HTMLAudioElement;
  }

  private removeRemoteAudioEl(peerId: string) {
    const el = this.remoteAudioEls.get(peerId);
    if (el) {
      el.srcObject = null;
      el.remove();
      this.remoteAudioEls.delete(peerId);
    }
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    // Luôn có transceiver audio: nếu chưa xin được mic thì chỉ nhận (recvonly).
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => pc.addTrack(track, this.mediaStream!));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.signalSender) {
        this.signalSender(peerId, { kind: 'ICE_CANDIDATE', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const el = this.ensureRemoteAudioEl(peerId);
      const [stream] = event.streams;
      if (stream) el.srcObject = stream;
      el.muted = this.isDeafened;
    };

    pc.onnegotiationneeded = async () => {
      if (!this.shouldInitiate(peerId)) return;
      try {
        this.makingOffer.add(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.signalSender?.(peerId, { kind: 'SDP', description: pc.localDescription });
      } catch (e) {
        console.warn('WebRTC negotiation failed:', e);
      } finally {
        this.makingOffer.delete(peerId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(peerId);
      }
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private closePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.peers.delete(peerId);
    }
    this.removeRemoteAudioEl(peerId);
  }

  /**
   * Đồng bộ danh sách bạn chơi hiện có trong phòng (không gồm chính mình):
   * tạo kết nối thoại mới cho người vừa vào, đóng kết nối cho người đã rời.
   */
  public syncRoomPeers(activePeerIds: string[]) {
    const activeSet = new Set(activePeerIds);

    // Đóng kết nối với người không còn trong phòng
    for (const existingId of Array.from(this.peers.keys())) {
      if (!activeSet.has(existingId)) {
        this.closePeer(existingId);
      }
    }

    // Mở kết nối mới cho người chơi chưa có kết nối
    activePeerIds.forEach((peerId) => {
      if (!this.peers.has(peerId)) {
        this.createPeerConnection(peerId);
      }
    });
  }

  /** Xử lý tín hiệu SDP/ICE nhận được từ một người chơi khác (chuyển tiếp qua máy chủ cloud). */
  public async handleRemoteSignal(fromPlayerId: string, signal: any) {
    if (!signal) return;
    const pc = this.peers.get(fromPlayerId) || this.createPeerConnection(fromPlayerId);

    try {
      if (signal.kind === 'SDP' && signal.description) {
        const desc = signal.description;
        const offerCollision = desc.type === 'offer' && (this.makingOffer.has(fromPlayerId) || pc.signalingState !== 'stable');

        // "Politeness": bên có id lớn hơn nhường (rollback) nếu va chạm offer.
        const polite = !this.shouldInitiate(fromPlayerId);
        if (offerCollision && !polite) {
          return; // bỏ qua offer đối phương, chờ offer của mình được chấp nhận
        }

        await pc.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signalSender?.(fromPlayerId, { kind: 'SDP', description: pc.localDescription });
        }
      } else if (signal.kind === 'ICE_CANDIDATE' && signal.candidate) {
        await pc.addIceCandidate(signal.candidate).catch(() => {
          // Có thể tới trước khi remoteDescription sẵn sàng - bỏ qua an toàn.
        });
      }
    } catch (e) {
      console.warn('WebRTC signal handling error:', e);
    }
  }

  /** Ngắt toàn bộ cuộc gọi thoại (khi rời phòng). */
  public teardownAllPeers() {
    Array.from(this.peers.keys()).forEach((id) => this.closePeer(id));
  }

  public subscribe(listener: VoiceStatusListener): () => void {
    this.listeners.add(listener);
    listener({
      isMuted: this.isMuted,
      isSpeaking: this.isSpeaking,
      isDeafened: this.isDeafened,
      audioLevel: this.audioLevel,
    });
    return () => this.listeners.delete(listener);
  }

  public setOnSpeakingChange(cb: (isSpeaking: boolean) => void) {
    this.onSpeakingChangeCallback = cb;
  }

  private notify() {
    this.listeners.forEach((l) =>
      l({
        isMuted: this.isMuted,
        isSpeaking: this.isSpeaking,
        isDeafened: this.isDeafened,
        audioLevel: this.audioLevel,
      })
    );
  }

  // Initialize Microphone
  public async initMicrophone(): Promise<boolean> {
    try {
      if (this.mediaStream) {
        return true;
      }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        console.warn('getUserMedia is not supported or accessible in this environment.');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          this.analyser.smoothingTimeConstant = 0.4;

          this.sourceNode = this.audioContext.createMediaStreamSource(stream);
          this.sourceNode.connect(this.analyser);

          this.startLevelMonitoring();
        }
      } catch (audioErr) {
        console.warn('AudioContext creation failed:', audioErr);
      }

      // Initial state: Start muted
      this.muteTracks(true);
      this.isMuted = true;
      this.notify();

      // Nếu đã có kết nối thoại (recvonly) từ trước khi có mic, gắn track mic
      // vào các kết nối đó luôn để chúng tự thương lượng lại (renegotiate).
      this.peers.forEach((pc) => {
        const alreadyHasAudioSender = pc.getSenders().some((s) => s.track?.kind === 'audio');
        if (!alreadyHasAudioSender) {
          stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
        }
      });

      return true;
    } catch (err: any) {
      console.warn('Microphone access not granted or not available:', err);

      // Phân loại lỗi để đưa ra hướng dẫn cụ thể thay vì chỉ thất bại âm thầm
      // (đây chính là nguyên nhân người dùng thấy nút mic "không phản ứng gì"
      // mà không hiểu vì sao).
      let message = 'Không thể truy cập micro. Vui lòng kiểm tra lại quyền ứng dụng.';
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        message =
          'Bạn đã từ chối quyền Micro. Vào Cài đặt điện thoại → Ứng dụng → Ma Sói: Đêm Lừa Dối → Quyền → bật "Micro", rồi mở lại app.';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        message = 'Không tìm thấy micro trên thiết bị này.';
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        message = 'Micro đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.';
      }

      if (this.onMicErrorCallback) this.onMicErrorCallback(message);
      return false;
    }
  }

  private muteTracks(muted: boolean) {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  // Toggle Mute
  public async toggleMute(): Promise<boolean> {
    if (!this.mediaStream) {
      const initialized = await this.initMicrophone();
      if (!initialized) {
        return false;
      }
    }

    const nextMuted = !this.isMuted;
    this.isMuted = nextMuted;
    this.muteTracks(this.isMuted);

    if (this.isMuted) {
      this.isSpeaking = false;
      this.audioLevel = 0;
      if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
      this.playMicToggleSound(false);
    } else {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (e) {
          console.warn('Could not resume audioContext:', e);
        }
      }
      this.playMicToggleSound(true);
    }

    this.notify();
    return !this.isMuted;
  }

  // Force mute (Called when night starts or player is silenced by Lieu)
  public forceMute() {
    this.isMuted = true;
    this.muteTracks(true);
    this.isSpeaking = false;
    this.audioLevel = 0;
    if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
    this.notify();
  }

  // Toggle Deafen (Hearing others)
  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened;
    if (this.isDeafened && !this.isMuted) {
      // If deafened, also mute mic
      this.forceMute();
    }
    // Deafen cũng nghĩa là không nghe người khác nói
    this.remoteAudioEls.forEach((el) => {
      el.muted = this.isDeafened;
    });
    this.notify();
    return this.isDeafened;
  }

  // Live audio level analysis
  private startLevelMonitoring() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!this.analyser || this.isMuted) {
        if (this.isSpeaking) {
          this.isSpeaking = false;
          this.audioLevel = 0;
          if (this.onSpeakingChangeCallback) this.onSpeakingChangeCallback(false);
          this.notify();
        }
        this.animFrameId = requestAnimationFrame(checkLevel);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalizedLevel = Math.min(100, Math.round((average / 128) * 100));

      this.audioLevel = normalizedLevel;

      const wasSpeaking = this.isSpeaking;
      const isNowSpeaking = normalizedLevel > this.speakingThreshold;

      if (wasSpeaking !== isNowSpeaking) {
        this.isSpeaking = isNowSpeaking;
        if (this.onSpeakingChangeCallback) {
          this.onSpeakingChangeCallback(isNowSpeaking);
        }
      }

      this.notify();
      this.animFrameId = requestAnimationFrame(checkLevel);
    };

    this.animFrameId = requestAnimationFrame(checkLevel);
  }

  // Clean Audio Sound Effects (Web Audio API)
  private playMicToggleSound(unmuted: boolean) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (unmuted) {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.1);
      }

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not permitted yet
    }
  }

  public playSilenceCurseSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // Audio ignored
    }
  }

  public cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.teardownAllPeers();
  }
}

export const voiceService = new VoiceService();
