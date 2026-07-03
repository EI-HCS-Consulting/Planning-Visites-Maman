// Le Blob renvoyé par supabase-js (storage .download()) n'implémente pas
// .arrayBuffer() sous React Native (contrairement au web) — FileReader est
// le seul chemin fiable pour en extraire les données binaires ici.
export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
