// Points at the same backend your website already talks to. Overridable via EXPO_PUBLIC_API_URL
// (Expo's equivalent of Vite's VITE_ prefix - baked in at build time) if you ever stand up a
// staging backend, but defaulting straight to production means this works out of the box in
// Expo Go on a real phone with zero extra setup - no localhost/network-address juggling.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://backend-production-8744.up.railway.app/api';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown, public retryAfterSeconds?: number) {
    super(message);
  }
}

// This SDK's global `fetch` resolves to Expo's own "winter" runtime (expo/src/winter/fetch), and
// its FormData->multipart converter (expo/src/winter/fetch/convertFormData.ts) explicitly does
// NOT support the classic RN `{uri, name, type}` file-part shape ("`uri` is not supported for
// React Native's FormData") - only a string, a real `Blob`, or an object with a `.bytes()` method.
//
// Getting that Blob is its own trap: React Native's global `Blob` class (Libraries/Blob/Blob.js)
// only supports constructing from OTHER Blobs/strings - `new Blob([arrayBuffer])` throws
// "Creating blobs from 'ArrayBuffer' ... are not supported", so reading the file into an
// ArrayBuffer and wrapping it doesn't work either. The one thing that reliably produces a real,
// natively-backed Blob from a local file URI is RN's own `fetch(uri).blob()` - it reads the file
// through native code and constructs the Blob internally, bypassing the public constructor's
// parts-array restriction entirely.
//
// The blob's inferred `.type` from a local file read isn't always the caller's intended mimeType
// (and an empty type means the multipart part gets no Content-Type header at all, which the
// backend's mimetype allowlist would then reject) - `.slice()` re-tags the type on a zero-copy
// VIEW of the same data (also implemented directly on Blob.js, not through the restricted
// constructor), so this always uploads with the exact mimeType the caller asked for.
export async function createUploadFormData(fieldName: string, fileUri: string, fileName: string, mimeType: string): Promise<FormData> {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();
  const typedBlob = blob.slice(0, blob.size, mimeType);
  const formData = new FormData();
  formData.append(fieldName, typedBlob, fileName);
  return formData;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    throw new ApiError(response.status, data?.error ?? 'Something went wrong.', data, retryAfterSeconds);
  }
  return data as T;
}
