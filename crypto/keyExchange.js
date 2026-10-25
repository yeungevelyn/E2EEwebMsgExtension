/**
 * Public-key export and import for the E2EE extension.
 *
 * Algorithm: ECDH
 * Curve: P-256
 *
 * Bundle format, validation and fingerprint match E2EEKeyManager, so a bundle
 * from either side is accepted by the other. This module handles public keys
 * only. Private keys must never be included in an exported public-key bundle.
 */

const KEY_FORMAT = "E2EEwebMsgExtension-public-key";
const KEY_VERSION = 1;
const KEY_ALGORITHM = "ECDH";
const KEY_CURVE = "P-256";

/**
 * Fingerprint of a public JWK. Same canonical string and colon-hex output
 * as E2EEKeyManager.fingerprintPublicJwk.
 */
async function fingerprintPublicJwk(jwk) {
  const canonical = new TextEncoder().encode(
    `${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}`
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", canonical));

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .match(/.{2}/g)
    .join(":")
    .toUpperCase();
}

/**
 * Export an ECDH public key into a JSON string that can be shared.
 *
 * @param {CryptoKey} publicKey - The public key to export.
 * @returns {Promise<string>} A serialized public-key bundle.
 */
export async function exportPublicKey(publicKey) {
  if (!publicKey || publicKey.type !== "public") {
    throw new TypeError("A public key is required.");
  }

  if (
    publicKey.algorithm.name !== KEY_ALGORITHM ||
    publicKey.algorithm.namedCurve !== KEY_CURVE
  ) {
    throw new TypeError("Expected an ECDH P-256 public key.");
  }

  const exported = await crypto.subtle.exportKey("jwk", publicKey);

  // Export only the public components.
  const jwk = {
    kty: exported.kty,
    crv: exported.crv,
    x: exported.x,
    y: exported.y,
    ext: true,
    key_ops: []
  };

  const bundle = {
    format: KEY_FORMAT,
    version: KEY_VERSION,
    algorithm: KEY_ALGORITHM,
    curve: KEY_CURVE,
    publicKey: jwk,
    fingerprint: await fingerprintPublicJwk(jwk)
  };

  return JSON.stringify(bundle, null, 2);
}

/**
 * Import a serialized ECDH public-key bundle.
 *
 * @param {string} bundleText - The received JSON string.
 * @returns {Promise<CryptoKey>} An imported public CryptoKey.
 */
export async function importPublicKey(bundleText) {
  if (typeof bundleText !== "string" || bundleText.trim() === "") {
    throw new TypeError("A non-empty public-key bundle is required.");
  }

  let bundle;

  try {
    bundle = JSON.parse(bundleText);
  } catch {
    throw new TypeError("The public-key bundle is not valid JSON.");
  }

  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new TypeError("Invalid public-key bundle.");
  }

  if (bundle.format !== KEY_FORMAT) {
    throw new TypeError("Unsupported public-key bundle format.");
  }

  if (bundle.version !== KEY_VERSION) {
    throw new TypeError("Unsupported public-key bundle version.");
  }

  if (bundle.algorithm !== KEY_ALGORITHM) {
    throw new TypeError("Unsupported public-key algorithm.");
  }

  if (bundle.curve !== KEY_CURVE) {
    throw new TypeError("Unsupported elliptic curve.");
  }

  const jwk = bundle.publicKey;

  if (!jwk || typeof jwk !== "object" || Array.isArray(jwk)) {
    throw new TypeError("Public-key data is missing.");
  }

  // A public-key bundle must never contain a private scalar.
  if ("d" in jwk) {
    throw new TypeError("Private-key material is not allowed.");
  }

  if (
    jwk.kty !== "EC" ||
    jwk.crv !== KEY_CURVE ||
    typeof jwk.x !== "string" ||
    typeof jwk.y !== "string" ||
    jwk.x.length === 0 ||
    jwk.y.length === 0
  ) {
    
    throw new TypeError("Invalid ECDH P-256 public-key data.");
  }

  // If the bundle carries a fingerprint, it must match the key data.
  // (A missing fingerprint is accepted, same as the key manager.)
  if (bundle.fingerprint) {
    const actual = await fingerprintPublicJwk(jwk);
    if (bundle.fingerprint !== actual) {
      throw new Error(
        "Public-key fingerprint does not match the key data; do not import this bundle."
      );
    }
  }

  // Import as a non-extractable public key.
  try {
    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: jwk.kty,
        crv: jwk.crv,
        x: jwk.x,
        y: jwk.y,
        ext: true,
        key_ops: []
      },
      {
        name: KEY_ALGORITHM,
        namedCurve: KEY_CURVE
      },
      false,
      []
    );
  } catch {
    throw new TypeError("The public key could not be imported.");
  }
}