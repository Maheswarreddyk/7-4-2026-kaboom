import fs from 'fs';
import path from 'path';

// Locate the most recent report JSON
const reportsDir = path.resolve(__dirname, '../reports');
const files = fs.readdirSync(reportsDir).filter(f => f.startsWith('report_') && f.endsWith('.json'));

if (files.length === 0) {
  console.error('No reports found.');
  process.exit(1);
}

files.sort((a, b) => fs.statSync(path.join(reportsDir, b)).mtimeMs - fs.statSync(path.join(reportsDir, a)).mtimeMs);
const latestFile = path.join(reportsDir, files[0]);

const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));

let md = `# Phase 6+ Digital Twin Load Test Report\n\n`;
md += `**Total Users Simulated:** ${data.length}\n\n`;

// Aggregate summary metrics
let successful = 0;
let abandoned = 0;
let errors = 0;

data.forEach((trail: any) => {
  if (trail.finalOutcome === 'MATCHED_AND_CHATTED' || trail.finalOutcome === 'FINISHED_CHATTING' || trail.finalOutcome === 'MATCHED') {
    successful++;
  } else if (trail.finalOutcome === 'ABANDONED_QUEUE' || trail.behavior === 'ABANDON_QUEUE') {
    abandoned++;
  } else if (trail.finalOutcome === 'ERROR' || trail.finalOutcome === 'FAILED') {
    errors++;
  }
});

md += `## High-Level Summary\n`;
md += `- **Successful Matches:** ${successful}\n`;
md += `- **Abandoned Queues (Intended):** ${abandoned}\n`;
md += `- **Errors / Unexpected Failures:** ${errors}\n\n`;

md += `## Row-Level User Journey\n\n`;

md += `| User ID / Name | Match Mode | Selected Tags | Final Outcome | Wait Time (ms) | Conn Time (ms) | Duration (ms) | Match Score | Shared Tags | Decision Path |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|\n`;

data.forEach((trail: any) => {
  const matchAnalysis = trail.matchAnalysis || {};
  const score = matchAnalysis.matchScore !== undefined ? matchAnalysis.matchScore : '-';
  const sharedTags = matchAnalysis.matchCriteriaUsed ? JSON.stringify(matchAnalysis.matchCriteriaUsed) : '-';
  const decisionPath = matchAnalysis.backendDecisionPath ? matchAnalysis.backendDecisionPath.join(' -> ') : '-';
  
  // Try to extract mode/tags from actions if not logged directly at root level.
  let mode = 'RANDOM';
  let tags = '[]';
  
  // Find the exact mode from the join queue action or local storage
  const queueAction = trail.actions.find((a: any) => a.action === 'API:POST:/api/match/join');
  if (queueAction) {
    try {
      const payload = JSON.parse(queueAction.result);
      if (payload.reqBody && payload.reqBody.mode) {
         mode = payload.reqBody.mode;
      }
    } catch(e) {}
  }
  const name = trail.profile?.name || trail.userId.split('-')[0];
  if (name.includes('Random')) mode = 'RANDOM';
  if (name.includes('Smart')) mode = 'PREFER';
  if (name.includes('Exact')) mode = 'STRICT';

  md += `| ${name} | ${mode} | ${tags} | ${trail.finalOutcome} | ${trail.totalQueueWaitTimeMs} | ${trail.totalConnectionEstablishmentTimeMs} | ${trail.totalConnectedDurationMs} | ${score} | ${sharedTags} | ${decisionPath} |\n`;
});

const reportOutPath = 'C:\\Users\\coding\\.gemini\\antigravity\\brain\\41f1a3f1-f691-494f-8a2d-5c0be4aac10f\\Phase_6_Ground_Truth_Report.md';
fs.writeFileSync(reportOutPath, md);

console.log(`Report generated successfully at ${reportOutPath}`);
