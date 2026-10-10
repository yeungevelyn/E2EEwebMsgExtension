// WhatsApp Web integration module placeholder.

//locating elements

function getMessageInput() {

    return document.querySelector(
        '[data-testid="conversation-compose-box-input"]'
    );
}

function getSendButton(){
    return document.querySelector(
        '[aria-label="Send"]'
    );
}

function getActiveConversation(){
    const titleElement = document.querySelector(
        '[data-testid="conversation-info-header-chat-title-name"]'
    );

    if (!titleElement) {
        return null;
    }

    const displayName =
        titleElement.textContent?.trim();

    if (!displayName) {
        return null;
    }

    return {
        identifierType: "displayName",
        platformConversationId: null,
        displayName: displayName,
        type: "unknown"
    };
}

function getDisplayedMessages(){
    const messageElements = document.querySelectorAll(
        '[data-testid="msg-container"]'
    );

    return Array.from(messageElements);
}

//reading the content of the input field
function readInputContent(){
    const messageInput = getMessageInput();

    if (!messageInput) {
        return null;
    }

    return messageInput.textContent ?? "";
}
//modifying the content of the input field
function replaceInputContent(newText){
    const messageInput = getMessageInput();

    if (!messageInput) {
        return false;
    }

    if (typeof newText !== "string") {
        return false;
    }
    //get focus
    messageInput.focus();

    const selection = window.getSelection();
    const range = document.createRange();

    // set message input as the range
    range.selectNodeContents(messageInput);

    // select original input
    selection.removeAllRanges();
    selection.addRange(range);

    //use new text to replace original input
    const replaced = document.execCommand(
        "insertText",
        false,
        newText
    );

    selection.removeAllRanges();

    return replaced;
}

globalThis.whatsappAdapter = {
    getMessageInput,
    getSendButton,
    getActiveConversation,
    getDisplayedMessages,
    readInputContent,
    replaceInputContent
};