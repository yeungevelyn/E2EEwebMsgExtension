const encryptionToggle = document.getElementById("encryptionToggle");

const encryptionStatus = document.getElementById("encryptionStatus");

encryptionToggle.addEventListener("change", function () {
    if (encryptionToggle.checked) {
        encryptionStatus.textContent = "Enabled";

    }else {
        encryptionStatus.textContent = "Disabled";
    }

    chrome.storage.local.set(
        {
           encryptionEnabled: encryptionToggle.checked 
        }
    );
});

chrome.storage.local.get(["encryptionEnabled"], function (result){
    const savedSetting = result.encryptionEnabled || false;

    encryptionToggle.checked = savedSetting;

    if (savedSetting) {
        encryptionStatus.textContent = "Enabled";
    } else {
        encryptionStatus.textContent = "Disabled";
    }
});

const publicKey = document.getElementById("publicKey");

async function loadPublicKey() {
    try {
        // Load an existing key pair or generate one if none exists.
        const keyPair = await E2EEKeyManager.getOrCreateIdentityKeyPair();

        // Convert the public key into text that can be shared.
        const publicKeyText = await E2EEKeyManager.exportPublicKeyBundle(
            keyPair.publicKey
        );

        // Display the real public key in the popup.
        publicKey.value = publicKeyText;

    } catch (error) {
        console.error("Unable to load public key:", error);
        publicKey.value = "";
        alert("Unable to load your public key.");
    }
}

loadPublicKey();
const copyButton = document.getElementById("copyPublicKey");

copyButton.addEventListener("click", async function () {
    if (publicKey.value.trim() === "") {
        alert("No public key available to copy. ");
        return;
    }

    try {
        await navigator.clipboard.writeText(publicKey.value);
        alert("Public key copied successfully!");

    } catch (error) {
        alert("Unable to copy the public key");
    }
});

const recipientPublicKey = document.getElementById("recipientPublicKey");

const saveRecipientKey = document.getElementById("saveRecipientKey");

const recipientKeyMessage = document.getElementById("recipientKeyMessage");

saveRecipientKey.addEventListener("click", async function () {
    const key = recipientPublicKey.value.trim();

    if (key === "") {
        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            "Please enter the recipient's public key.";
        return;
    }

    try {
        await E2EEKeyManager.savePeerPublicKey(key);

        recipientKeyMessage.className = "success";
        recipientKeyMessage.textContent =
            "Recipient's public key saved successfully.";

    } catch (error) {
        console.error("Unable to import recipient key:", error);

        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            "Invalid public key. Please check the key and try again.";
    }
});

async function loadRecipientKey() {
    try {
        const savedKey = await E2EEKeyManager.loadPeerPublicKey();

        if (savedKey) {
            recipientPublicKey.value = savedKey.bundle;
        }

    } catch (error) {
        console.error("Unable to load recipient key:", error);

        recipientKeyMessage.className = "error";
        recipientKeyMessage.textContent =
            "Unable to load the saved recipient key.";
    }
}

loadRecipientKey();
