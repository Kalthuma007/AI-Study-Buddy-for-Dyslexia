import { TeacherMaterial } from '../types';

/**
 * Compresses a string using GZIP and encodes it to Base64 (URL safe).
 */
export async function compressAndEncode(data: TeacherMaterial): Promise<string> {
  const jsonString = JSON.stringify(data);
  const stream = new Blob([jsonString]).stream();
  const compressedReadableStream = stream.pipeThrough(new CompressionStream("gzip"));
  const compressedResponse = await new Response(compressedReadableStream);
  const blob = await compressedResponse.blob();
  const buffer = await blob.arrayBuffer();
  
  // Convert to binary string
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  // Base64 encode and make URL safe
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a Base64 string, decompresses GZIP, and parses JSON.
 */
export async function decodeAndDecompress(encoded: string): Promise<TeacherMaterial | null> {
  try {
    // Restore Base64 from URL safe format
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
    const decompressedResponse = await new Response(decompressedStream);
    const text = await decompressedResponse.text();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to decompress shared link:", error);
    return null;
  }
}