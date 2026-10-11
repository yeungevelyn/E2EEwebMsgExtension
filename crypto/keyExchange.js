
/**
 * Public-key export and import for the E2EE extension.
 *
 * Algorithm: ECDH
 * Curve: P-256
 *
 * This module handles public keys only. Private keys must never
 * be included in an exported public-key bundle.
 */

const KEY_FORMAT = "E2EE-PUBLIC-KEY";
const KEY_VERSION = 1;
const KEY_ALGORITHM = "ECDH";
const KEY_CURVE = "P-256";

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

  const jwk = await crypto.subtle.exportKey("jwk", publicKey);

  // Export only the public components.
  const bundle = {
    format: KEY_FORMAT,
    version: KEY_VERSION,
    algorithm: KEY_ALGORITHM,
    curve: KEY_CURVE,
    publicKey: {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      ext: true,
      key_ops: []
    }
  };

  return JSON.stringify(bundle);
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
