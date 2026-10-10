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
// getActiveConversation()
// getDisplayedMessages()
//reading the content of the input field
// readInputContent()
//modifying the content of the input field
// replaceInputContent(newText)

globalThis.whatsappAdapter = {
    getMessageInput,
    getSendButton
};