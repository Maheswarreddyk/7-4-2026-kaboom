const fs = require('fs');

function removeRemoteVideoPlaying() {
    const filepath = 'frontend/src/pages/ChatPage.tsx';
    let content = fs.readFileSync(filepath, 'utf-8');

    const lines = content.split('\n');
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);')) {
            startIdx = i;
        }
        if (startIdx !== -1 && lines[i].includes('}, [chatState.status]);') && i <= startIdx + 6) {
            endIdx = i;
            break;
        }
    }

    if (startIdx !== -1 && endIdx !== -1) {
        lines.splice(startIdx, endIdx - startIdx + 1);
        content = lines.join('\n');
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log("Removed remoteVideoPlaying.");
    } else {
        console.log("Could not find remoteVideoPlaying to remove.");
    }
}

removeRemoteVideoPlaying();
