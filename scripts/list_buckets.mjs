import dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';

dotenv.config({ path: '.env.local' });

function getCredentials() {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) privateKey = privateKey.slice(1, -1);
    privateKey = privateKey.trim();

    if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !privateKey) {
        return null;
    }

    return {
        projectId: process.env.GOOGLE_PROJECT_ID,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
    };
}

async function listBuckets() {
    const credentials = getCredentials();
    if (!credentials) {
        console.error('Missing credentials');
        return;
    }

    const storage = new Storage({ credentials });

    try {
        const [buckets] = await storage.getBuckets();
        console.log('Buckets:');
        buckets.forEach(bucket => {
            console.log(bucket.name);
        });
    } catch (err) {
        console.error('ERROR:', err);
    }
}

listBuckets();
