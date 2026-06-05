const DEFAULT_BYTES = 100 * 1024 * 1024;
const MIN_BYTES = 1024;
const MAX_BYTES = 512 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024;

export function handleSpeedTest(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD' }
    });
  }

  const url = new URL(request.url);
  const bytes = parseBytes(url.searchParams.get('bytes'));
  const headers = {
    'content-type': 'application/octet-stream',
    'content-length': String(bytes),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  };

  if (request.method === 'HEAD') {
    return new Response(null, { headers });
  }

  return new Response(createByteStream(bytes), { headers });
}

function parseBytes(value: string | null): number {
  if (!value) {
    return DEFAULT_BYTES;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_BYTES;
  }
  return Math.min(Math.max(parsed, MIN_BYTES), MAX_BYTES);
}

function createByteStream(totalBytes: number): ReadableStream<Uint8Array> {
  let remaining = totalBytes;
  const chunk = new Uint8Array(CHUNK_SIZE);

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const size = Math.min(CHUNK_SIZE, remaining);
      controller.enqueue(size === CHUNK_SIZE ? chunk : chunk.subarray(0, size));
      remaining -= size;
    }
  });
}
