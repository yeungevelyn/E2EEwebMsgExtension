// WhatsApp Web content-script entry point.

let enabled = null;

// process lock
let isProcessingSend = false;
//  the lock for whether extension needs to send msg
let isResumingSend = false;


// communication with service worker
(async () => {
    const request = {
        type: "PING",
        // generate a random UUID
        requestId: crypto.randomUUID(),
        payload: {}
    };

    const response = await browser.runtime.sendMessage(request);
    // do something with response here, not outside the function
    console.log("[E2EE Content-Scripts] sent:",response);
})();

//communication with  adapter
//initialise
async function initialiseMessageInput() {
    console.log("[E2EE] Waiting for message input");

    const messageInput =
        await waitForMessageInput();

    console.log("[E2EE] Message input found");

    // locating displayed messages
    const displayedMessages =
        whatsappAdapter.getDisplayedMessages();

    console.log(
        "[E2EE] Displayed message count:",
        displayedMessages.length
    );

    console.log(
        "[E2EE] Displayed message elements:",
        displayedMessages
    );

    messageInput.addEventListener("input", () => {
        console.log(
            "[E2EE] Current input:",
            messageInput.textContent
        );
    });
}

// detect send msg
function initialiseMessageSend() {
    console.log("[E2EE] Initialising message send listener");
    // detect click event
    document.addEventListener("click", (event) => {
        const sendButton = whatsappAdapter.getSendButton();

        if (sendButton && sendButton.contains(event.target)) {
            console.log("[E2EE] Send button clicked");
            handleOutgoingSend(event,"send");
        }

    }, true);

    // detect enter event
    document.addEventListener("keydown", (event) => {
        const keyDown = whatsappAdapter.getMessageInput();

        if ( event.key !== "Enter" || event.shiftKey || event.isComposing ||
            !keyDown || !keyDown.contains(event.target)) {
            return;
        }

        handleOutgoingSend(event, "enter");
        console.log("[E2EE] key down");

    }, true);
}

// awaiting for input
function waitForMessageInput(remainingAttempts = 20) {
    const existingInput =
        whatsappAdapter.getMessageInput();

    if (existingInput) {
        return Promise.resolve(existingInput);
    }

    return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const messageInput =
                whatsappAdapter.getMessageInput();

            if (messageInput) {
                observer.disconnect();
                resolve(messageInput);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function waitForMessageSend(remainingAttempts = 20) {
    const existingButton =
        whatsappAdapter.getSendButton();

    if (existingButton) {
        return Promise.resolve(existingButton);
    }

    return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
            const sendButton =
                whatsappAdapter.getSendButton();

            if (sendButton) {
                observer.disconnect();
                resolve(sendButton);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function handleOutgoingSend(event, triggerType){
    // Intercept the original send action
      if(isProcessingSend === false && isResumingSend=== false){

          if (!enabled) {
              return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          console.log("[E2EE] Send intercepted:", triggerType);

          // detect active conversation, using display name as temporary id
          const activeConversation =
              whatsappAdapter.getActiveConversation();

          if (!activeConversation) {
              console.error(
                  "[E2EE] No active conversation"
              );
              return;
          }

          // get plaintext
          const plaintext = whatsappAdapter.readInputContent();
          if ( typeof plaintext !== "string" || plaintext.trim().length === 0) {
              return;
          }
          // block process
          isProcessingSend = true;

          // request encrypt message
          (async () => {
              try{
                  const request = {
                      type: "ENCRYPT_MESSAGE",
                      // generate a random UUID
                      requestId: crypto.randomUUID(),
                      payload: {
                          plaintext: plaintext
                      }
                  };

                  const response = await browser.runtime.sendMessage(request);

                  if (!response || response.status !== 0) {
                      throw new Error(
                          response?.error?.message || "Encryption failed"
                      );
                  }

                  const ciphertext = response.data?.ciphertext;

                  if (typeof ciphertext !== "string" || ciphertext.length === 0) {
                      throw new Error(
                          "Background returned invalid ciphertext"
                      );
                  }

                  // replace plaintext
                  const replaced = whatsappAdapter.replaceInputContent(ciphertext);

                  if (!replaced) {
                      throw new Error(
                          "Could not replace the WhatsApp input"
                      );
                  }

                  console.log("[E2EE Content] Input replaced with ciphertext");

                  // send current msg

                  // set re-send status to true
                  isResumingSend = true;

                  try {
                      // await for UI update
                      await new Promise((resolve) => {
                          requestAnimationFrame(() => {
                              requestAnimationFrame(resolve);
                          });
                      });

                      //get current text for validation
                      const currentText = whatsappAdapter.readInputContent();

                      if (currentText !== ciphertext) {
                          throw new Error(
                              "WhatsApp input is not synchronised with ciphertext"
                          );
                      }

                      const sent = whatsappAdapter.sendCurrentMessage();

                      if (!sent) {
                          throw new Error(
                              "Could not resume WhatsApp send"
                          );
                      }
                  } finally {
                      isResumingSend = false;
                  }


              }catch (error) {
                  console.error("[E2EE Content] Outgoing encryption failed:", error);
                  globalThis.extraE2EEChatUI?.displayError(
                      "Message was not sent because encryption failed.");

              } finally {
                  //release process lock
                  isProcessingSend = false;
              }

          })();


      }



}
async function loadChatUIStatus() {

    try {
        const stateResponse = await browser.runtime.sendMessage({
            type: "GET_EXTENSION_STATE",
            requestId: crypto.randomUUID(),
            payload: {}
        });

        if (!stateResponse || stateResponse.status !== 0) {
            throw new Error("Could not load extension state");
        }

        const keyResponse = await browser.runtime.sendMessage({
            type: "GET_KEY_STATUS",
            requestId: crypto.randomUUID(),
            payload: {}
        });

        if (!keyResponse || keyResponse.status !== 0) {
            throw new Error("Could not load key status");
        }

        globalThis.extraE2EEChatUI?.updateEncryptionStatus(
            stateResponse.data.enabled,
            keyResponse.data
        );

    } catch (error) {
        console.error("[E2EE] Unable to update chat UI status:", error);

        globalThis.extraE2EEChatUI?.displayError(
            "Could not retrieve encryption status."
        );
    }
}
// get extension state
async function loadExtensionState() {
    const request = {
        type: "GET_EXTENSION_STATE",
        requestId: crypto.randomUUID(),
        payload: {}
    };

    const response = await browser.runtime.sendMessage(request);

    if (!response || response.status !== 0) {
        throw new Error(
            response?.error?.message ||
            "Could not load extension state"
        );
    }
    // get user's enable state
    enabled = response.data.enabled;

}
// change enable state
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
        return;
    }

    if (typeof changes.encryptionEnabled?.newValue === "boolean") {
        enabled = changes.encryptionEnabled.newValue;
        loadChatUIStatus();
    }

    if (changes.peerKeyUpdatedAt) {
        loadChatUIStatus();
    }
});

initialiseMessageInput();

initialiseMessageSend();

loadExtensionState().catch((error) => {
    console.error("[E2EE] Unable to load extension state:", error);
});

loadChatUIStatus();


