const ipMap = new Map<string, number[]>();

export function checkRateLimit(ip: string, limit = 60, windowMs = 60000): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (ipMap.get(ip) || []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    ipMap.set(ip, timestamps);
    return {
      success: false,
      remaining: 0,
      reset: Math.ceil((timestamps[0] + windowMs - now) / 1000),
    };
  }

  timestamps.push(now);
  ipMap.set(ip, timestamps);
  return {
    success: true,
    remaining: limit - timestamps.length,
    reset: Math.ceil(windowMs / 1000),
  };
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp.trim();
  }
  return '127.0.0.1';
}
