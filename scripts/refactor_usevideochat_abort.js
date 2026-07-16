const fs = require('fs');

function refactorUseVideoChat() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Add sendAbortMatch import
    if (!content.includes('sendAbortMatch')) {
        content = content.replace(
            "leaveMatchChannel,",
            "leaveMatchChannel,\n  sendAbortMatch,"
        );
    }

    // 2. Add abortMatch listener in the useEffect
    const useEffectPattern = /lm\.on\('stateChanged', handleLMState\);/g;
    if (content.includes("lm.on('stateChanged', handleLMState);") && !content.includes("lm.on('abortMatch'")) {
        content = content.replace(
            "lm.on('stateChanged', handleLMState);",
            "lm.on('stateChanged', handleLMState);\n    const handleAbortMatch = ({ matchId }: { matchId: string }) => {\n      console.log(`[useVideoChat] Forwarding abortMatch to backend for match ${matchId}`);\n      sendAbortMatch(matchId);\n    };\n    lm.on('abortMatch', handleAbortMatch);"
        );
        content = content.replace(
            "lm.off('stateChanged', handleLMState);",
            "lm.off('stateChanged', handleLMState);\n      lm.off('abortMatch', handleAbortMatch);"
        );
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log("useVideoChat refactored for abortMatch.");
}

refactorUseVideoChat();
