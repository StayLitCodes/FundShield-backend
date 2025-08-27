// Simple load test script using autocannon
const autocannon = require('autocannon');

const url = process.argv[2] || 'http://localhost:3000/api/v1/health';
const connections = parseInt(process.argv[3]) || 50;
const duration = parseInt(process.argv[4]) || 30;

console.log(`Running load test on ${url} with ${connections} connections for ${duration}s...`);

autocannon({
  url,
  connections,
  duration,
}, (err, result) => {
  if (err) throw err;
  console.log(autocannon.printResult(result));
});
