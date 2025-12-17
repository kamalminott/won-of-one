const jwt = require('jsonwebtoken');

// Your Apple credentials
const teamId = 'WXWAR78BHN';
const keyId = '3F6H2H4ZQB';
const servicesId = 'com.kamalminott.wonofone.oauth';

// Read the private key
const privateKey = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgPUnXi4Kf5ik5Ghdk
9iw5kbZtmbdoK81lBkuUV0cUWMqgCgYIKoZIzj0DAQehRANCAASfKrb2Tq/dKs81
Efj2Lr5qSMuPaf8LlQ3kSgL6Yf8mkgI7MkiPfrm9Av2LjkUH9OxMnPiYn1z3f61V
n7mela6c
-----END PRIVATE KEY-----`;

// Create the JWT payload
const now = Math.floor(Date.now() / 1000);
const payload = {
  iss: teamId,
  iat: now,
  exp: now + (6 * 30 * 24 * 60 * 60), // 6 months from now
  aud: 'https://appleid.apple.com',
  sub: servicesId
};

// Create the JWT header
const header = {
  alg: 'ES256',
  kid: keyId
};

// Sign the JWT
const token = jwt.sign(payload, privateKey, {
  algorithm: 'ES256',
  header: header
});

console.log('\n✅ Generated JWT Token:');
console.log(token);
console.log('\n📋 Copy this token and paste it into Supabase "Secret Key (for OAuth)" field\n');

