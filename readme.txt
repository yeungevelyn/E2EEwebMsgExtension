WhatsApp Extra E2EE Extension — UI Injection Scaffold
======================================================

Current status
--------------
This is a minimal structural scaffold only. JavaScript files contain entry-point
comments only. Encryption, key management, WhatsApp DOM selectors, UI logic and
pre-send interception are deliberately not implemented or designed here.

Project structure
-----------------
The source is divided into only three parts:

src/
|-- manifest.json
|-- extension/
|   |-- backgroundController.js
|   |-- content-script.js
|   `-- whatsapp-adapter.js
|-- crypto/
|   `-- crypto.js
|-- ui/
|   |-- chat-ui.js
|   |-- chat-ui.css
|   |-- popup.html
|   |-- popup.js
|   |-- popup.css
|   |-- settings.html
|   |-- settings.js
|   `-- settings.css
`-- readme.txt

Responsibilities
----------------
manifest.json
    Declares Manifest V3, WhatsApp Web access, content scripts, toolbar popup
    and the settings page.

extension/backgroundController.js
    Empty background entry point.

crypto/crypto.js
    Empty cryptography module placeholder.

extension/whatsapp-adapter.js
    Empty WhatsApp integration module placeholder.

ui/chat-ui.js
    Empty placeholder for UI that may later be inserted into WhatsApp Web.

extension/content-script.js
    Empty content-script entry point.

ui/popup.html / ui/popup.js / ui/popup.css
    Minimal empty toolbar page shell.

ui/settings.html / ui/settings.js / ui/settings.css
    Minimal empty settings-page shell.

Planned WhatsApp UI states
--------------------------
Disabled
    No injected encryption interface is shown.

Key required
    An amber status tells the user that encryption cannot start yet.

Active
    A green banner, verified lock badge and composer notice indicate that the
    next outgoing message is intended to be intercepted and encrypted.

Error
    A red state must replace the active state, and sending should not silently
    continue under a misleading security indicator.


Load in Chrome
--------------
1. Open chrome://extensions.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select E2EEwebMsgExtension/src (the folder containing manifest.json).


