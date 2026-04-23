import { importPKCS8, exportJWK, importSPKI, SignJWT, jwtVerify } from 'jose';
import fs from 'fs';
import { randomUUID } from 'crypto';

async function convert() {
    try {
        const kid = randomUUID();
        const privatePem = fs.readFileSync('./private.pem', 'utf8');
        const privateKey = await importPKCS8(privatePem, 'ES256', { extractable: true });
        
        // Derive Public JWK from Private Key
        const fullJwk = await exportJWK(privateKey);
        const { d, ...publicJwk } = fullJwk;
        const privateJwk = fullJwk;
        
        console.log('--- PRIVATE JWK (Keep this secret!) ---');
        console.log(JSON.stringify({ ...privateJwk, kid }, null, 2));

        console.log('\n--- PUBLIC JWK (Upload this to Supabase) ---');
        console.log(JSON.stringify({ 
            ...publicJwk, 
            kid, 
            use: 'sig', 
            alg: 'ES256' 
        }, null, 2));

        // LOCAL TEST
        console.log('\n--- LOCAL VERIFICATION TEST ---');
        const token = await new SignJWT({ sub: 'test' })
            .setProtectedHeader({ alg: 'ES256', kid })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(privateKey);
        
        try {
            // We can import the public JWK to get a key object for verification
            const { importJWK } = await import('jose');
            const publicKey = await importJWK(publicJwk, 'ES256');
            await jwtVerify(token, publicKey);
            console.log('✅ Success: Local keypair is valid and signing correctly.');
        } catch (err) {
            console.error('❌ Failure: Local verification failed.', err);
        }

        console.log('\n--- IMPORTANT ---');
        console.log(`Set your SUPABASE_JWT_KID in .env to: ${kid}`);
    } catch (e) {
        console.error('Error during conversion/test:', e);
    }
}

convert();
