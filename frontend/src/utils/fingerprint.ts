// frontend/src/utils/fingerprint.ts

/**
 * Generates a fast, non-blocking hardware & browser fingerprint hash.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth.toString(),
    screen.width.toString() + "x" + screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency?.toString() || "unknown",
  ];

  const fingerprintString = components.join("||");

  // Fallback persistent tracking UUID inside localStorage to detect profile tampering
  let trackingUuid = localStorage.getItem("postra_device_uuid");
  if (!trackingUuid) {
    trackingUuid = crypto.randomUUID();
    localStorage.setItem("postra_device_uuid", trackingUuid);
  }

  const combinedString = `${fingerprintString}||${trackingUuid}`;

  // Generate SHA-256 hash using native browser crypto API
  const msgBuffer = new TextEncoder().encode(combinedString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}