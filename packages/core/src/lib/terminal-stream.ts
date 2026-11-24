export interface TerminalBytePayload {
  /** Base64 from the native side; arrays are accepted for older emitters. */
  bytes?: number[] | Uint8Array | string;
  data?: string;
  offset: number;
}

/** Decode a native payload's raw PTY bytes without a UTF-8 round trip. */
export function terminalPayloadBytes(payload: {
  bytes?: number[] | Uint8Array | string;
  data?: string;
}): Uint8Array {
  const { bytes } = payload;
  if (typeof bytes === "string") {
    const binary = atob(bytes);
    const decoded = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      decoded[i] = binary.charCodeAt(i);
    }
    return decoded;
  }
  if (bytes) {
    return bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  }
  return new TextEncoder().encode(payload.data ?? "");
}

/** Native offsets are UTF-8 byte positions, never JavaScript string lengths. */
export function takeTerminalBytes(
  payload: TerminalBytePayload,
  currentOffset: number
) {
  const bytes = terminalPayloadBytes(payload);
  const end = payload.offset + bytes.length;
  if (end <= currentOffset) {
    return { data: new Uint8Array(), nextOffset: currentOffset };
  }
  return {
    data: bytes.subarray(Math.max(0, currentOffset - payload.offset)),
    nextOffset: end,
  };
}
