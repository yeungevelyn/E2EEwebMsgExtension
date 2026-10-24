// Chrome extension background entry point.
import "../crypto/keyManager.js";
import "../crypto/crypto.js";
// import "../crypto/keyExchange.js";
import {
  exportPublicKey,
  importPublicKey
} from "../crypto/keyExchange.js";

let enabled = true;
let cryptoReady = false;
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
        }else if(message.type==='GET_EXTENSION_STATE'){
            sendResponse({
                status: 0,
                requestId: message.requestId,
                data: {
                    enabled: enabled,
                    cryptoReady: cryptoReady
                }
            });

            return;
        }else if(message.type==='ENCRYPT_MESSAGE'){
            const plaintext = message.payload.plaintext
            if(plaintext === null){
                return;
            }

            (async () => {
                try {
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
        } else{
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
