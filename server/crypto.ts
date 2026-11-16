function bytes64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function base64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value));
}
async function key(secret: string) {
  const bytes = bytes64(secret);
  if (bytes.length !== 32) throw new Error("Encryption configuration invalid");
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encrypt(value: string, secret: string, userId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const result = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(userId) },
    await key(secret),
    new TextEncoder().encode(value),
  );
  return `v1.${base64(iv)}.${base64(new Uint8Array(result))}`;
}
export async function decrypt(value: string, secret: string, userId: string) {
  const [version, iv, body] = value.split(".");
  if (version !== "v1") throw new Error("Invalid encrypted credential");
  const result = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes64(iv),
      additionalData: new TextEncoder().encode(userId),
    },
    await key(secret),
    bytes64(body),
  );
  return new TextDecoder().decode(result);
}
