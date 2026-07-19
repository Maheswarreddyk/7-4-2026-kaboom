process.env.TURN_SERVER = "global.relay.metered.ca";
process.env.TURN_USERNAME = "kaboom_test";
process.env.TURN_PASSWORD = "test_secret_key";
const { getIceServers } = require('./dist/config/index.js');
console.log(JSON.stringify(getIceServers(), null, 2));
