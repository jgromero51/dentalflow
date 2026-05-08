
const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/status');
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
