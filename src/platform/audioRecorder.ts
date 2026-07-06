/**
 * Web 實作：用 MediaRecorder API 錄音（見 spec.md §5.3a 語音快速記錄）。
 * 未來 RN 版需替換成原生錄音實作（例如 `expo-av`/`expo-audio`），呼叫端一律透過
 * `startRecording()` 拿到的 handle 操作，不直接碰 `MediaRecorder`/`navigator.mediaDevices`。
 */
export interface RecordingResult {
  blob: Blob;
  mimeType: string;
}

export interface AudioRecorderHandle {
  stop(): Promise<RecordingResult>;
}

/** 開始錄音；使用者拒絕麥克風權限或裝置不支援時會 reject。 */
export async function startRecording(): Promise<AudioRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<RecordingResult>((resolve) => {
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'audio/webm';
      stream.getTracks().forEach((track) => track.stop());
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType });
    };
  });

  recorder.start();

  return {
    stop: () => {
      recorder.stop();
      return stopped;
    },
  };
}
