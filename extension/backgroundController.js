// Chrome extension background entry point.
import "../crypto/keyManager.js";
import "../crypto/crypto.js";
import {
  exportPublicKey,
  importPublicKey
} from "../crypto/keyExchange.js";

let enabled = false;
let cryptoReady = false;
let sessionReady = false;
let testKey = null;

//test key
async function initialiseCrypto() {
    const originalText = "Crypto readiness test";

    try {
        testKey =
            await globalThis.E2EECrypto.generateTestKey();

        const encryptedPayload =
            await globalThis.E2EECrypto.encryptMessage(
                originalText,
                testKey
            );

        const decryptedText =
            await globalThis.E2EECrypto.decryptMessage(
                encryptedPayload,
                testKey
            );

        cryptoReady =
            decryptedText === originalText;

        console.log(
            "[E2EE Background] Crypto ready:",
            cryptoReady
        );
    } catch (error) {
        cryptoReady = false;
        testKey = null;

        console.error(
            "[E2EE Background] Crypto initialisation failed:",
            error
        );
    }
}

// extension state
async function initialiseExtensionState() {
    const result =
        await browser.storage.local.get(
            "encryptionEnabled"
        );

    if (typeof result.encryptionEnabled === "boolean") {
        enabled = result.encryptionEnabled;
    } else {
        enabled = false;
    }
}

// Event listener
function handleMessages(message, sender, sendResponse) {
    console.log("[E2EE Background] Received:", message);
    if (message.type==='PING') {
        sendResponse({
            status: 0,
            requestId: message.requestId,
            data: {
                message: "PONG"
            }
        });

        return;
        }else if(message.type==='GET_EXTENSION_STATE') {

            (async () => {
                try {
                    await extensionStateReady;

                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {
                            enabled: enabled,
                            cryptoReady: cryptoReady
                        }
                    });
                } catch (error) {
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 102,
                            message: error.message
                        }
                    });
                }
            })();

            return true;

        }else if(message.type==='SET_EXTENSION_STATE'){
            // get user's enable state
            const requestedEnabled = message.payload?.enabled;

            if (typeof requestedEnabled !== "boolean") {
                sendResponse({
                    status: 1,
                    requestId: message.requestId,
                    error: {
                        code: 103,
                        message: "Enabled must be a boolean"
                    }
                });

                return;
            }
            // process response
            (async () => {
                try {
                    await extensionStateReady;

                    await browser.storage.local.set({
                        encryptionEnabled: requestedEnabled
                    });

                    enabled = requestedEnabled;

                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {}
                    });
                } catch (error) {
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 102,
                            message: error.message
                        }
                    });
                }
            })();

            return true;
        }else if(message.type==='ENCRYPT_MESSAGE'){
            // get plain text
            const plaintext = message.payload.plaintext

            if(plaintext === null || typeof plaintext !== "string" || plaintext.length === 0){
                // send fail
                sendResponse({
                    status: 1,
                    requestId: message.requestId,
                    error: {
                        code: 104,
                        message: "Invalid plaintext"
                    }
                });
                return;
            }

            (async () => {
                try {

                    await extensionStateReady;

                    if (!enabled) {
                        throw new Error(
                            "Encryption is disabled"
                        );
                    }

                    if (!cryptoReady || !testKey) {
                        throw new Error(
                            "Encryption is not ready"
                        );
                    }

                    const encryptedPayload =
                        await globalThis.E2EECrypto.encryptMessage(
                            plaintext,
                            testKey
                        );

                    const ciphertext =
                        globalThis.E2EECrypto.encodeMessagePayload(
                            encryptedPayload
                        );

                    // send success response to content
                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {
                            "ciphertext": ciphertext
                        }
                    });
                }catch(error){
                    // send fail
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 102,
                            message: error.message
                        }
                    });
                }

            })();

            return true;

        } else if(message.type==='DECRYPT_MESSAGE'){
            sendResponse({
                status: 0,
                requestId: message.requestId,
                data: {
                    "plaintext":""
                }
            });

            return;
        } else if(message.type==='GET_LOCAL_PUBLIC_KEY'){
            (async () => {
                try {
                    // get private key and public key
                    const identity = await globalThis.E2EEKeyManager.getOrCreateIdentityKeyPair();
                    const publicKeyBundle = await globalThis.E2EEKeyManager.exportPublicKeyBundle(identity.publicKey);
                    const parsedBundle = JSON.parse(publicKeyBundle);
                    //return public bundle and fingerprint
                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {
                            publicKeyBundle,
                            fingerprint: parsedBundle.fingerprint,
                            identityKeyReady: true
                        }
                    });
                } catch (error) {
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 201,
                            message: error.message
                        }
                    });
                }
            })();
            return true;
        } else if(message.type === "SAVE_PEER_PUBLIC_KEY"){
            // get publick key
            const publicKeyBundle = message.payload?.publicKeyBundle;
            // validation
            if (typeof publicKeyBundle !== "string" || publicKeyBundle.trim().length === 0) {
                sendResponse({
                    status: 1,
                    requestId: message.requestId,
                    error: {
                        code: 202,
                        message:
                            "PublicKeyBundle must be a non-empty string"
                    }
                });

                return;
            }

            // save
            (async () => {
                try {
                    const savedPeer = await globalThis.E2EEKeyManager.savePeerPublicKey(publicKeyBundle);

                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {
                            fingerprint: savedPeer.fingerprint,
                            peerKeyReady: true
                        }
                    });
                } catch (error) {
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 201,
                            message: error.message
                        }
                    });
                }
            })();

            return true;

        } else if( message.type === "GET_KEY_STATUS"){
            // check key status
            (async () => {
                try {
                    const [identity, peer] = await Promise.all([
                        globalThis.E2EEKeyManager.loadIdentityKeyPair(),
                        globalThis.E2EEKeyManager.loadPeerPublicKey()]);

                    const identityKeyReady = Boolean(identity?.privateKey && identity?.publicKey);

                    const peerKeyReady = Boolean(peer?.publicKey);

                    sendResponse({
                        status: 0,
                        requestId: message.requestId,
                        data: {
                            identityKeyReady,
                            peerKeyReady,
                            sessionReady,
                            peerFingerprint: peer?.fingerprint ?? null
                        }
                    });
                } catch (error) {
                    sendResponse({
                        status: 1,
                        requestId: message.requestId,
                        error: {
                            code: 201,
                            message: error.message
                        }
                    });
                }
            })();

            return true;
        }else{
            sendResponse({
                status: 1,
                requestId: message.requestId,
                error: {
                        code: 101,
                        message: "Unsupported request type"
                }
            });
            return;
    }


}

browser.runtime.onMessage.addListener(handleMessages);
initialiseCrypto();
const extensionStateReady = initialiseExtensionState();


globalThis.E2EEKeyExchange = {
  exportPublicKey,
  importPublicKey,

  async runSelfTest() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveBits"]
    );

    const bundle = await exportPublicKey(keyPair.publicKey);
    const importedKey = await importPublicKey(bundle);

    const passed =
      importedKey.type === "public" &&
      importedKey.algorithm.name === "ECDH" &&
      importedKey.algorithm.namedCurve === "P-256";

    console.log("Public-key export/import successful:", passed);

    return passed;
  }
};
