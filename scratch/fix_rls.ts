import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function fix() {
    const url = "postgresql://postgres.nlogikvondabrhdldagq:Y0nrSGAzhnoF4YyF@aws-1-eu-west-3.pooler.supabase.com:6543/postgres";
    const sql = postgres(url);

    try {
        console.log('Reading add_rls.sql...');
        const sqlContent = fs.readFileSync(path.join(process.cwd(), 'add_rls.sql'), 'utf-8');
        
        console.log('Applying updated RLS configuration...');
        // Split by semicolon to run individual statements if needed, 
        // but postgres-js can handle multiple statements if they are valid.
        await sql.unsafe(sqlContent);
        
        console.log('RLS Update Successful!');
        await sql.end();
        process.exit(0);
    } catch (e) {
        console.error('RLS Update failed:', e);
        process.exit(1);
    }
}

fix();
