// Chrome extension background entry point.
let enabled = true;
let cryptoReady = false;

// Event listener
function handleMessages(message, sender, sendResponse) {
    console.log("[E2EE Background] Received:", message);
    if (message.type==='PING'){
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
                    enabled: enabled
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
