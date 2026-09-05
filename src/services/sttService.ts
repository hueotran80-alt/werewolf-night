/**
 * STT phía client cho người chơi.
 *
 * Ưu tiên Web Speech API để không tốn Gemini quota cho từng câu nói.
 * Nếu trình duyệt/WebView không hỗ trợ SpeechRecognition thì trả về lỗi
 * rõ ràng để tầng UI có thể fallback sang STT server sau này.
 */

export interface SpeechToTextOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface SpeechToTextSession {
  stop: () => void;
  abort: () => void;
  isRunning: () => boolean;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechToTextSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export function startSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextSession {
  const Recognition = getSpeechRecognitionConstructor();

  if (!Recognition) {
    const message = 'Thiết bị/trình duyệt hiện tại không hỗ trợ nhận dạng giọng nói.';
    options.onError?.(message);

    return {
      stop: () => undefined,
      abort: () => undefined,
      isRunning: () => false,
    };
  }

  const recognition = new Recognition();
  let running = false;

  recognition.lang = options.language || 'vi-VN';
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    running = true;
    options.onStart?.();
  };

  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0]?.transcript?.trim() || '';
      if (!transcript) continue;

      if (result.isFinal) {
        finalText += `${transcript} `;
      } else {
        interim += `${transcript} `;
      }
    }

    if (interim) options.onInterim?.(interim.trim());
    if (finalText) options.onFinal?.(finalText.trim());
  };

  recognition.onerror = (event) => {
    const messages: Record<string, string> = {
      'not-allowed': 'Bạn chưa cấp quyền sử dụng micro.',
      'service-not-allowed': 'Dịch vụ nhận dạng giọng nói không được phép trên thiết bị này.',
      'no-speech': 'Không nhận được giọng nói.',
      'audio-capture': 'Không thể truy cập micro.',
      network: 'Lỗi mạng khi nhận dạng giọng nói.',
    };

    options.onError?.(messages[event.error] || `STT lỗi: ${event.error}`);
  };

  recognition.onend = () => {
    running = false;
    options.onEnd?.();
  };

  try {
    recognition.start();
  } catch (error) {
    running = false;
    options.onError?.(error instanceof Error ? error.message : 'Không thể khởi động STT.');
  }

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
    isRunning: () => running,
  };
}

export function transcribeOnce(language = 'vi-VN'): Promise<string> {
  return new Promise((resolve, reject) => {
    let finalText = '';

    const session = startSpeechToText({
      language,
      continuous: false,
      interimResults: true,
      onFinal: (text) => {
        finalText = `${finalText} ${text}`.trim();
      },
      onEnd: () => {
        if (finalText) resolve(finalText);
        else reject(new Error('Không nhận được nội dung giọng nói.'));
      },
      onError: (error) => reject(new Error(error)),
    });

    void session;
  });
}
