const fs = require('fs');

function refactorChatPage() {
    const filepath = 'frontend/src/pages/ChatPage.tsx';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Add imports
    if (!content.includes("import { useLifecycle }")) {
        content = content.replace(
            "import { useVideoChat } from '../hooks/useVideoChat.js';",
            "import { useVideoChat } from '../hooks/useVideoChat.js';\nimport { useLifecycle } from '../hooks/useLifecycle.js';\nimport { LifecycleManager } from '../services/LifecycleManager.js';"
        );
    }

    // 2. Add lifecycleState inside component
    if (!content.includes("const lifecycleState = useLifecycle();")) {
        content = content.replace(
            "const { showToast } = useToast();",
            "const { showToast } = useToast();\n  const lifecycleState = useLifecycle();\n  const lm = LifecycleManager.getInstance();"
        );
    }

    // 3. Replace isSearching and isConnected logic
    const oldLogic = `const isConnected = chatState.status === 'CONNECTED';
  const isSearching = chatState.status !== 'IDLE' && chatState.status !== 'ENDED' && (!isConnected || !remoteVideoPlaying);`;
    
    const newLogic = `const isConnected = lifecycleState === 'CONNECTED';
  const isSearching = ['QUEUEING', 'MATCH_FOUND', 'NEGOTIATING', 'MEDIA_SETUP'].includes(lifecycleState);`;
    
    content = content.replace(oldLogic, newLogic);

    // 4. Update UI actions to use LifecycleManager directly
    // Find where handleNext is called for the Skip button and replace with lm.skip()
    // Wait, the Skip button uses triggerSkipConfirmation or forceSkipImmediately.
    // triggerSkipConfirmation calls startSkipCountdown, which calls handleNextRef.current()
    // forceSkipImmediately calls handleNextRef.current()
    // Let's replace handleNextRef.current() with lm.skip() in these places.
    content = content.replace(/handleNextRef\.current\(\);/g, "lm.skip();");
    
    // In ChatPage, the Start button triggers playQueueJoin() and handles some logic.
    // Wait, where does ChatPage call handleNext? Usually for skip.
    // The Settings button triggers setShowPreferenceModal(true).
    // Let's modify the settings button click handler.
    // "onClick={() => { setShowPreferenceModal(true); }}"
    // Actually, LifecycleManager has enterConfiguring().
    content = content.replace(
        /onClick=\{\(\) => setShowPreferenceModal\(true\)\}/g,
        "onClick={() => { lm.enterConfiguring(); setShowPreferenceModal(true); }}"
    );

    content = content.replace(
        /onClose=\{\(\) => \{\n\s+setShowPreferenceModal\(false\);\n\s+\}\}/g,
        "onClose={() => { lm.exitConfiguring(lifecycleState === 'QUEUEING'); setShowPreferenceModal(false); }}"
    );

    // 5. Cancel Queue button
    // It's usually "stopChat()" or "pauseQueue()". Let's look for "stopChat()".
    // If the user is searching and hits "Cancel", they leave queue.
    content = content.replace(
        /onClick=\{stopChat\}/g,
        "onClick={() => { lm.leaveQueue(); stopChat(); }}"
    );

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log("ChatPage refactored.");
}

refactorChatPage();
