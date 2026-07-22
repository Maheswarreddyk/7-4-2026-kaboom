const fs = require('fs');
const p = 'c:/Users/coding/Desktop/indiaTV/frontend/src/hooks/useVideoChat.ts';
let code = fs.readFileSync(p, 'utf8');

const helper = `
  const getMatchSettings = useCallback(() => {
    return {
      matchMode: safeLocalStorage.getItem('kaboom_match_mode') || 'RANDOM',
      tags: safeLocalStorage.getJSON('kaboom_interest_tags', []),
      genderPreference: safeLocalStorage.getJSON('kaboom_looking', ['Anyone'])
    };
  }, []);
`;

code = code.replace(
  'const { playQueueJoin, playConnected } = useAudioUX();',
  'const { playQueueJoin, playConnected } = useAudioUX();\n' + helper
);

code = code.replace(/realtimeManager\.joinQueue\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, (match, p1, p2, p3) => {
  if (p3.includes('getMatchSettings')) return match;
  return `realtimeManager.joinQueue(${p1}, ${p2}, ${p3}, getMatchSettings())`;
});

code = code.replace(/realtimeManager\.nextPartner\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, (match, p1, p2, p3, p4, p5) => {
  if (p5.includes('getMatchSettings')) return match;
  return `realtimeManager.nextPartner(${p1}, ${p2}, ${p3}, ${p4}, ${p5}, getMatchSettings())`;
});

fs.writeFileSync(p, code);
