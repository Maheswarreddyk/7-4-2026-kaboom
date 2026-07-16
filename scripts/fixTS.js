const fs = require('fs');

function fix() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Remove VALID_TRANSITIONS
    content = content.replace(/const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus\[\]> = \{[\s\S]*?\};\n/, "");

    // 2. Remove the useEffect and put it after clearWebRTCTimeout
    const useEffectPattern = /\/\/ V24 Lifecycle Manager Sync\s*useEffect\(\(\) => \{[\s\S]*?\}, \[clearWebRTCTimeout, playConnected\]\);/;
    const useEffectMatch = content.match(useEffectPattern);
    
    if (useEffectMatch) {
        content = content.replace(useEffectMatch[0], "");
        
        // Find where clearWebRTCTimeout block ends
        //   const clearWebRTCTimeout = useCallback(() => {
        //     ...
        //   }, []);
        // And place it after it.
        const targetPattern = /const startWebRTCTimeout = useCallback\(\(\) => \{/g;
        content = content.replace(targetPattern, useEffectMatch[0] + "\n\n  const startWebRTCTimeout = useCallback(() => {");
    }

    fs.writeFileSync(filepath, content, 'utf-8');
}

fix();
