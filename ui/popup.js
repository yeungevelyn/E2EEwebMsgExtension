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

saveRecipientKey.addEventListener("click", function () {
    const key = recipientPublicKey.value.trim();

    if (key === ""){
        recipientKeyMessage.className = "error";

        recipientKeyMessage.textContent = 
            "Please enter the recipient's public key.";
        return;
    }

    const keyPattern = /^E2EE-PUB-\d{8}$/;

    if (!keyPattern.test(key)) {
        recipientKeyMessage.className = "error";

        recipientKeyMessage.textContent = 
            "Invalid demo key format.";
        return;
    }

    
    chrome.storage.local.set({
        recipientPublicKey: key
    }, function () {
         if (chrome.runtime.lastError) {
            recipientKeyMessage.className = "error";
            
            recipientKeyMessage.textContent =
                "Unable to save the recipient's public key.";
            return;
    }
        recipientKeyMessage.className = "success";

        recipientKeyMessage.textContent =
            "Recipient's public key saved successfully.";
    });
});


chrome.storage.local.get(["recipientPublicKey"], function (result) {
    if (result.recipientPublicKey) {
        recipientPublicKey.value = result.recipientPublicKey;
    }
});

