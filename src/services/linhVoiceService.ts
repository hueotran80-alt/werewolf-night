import { AccessToken } from 'livekit-server-sdk';
import {
  AudioFrame,
  AudioSource,
  LocalAudioTrack,
  Room,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { generateLinhSpeech } from './aiBotService';

const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const SAMPLES_PER_FRAME = 480; // 20ms @ 24kHz
const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2;

interface LinhVoiceRoom {
  room: Room;
  source: AudioSource;
  track: LocalAudioTrack;
  speaking: Promise<void>;
}

const sessions = new Map<string, LinhVoiceRoom>();

function getLiveKitUrl(): string | null {
  return process.env.LIVEKIT_URL || process.env.VITE_LIVEKIT_URL || null;
}

function toWsUrl(url: string): string {
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
  return url;
}

async function createSession(roomName: string): Promise<LinhVoiceRoom | null> {
  const url = getLiveKitUrl();
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    console.warn('[LINH VOICE] Missing LiveKit configuration.');
    return null;
  }

  const identity = `linh_ai_${roomName}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: '1h',
  });

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: false,
  });

  const jwt = await token.toJwt();
  const room = new Room();
  await room.connect(toWsUrl(url), jwt, {
    autoSubscribe: false,
  });

  const source = new AudioSource(SAMPLE_RATE, CHANNELS);
  const track = LocalAudioTrack.createAudioTrack('linh-ai-voice', source);
  const publishOptions = new TrackPublishOptions();
  publishOptions.source = TrackSource.SOURCE_MICROPHONE;

  await room.localParticipant.publishTrack(track, publishOptions);

  return {
    room,
    source,
    track,
    speaking: Promise.resolve(),
  };
}

async function getSession(roomName: string): Promise<LinhVoiceRoom | null> {
  const existing = sessions.get(roomName);
  if (existing) return existing;

  const created = await createSession(roomName);
  if (!created) return null;

  sessions.set(roomName, created);
  return created;
}

async function publishPcm(source: AudioSource, pcm: Buffer): Promise<void> {
  for (let offset = 0; offset < pcm.length; offset += BYTES_PER_FRAME) {
    const remaining = Math.min(BYTES_PER_FRAME, pcm.length - offset);
    const frameBytes = Buffer.alloc(BYTES_PER_FRAME);
    pcm.copy(frameBytes, 0, offset, offset + remaining);

    const samples = new Int16Array(
      frameBytes.buffer,
      frameBytes.byteOffset,
      SAMPLES_PER_FRAME,
    );

    await source.captureFrame(
      new AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME),
    );
  }
}

export async function speakLinhInRoom(roomName: string, text: string): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  let session: LinhVoiceRoom | null = null;

  try {
    session = await getSession(roomName);
    if (!session) return;

    // Xếp hàng câu nói để Linh không nói chồng lên chính mình.
    session.speaking = session.speaking.then(async () => {
      const audio = await generateLinhSpeech(cleanText);
      if (!audio) return;
      await publishPcm(session!.source, audio);
    });

    await session.speaking;
  } catch (error) {
    console.error('[LINH VOICE]', error);
  }
}

export async function disconnectLinhVoiceRoom(roomName: string): Promise<void> {
  const session = sessions.get(roomName);
  if (!session) return;

  sessions.delete(roomName);

  try {
    await session.track.close();
  } catch {}

  try {
    await session.room.disconnect();
  } catch {}
}

export async function disconnectAllLinhVoiceRooms(): Promise<void> {
  const roomNames = Array.from(sessions.keys());
  await Promise.all(roomNames.map(disconnectLinhVoiceRoom));
}
