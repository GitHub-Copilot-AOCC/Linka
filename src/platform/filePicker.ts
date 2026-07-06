/**
 * Web 實作：用隱藏的 `<input type="file">` 觸發原生檔案選取對話框（見 spec.md §4、§8.2）。
 * 未來 RN 版需替換成原生實作（例如 `react-native-image-picker`/`expo-document-picker`），
 * 呼叫端一律透過 `pickFile()` 這個介面，不直接碰 DOM input 元素，才能只換掉這個檔案就完成平台切換。
 */
export interface PickFileOptions {
  /** 對應 `<input accept>`，例如 'image/*'、'.vcf,text/vcard'。 */
  accept?: string;
  /** 對應 `<input capture>`，行動裝置上優先開啟相機（'environment' 後鏡、'user' 前鏡）。 */
  capture?: 'environment' | 'user';
}

/** 選取單一檔案；使用者取消選取則回傳 null。 */
export function pickFile(options: PickFileOptions = {}): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) input.accept = options.accept;
    if (options.capture) input.setAttribute('capture', options.capture);

    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    input.click();
  });
}
