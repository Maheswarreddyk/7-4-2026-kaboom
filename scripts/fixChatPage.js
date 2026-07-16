const fs = require('fs');

function fixChatPage() {
    const filepath = 'frontend/src/pages/ChatPage.tsx';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Hook destructuring
    // Replace: const { chatState, localStream ... } = useVideoChat(...)
    // With: const { lifecycleState, chatState, localStream ... } = useVideoChat(...)
    content = content.replace(/const \{\s*chatState,/g, "const { lifecycleState, chatState,");
    
    // 2. Replace chatState.status with lifecycleState
    content = content.replace(/chatState\.status/g, "lifecycleState");

    // 3. Fix state names mapping
    // IDLE -> HOME
    content = content.replace(/lifecycleState === 'IDLE'/g, "lifecycleState === 'HOME'");
    content = content.replace(/lifecycleState !== 'IDLE'/g, "lifecycleState !== 'HOME'");
    // CONNECTING_REALTIME -> QUEUEING
    content = content.replace(/lifecycleState === 'CONNECTING_REALTIME'/g, "lifecycleState === 'QUEUEING'");
    // SEARCHING -> QUEUEING
    content = content.replace(/lifecycleState === 'SEARCHING'/g, "lifecycleState === 'QUEUEING'");
    content = content.replace(/lifecycleState !== 'SEARCHING'/g, "lifecycleState !== 'QUEUEING'");
    // REQUEUEING -> QUEUEING
    content = content.replace(/lifecycleState === 'REQUEUEING'/g, "lifecycleState === 'QUEUEING'");
    // MATCH_FOUND -> MATCH_FOUND
    // READY -> MATCH_FOUND
    content = content.replace(/lifecycleState === 'READY'/g, "lifecycleState === 'MATCH_FOUND'");
    // NEGOTIATING -> NEGOTIATING
    // ICE_CONNECTING -> MEDIA_SETUP
    content = content.replace(/lifecycleState === 'ICE_CONNECTING'/g, "lifecycleState === 'MEDIA_SETUP'");
    // CONNECTED -> CONNECTED
    // PARTNER_LEFT -> TEARDOWN
    content = content.replace(/lifecycleState === 'PARTNER_LEFT'/g, "lifecycleState === 'TEARDOWN'");
    // ENDED -> ENDED

    // For Arrays like ['MATCH_FOUND', 'READY', 'NEGOTIATING', 'ICE_CONNECTING', 'CONNECTED']
    content = content.replace(/'IDLE'/g, "'HOME'");
    content = content.replace(/'CONNECTING_REALTIME'/g, "'QUEUEING'");
    content = content.replace(/'SEARCHING'/g, "'QUEUEING'");
    content = content.replace(/'REQUEUEING'/g, "'QUEUEING'");
    content = content.replace(/'READY'/g, "'MATCH_FOUND'");
    content = content.replace(/'ICE_CONNECTING'/g, "'MEDIA_SETUP'");
    content = content.replace(/'PARTNER_LEFT'/g, "'TEARDOWN'");

    // 4. Replace chatState.connectionStatus usage
    // chatState.connectionStatus === 'reconnecting' => chatState.reconnectCountdown !== null
    content = content.replace(/chatState\.connectionStatus === 'reconnecting'/g, "chatState.reconnectCountdown !== null");
    content = content.replace(/chatState\.connectionStatus === 'failed'/g, "false /* deprecated */");

    fs.writeFileSync(filepath, content, 'utf-8');
}

fixChatPage();
