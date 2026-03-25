import fs from 'fs';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const accountId = env['VITE_R2_ACCOUNT_ID'];
const accessKeyId = env['VITE_R2_ACCESS_KEY_ID'];
const secretAccessKey = env['VITE_R2_SECRET_ACCESS_KEY'];
const bucketName = env['VITE_R2_BUCKET_NAME'];

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error('❌ Missing R2 credentials in .env.local');
  process.exit(1);
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function verify() {
  try {
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(command);
    console.log('✅ Success! R2 credentials are valid and bucket is accessible.');
    
    // Optionally try listing objects to ensure list permissions
    const listCommand = new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 });
    await s3Client.send(listCommand);
    console.log('✅ Success! R2 ListBucket permissions are also valid.');
  } catch (error) {
    console.error('❌ Failed to access R2 bucket:');
    console.error(error.message);
    if (error.Code === 'Forbidden') {
      console.error('Check your access key and secret key permissions.');
    }
    process.exit(1);
  }
}

verify();
