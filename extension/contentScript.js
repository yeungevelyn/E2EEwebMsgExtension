// WhatsApp Web content-script entry point.

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

    messageInput.addEventListener("input", () => {
        console.log(
            "[E2EE] Current input:",
            messageInput.textContent
        );
    });
}
// detect click event
function initialiseMessageSend() {
    console.log("[E2EE] Initialising message send listener");

    document.addEventListener("click", (event) => {
        const sendButton = whatsappAdapter.getSendButton();

        if (!sendButton || !sendButton.contains(event.target)) {
            return;
        }

        console.log("[E2EE] Send button clicked");

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



initialiseMessageInput();

initialiseMessageSend();



