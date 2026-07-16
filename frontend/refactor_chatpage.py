import os

FILE = 'src/pages/ChatPage.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Add useLifecycle to imports
if 'useLifecycle' not in content:
    content = content.replace("import { useSession } from '../contexts/SessionContext.js';", "import { useSession } from '../contexts/SessionContext.js';\nimport { useLifecycle } from '../hooks/useLifecycle.js';\nimport { LifecycleManager } from '../services/LifecycleManager.js';")

# 1. Inside ChatPage(), get lifecycle state
if 'const lifecycleState = useLifecycle();' not in content:
    content = content.replace("const { isMobile } = useResponsiveLayout();", "const { isMobile } = useResponsiveLayout();\n  const lifecycleState = useLifecycle();")

# 2. Update isConnected and isSearching
content = content.replace(
    "const isConnected = chatState.status === 'CONNECTED';",
    "const isConnected = lifecycleState === 'CONNECTED';"
)
content = content.replace(
    "const isSearching = chatState.status !== 'IDLE' && chatState.status !== 'ENDED' && (!isConnected || !remoteVideoPlaying);",
    "const isSearching = ['QUEUEING', 'MATCH_FOUND', 'NEGOTIATING', 'MEDIA_SETUP'].includes(lifecycleState) || (lifecycleState === 'CONNECTED' && !remoteVideoPlaying);"
)

# 3. Route UI actions directly to LifecycleManager

# In startSkipCountdown:
content = content.replace(
    "setIsSkipPending(false);\n        handleNextRef.current();",
    "setIsSkipPending(false);\n        LifecycleManager.getInstance().skip();"
)
content = content.replace(
    "setIsSkipPending(false);\n    handleNextRef.current();",
    "setIsSkipPending(false);\n    LifecycleManager.getInstance().skip();"
)
content = content.replace(
    "handleNextRef.current();",
    "LifecycleManager.getInstance().skip();"
)
content = content.replace(
    "handleNext();",
    "LifecycleManager.getInstance().skip();"
)

# In handleLeave / stopChat:
# Wait, handleConfirmBlockerLeave
content = content.replace(
    "await stopChat();",
    "LifecycleManager.getInstance().goHome();"
)
content = content.replace(
    "stopChat().catch",
    "/* stopChat().catch */ Promise.resolve().catch"
)
content = content.replace(
    "stopChat, endSession",
    "/*stopChat*/ endSession"
)

# Settings/Preferences routing:
content = content.replace(
    "await pauseQueue();",
    "LifecycleManager.getInstance().enterConfiguring();"
)
content = content.replace(
    "await resumeQueue();",
    "LifecycleManager.getInstance().exitConfiguring(true);"
)
content = content.replace(
    "onResumeQueue={resumeQueue}",
    "onResumeQueue={() => LifecycleManager.getInstance().exitConfiguring(true)}"
)
content = content.replace(
    "onPauseQueue={pauseQueue}",
    "onPauseQueue={() => LifecycleManager.getInstance().enterConfiguring()}"
)

# Fix double handleNext logic
content = content.replace("LifecycleManager.getInstance().skip()Ref.current", "LifecycleManager.getInstance().skip()")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
