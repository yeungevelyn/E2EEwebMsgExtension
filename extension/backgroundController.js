// Chrome extension background entry point.
import "../crypto/keyManager.js";
import "../crypto/crypto.js";

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
            sendResponse({
                status: 0,
                requestId: message.requestId,
                data: {
                    "encryptedPayload":""
                }
            });

            return;
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