const fs = require('fs');

function refactorAtomicSkip() {
    const filepath = 'frontend/src/hooks/useVideoChat.ts';
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Add handleNextRef
    if (!content.includes('const handleNextRef = useRef<() => Promise<void>>')) {
        content = content.replace(
            /  const updateSessionLifecycleStateRef = useRef<any>\(null\);/g,
            `  const updateSessionLifecycleStateRef = useRef<any>(null);\n  const handleNextRef = useRef<() => Promise<void>>(async () => {});`
        );
    }
    
    // 2. Assign handleNextRef
    if (!content.includes('handleNextRef.current = handleNext;')) {
        content = content.replace(
            /  \}, \[updateChatState, clearSignalingRetryTimers, setSignalingState, showToast, triggerAutoRejoin\]\);/g,
            `  }, [updateChatState, clearSignalingRetryTimers, setSignalingState, showToast, triggerAutoRejoin]);\n\n  useEffect(() => {\n    handleNextRef.current = handleNext;\n  }, [handleNext]);`
        );
    }

    // 3. Update handleLMState to intercept local_skip
    if (!content.includes("mappedState = metadata?.reason === 'local_skip' ? 'REQUEUEING' : 'PARTNER_LEFT';")) {
        content = content.replace(
            /case 'TEARDOWN': mappedState = 'PARTNER_LEFT'; break;/g,
            `case 'TEARDOWN': \n          mappedState = metadata?.reason === 'local_skip' ? 'REQUEUEING' : 'PARTNER_LEFT';\n          if (metadata?.reason === 'local_skip') {\n             void handleNextRef.current();\n          }\n          break;`
        );
    }
    
    // 4. Update the handleLMState signature to accept metadata
    if (content.includes('const handleLMState = ({ state }: any) => {')) {
        content = content.replace(
            /const handleLMState = \(\{ state \}: any\) => \{/g,
            `const handleLMState = ({ state, metadata }: any) => {`
        );
    }

    // 5. Clear partnerSkipPending in executePartnerLeftTeardown
    if (!content.includes('updateChatState({ partnerSkipPending: false }); // V24 clear banner')) {
        content = content.replace(
            /setSignalingState\('PARTNER_LEFT'\);\s+webrtcManager\.resetConnection\(\);/g,
            `setSignalingState('PARTNER_LEFT');\n    updateChatState({ partnerSkipPending: false }); // V24 clear banner\n    webrtcManager.resetConnection();`
        );
    }

    fs.writeFileSync(filepath, content);
    console.log('Successfully refactored useVideoChat.ts completely for Atomic Skip.');
}

refactorAtomicSkip();
