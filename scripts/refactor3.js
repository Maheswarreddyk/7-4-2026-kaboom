const fs = require('fs');

function refactor3() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // Replace invalid private transitionTo calls with proper public methods
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('QUEUEING'\)/g, "LifecycleManager.getInstance().joinQueue()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('MATCH_FOUND'\)/g, "console.warn('[LifecycleManager] Match found should use .onMatchFound()')");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('NEGOTIATING'\)/g, "LifecycleManager.getInstance().onNegotiating()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('MEDIA_SETUP'\)/g, "LifecycleManager.getInstance().onMediaSetup()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('CONNECTED'\)/g, "LifecycleManager.getInstance().onConnected()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('TEARDOWN'\)/g, "LifecycleManager.getInstance().onPartnerLeft()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('ENDED'\)/g, "LifecycleManager.getInstance().goHome()");
    content = content.replace(/LifecycleManager\.getInstance\(\)\.transitionTo\('HOME'\)/g, "LifecycleManager.getInstance().goHome()");

    // Fix the `setSignalingState('MATCH_FOUND')` manually replaced by transitionTo above
    // Wait, onMatchFound is called with data. Let's see how `useVideoChat.ts` handles it in `handleMatched`.
    // It used `setSignalingState('MATCH_FOUND')`. I will replace it with `LifecycleManager.getInstance().onMatchFound({ matchId: data.matchId, partnerSessionId: data.partnerSessionId, isInitiator: data.isInitiator })`.
    // Actually, `LifecycleManager` already receives the data! Wait, `LifecycleManager` currently only has `onMatchFound(data)`.
    
    // I need to grep and fix exactly where it's used.

    fs.writeFileSync(filepath, content, 'utf-8');
}

refactor3();
