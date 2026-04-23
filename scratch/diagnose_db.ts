import postgres from 'postgres';

async function diagnose() {
    const url = "postgresql://postgres.nlogikvondabrhdldagq:Y0nrSGAzhnoF4YyF@aws-1-eu-west-3.pooler.supabase.com:6543/postgres";
    const sql = postgres(url);

    const targetListId = '5Rt_UzqUFojnDLR_7oj2N';
    const targetSessionId = 'dT9xMsrXnCrozY12bM_iE';

    try {
        console.log(`Checking session ${targetSessionId}...`);
        const sessions = await sql`
            SELECT * FROM sessions WHERE id = ${targetSessionId};
        `;
        console.log('Session Info:', JSON.stringify(sessions, null, 2));

        if (sessions.length > 0) {
            const userId = sessions[0].user_id; // Raw postgres driver returns snake_case
            console.log(`\nChecking user ${userId} permissions for list ${targetListId}...`);
            
            const list = await sql`
                SELECT * FROM lists WHERE id = ${targetListId};
            `;
            console.log('List Details:', JSON.stringify(list, null, 2));

            const membership = await sql`
                SELECT * FROM list_users 
                WHERE list_id = ${targetListId} AND user_id = ${userId};
            `;
            console.log('Membership Record:', JSON.stringify(membership, null, 2));
            
            if (membership.length === 0) {
                console.log('\n!!! MISSING MEMBERSHIP RECORD !!!');
                console.log('The user exists and the list exists, but there is no entry in list_users.');
            }
        } else {
            console.log('\nSESSION NOT FOUND in database!');
        }

        await sql.end();
        process.exit(0);
    } catch (e) {
        console.error('Diagnosis failed:', e);
        process.exit(1);
    }
}

diagnose();
