export const isNative = () => '__TAURI_INTERNALS__' in window;
export function download(bytes: Uint8Array | string, name: string) {
  const url = URL.createObjectURL(new Blob([typeof bytes === 'string' ? bytes : bytes.slice().buffer as ArrayBuffer]));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function openNative() {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const path = await open({ multiple: false, filters: [{ name: 'Presentations', extensions: ['slidecloud', 'pptx'] }] });
  if (typeof path !== 'string') return null;
  const { invoke } = await import('@tauri-apps/api/core');
  return { path, name: path.split(/[\\/]/).pop()!, bytes: new Uint8Array(await invoke<number[]>('read_binary_file', { path })) };
}
export async function writeNative(bytes: Uint8Array | string, name: string, existing?: { path: string; bytes: Uint8Array }) {
  const { save } = await import('@tauri-apps/plugin-dialog'), { invoke } = await import('@tauri-apps/api/core');
  const path = existing?.path || await save({ defaultPath: name, filters: [{ name: 'Presentation', extensions: [name.split('.').pop()!] }] });
  if (!path) return null;
  if (existing) {
    const actual = await invoke<number[]>('read_binary_file', { path });
    if (actual.length !== existing.bytes.length || actual.some((v, i) => v !== existing.bytes[i])) throw new Error('This file changed outside Slide Cloud. Use Save As to preserve both copies.');
  }
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  await invoke('write_binary_file_atomic', { path, data: Array.from(data) }); return { path, bytes: data };
}
