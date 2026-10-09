// WhatsApp Web content-script entry point.

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