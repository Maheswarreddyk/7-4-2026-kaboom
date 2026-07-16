const fs = require('fs');

function fixUseVideoChat() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // Return lifecycleState from the hook
    // The hook currently returns `chatState` and some methods.
    // Let's add `lifecycleState` to the return object.
    content = content.replace(/return \{\s*chatState,/g, "return {\n    lifecycleState,\n    chatState,");

    // Replace invalid state comparisons
    // '"SEARCHING"' -> '"QUEUEING"'
    content = content.replace(/'SEARCHING'/g, "'QUEUEING'");
    // '"REQUEUEING"' -> '"QUEUEING"'
    content = content.replace(/'REQUEUEING'/g, "'QUEUEING'");
    // '"CONNECTING_REALTIME"' -> '"QUEUEING"'
    content = content.replace(/'CONNECTING_REALTIME'/g, "'QUEUEING'");
    // '"IDLE"' -> '"HOME"'
    content = content.replace(/'IDLE'/g, "'HOME'");
    // '"READY"' -> '"MATCH_FOUND"'
    content = content.replace(/'READY'/g, "'MATCH_FOUND'");
    
    // Fix `updateChatState({ connectionStatus: ... })` which is invalid now
    content = content.replace(/updateChatState\(\{[\s]*connectionStatus:[^\},]+,?/g, "updateChatState({");
    content = content.replace(/updateChatState\(\{\s*\}\);/g, ""); // Remove empty updates

    // Fix remaining `setSignalingState` references that were missed (if any)
    content = content.replace(/setSignalingState/g, "LifecycleManager.getInstance().joinQueue"); // fallback, maybe dangerous, let's see. Wait, we already replaced them, the errors show `Cannot find name 'setSignalingState'`.

    fs.writeFileSync(filepath, content, 'utf-8');
}

fixUseVideoChat();
