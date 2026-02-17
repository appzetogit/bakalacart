
import axios from 'axios';

async function testApi() {
    const baseUrl = 'http://localhost:5000/api';

    // Note: I don't have a valid token here, so I'd need to login first.
    // But I can't easily login without password.

    console.log('Testing API connectivity...');
    try {
        const res = await axios.get(`${baseUrl}/auth/health`);
        console.log('Health check:', res.data);
    } catch (err) {
        console.log('Health check failed (expected if not exist):', err.message);
    }
}

testApi();
