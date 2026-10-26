
(function () {
    "use strict";

    const BANNER_ID = "extra-e2ee-status";

    let lastConversationName = null;

    let latestEncryptionState = null;

    let latestKeyStatus = null;

    function createStatusBanner() {
        const banner = document.createElement("div");

        banner.id = BANNER_ID;
        banner.className = "extra-e2ee-status";

        const heading = document.createElement("strong");
        heading.textContent = "🔒 Extra E2EE — Checking status";

        const description = document.createElement("span");
        description.textContent =
            "Waiting for extension encryption status";

        banner.append(heading, description);

        return banner;
    }

    function updateEncryptionStatus(enabled, keyStatus) {
    latestEncryptionState = enabled;
    latestKeyStatus = keyStatus;

    const banner = document.getElementById("extra-e2ee-status");
    const notice = document.getElementById("extra-e2ee-outgoing");

    if (!banner) {
        return;
    }

    const heading = banner.querySelector("strong");
    const description = banner.querySelector("span");

    if (!heading || !description) {
        return;
    }

    if (!enabled) {
        heading.textContent = "🔓 Extra E2EE — Disabled";
        description.textContent = "Additional encryption is turned off";

        if (notice) {
            notice.textContent = "🛡️ Extra E2EE: Outgoing encryption disabled";
        }

    } else if (!keyStatus?.peerKeyReady || !keyStatus?.sessionReady) {
        heading.textContent = "🔒 Extra E2EE — Not ready";
        description.textContent = "Encryption keys or session are not ready";

        if (notice) {
            notice.textContent = "🛡️ Extra E2EE: Encryption not ready";
        }

    } else {
        heading.textContent = "🔒 Extra E2EE — Ready";
        description.textContent = "Additional encryption is ready";

        if (notice) {
            notice.textContent = "🛡️ Extra E2EE: Encryption ready";
            }
        }
    }

    function createOutgoingNotice() {
        const notice = document.createElement("div");

        notice.id = "extra-e2ee-outgoing";
        notice.className = "extra-e2ee-outgoing";

        notice.textContent =
            "🛡️ Extra E2EE: Outgoing encryption status unknown";

        return notice;
    }

    function createDecryptedContainer() {
        const container = document.createElement("div");

        container.id = "extra-e2ee-decrypted";
        container.className = "extra-e2ee-decrypted";
        container.hidden = true;

        const heading = document.createElement("strong");
        heading.textContent = "🔓 Extra E2EE — Decrypted locally";

        const message = document.createElement("p");
        message.id = "extra-e2ee-plaintext";

        container.append(heading, message);

        return container;
    }

    function displayDecryptedMessage(plaintext) {
        const container = document.getElementById(
            "extra-e2ee-decrypted"
        );

        const message = document.getElementById(
            "extra-e2ee-plaintext"
        );

        if (!container || !message) {
            return;
        }

        if (
            typeof plaintext !== "string" ||
            plaintext.trim().length === 0
        ) {
            return;
        }

        message.textContent = plaintext;
        container.hidden = false;
    }

    function createErrorContainer() {
        const container = document.createElement("div");

        container.id = "extra-e2ee-error";
        container.className = "extra-e2ee-error";
        container.hidden = true;

        return container;
    }

    function displayError(message) {
        const container = document.getElementById(
            "extra-e2ee-error"
        );

        if (!container || typeof message !== "string") {
            return;
        }

        container.textContent = "⚠️ Extra E2EE — " + message;
        container.hidden = false;
    }


    function updateChatUI() {
        // Find the active conversation title using the adapter.
        const conversation =
            globalThis.whatsappAdapter?.getActiveConversation();


        // Track the active conversation.
        const currentConversationName =
            conversation?.displayName ?? null;

        if (currentConversationName !== lastConversationName) {
            // Clear previously displayed plaintext.
            const decryptedContainer = document.getElementById(
                "extra-e2ee-decrypted"
            );

            const plaintextElement = document.getElementById(
                "extra-e2ee-plaintext"
            );

            if (plaintextElement) {
                plaintextElement.textContent = "";
            }

            if (decryptedContainer) {
                decryptedContainer.hidden = true;
            }

            // Clear errors when switching conversations.
            const errorContainer = document.getElementById(
                "extra-e2ee-error"
            );

            if (errorContainer) {
                errorContainer.textContent = "";
                errorContainer.hidden = true;
            }

            lastConversationName = currentConversationName;
        }


        const existingBanner =
            document.getElementById(BANNER_ID);

        // Hide the banner when no conversation is open.
        if (!conversation) {
            existingBanner?.remove();

            document.getElementById(
                "extra-e2ee-outgoing"
            )?.remove();

            // Remove the decrypted message container
            document.getElementById(
                "extra-e2ee-decrypted"
            )?.remove();

            // Remove the error container.
            document.getElementById(
                "extra-e2ee-error"
            )?.remove();

            return;
        }

        // Find the conversation header.
        const titleElement = document.querySelector(
            '[data-testid="conversation-info-header-chat-title-name"]'
        );

        const chatHeader = titleElement?.closest("header");

        if (!chatHeader) {
            existingBanner?.remove();

            document.getElementById(
                "extra-e2ee-outgoing"
            )?.remove();

            document.getElementById(
                "extra-e2ee-decrypted"
            )?.remove();

            // Remove the error container.
            document.getElementById(
                "extra-e2ee-error"
            )?.remove();

            return;
        }

        // Create the status banner if it does not exist.
        if (!existingBanner) {
            const banner = createStatusBanner();
            chatHeader.insertAdjacentElement("afterend", banner);
        }

        // Create the local decrypted-message container.
        if (!document.getElementById("extra-e2ee-decrypted")) {
            const container = createDecryptedContainer();

            chatHeader.insertAdjacentElement(
                "afterend",
                container
            );

        }


        // Create the error container.
        if (!document.getElementById("extra-e2ee-error")) {
            const errorContainer = createErrorContainer();

            chatHeader.insertAdjacentElement(
                "afterend",
                errorContainer
            );
        }

        // Find the WhatsApp message input.
        const messageInput =
            globalThis.whatsappAdapter?.getMessageInput();

        if (!messageInput) {
            document.getElementById(
                "extra-e2ee-outgoing"
            )?.remove();
            return;
        }

        // Find the message composer container.
        const composer = messageInput.closest("footer");

        if (!composer) {
            return;
        }

        // Create the outgoing notice only once.
        if (!document.getElementById("extra-e2ee-outgoing")) {
            const notice = createOutgoingNotice();

            // Place the notice inside the message footer.
            composer.insertAdjacentElement("afterbegin", notice);
        }

        // Reapply the latest encryption status.
        if (latestEncryptionState !== null) {
            updateEncryptionStatus(latestEncryptionState, latestKeyStatus);
        }

    }

    // WhatsApp changes its interface dynamically.
    // Watch for changes and update our UI.
    let updateScheduled = false;

    const observer = new MutationObserver(() => {
        if (updateScheduled) {
            return;
        }

        updateScheduled = true;

        requestAnimationFrame(() => {
            updateScheduled = false;
            updateChatUI();
        });
    });

    updateChatUI();

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Allow other extension content scripts to use the Chat UI.
    globalThis.extraE2EEChatUI = {
        displayDecryptedMessage,
        displayError,
        updateEncryptionStatus
    };

})();
