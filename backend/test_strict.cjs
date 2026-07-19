const fs = require('fs');
const tsNode = require('ts-node');
tsNode.register();
const { calculateCompatibility } = require('./src/matchmaking/scoringEngine.ts');

const userA = {
  id: 'uA',
  status: 'SEARCHING',
  match_mode: 'STRICT',
  match_constraints: { city: true },
  match_attributes: { city: [] } // Empty attribute
};

const userB = {
  id: 'uB',
  status: 'SEARCHING',
  match_mode: 'STRICT',
  match_constraints: {},
  match_attributes: { city: ['hyderabad'] } // B provided a city
};

const score = calculateCompatibility(userA, userB, 10, new Set(), new Set(), new Map(), 10);
console.log('Result for STRICT with empty attribute:', !!score);
