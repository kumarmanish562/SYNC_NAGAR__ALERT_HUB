const { db } = require('./config/firebase');

async function checkSpecificAdmin() {
    try {
        console.log("Checking for admins in 'Municipal/Waste'...");

        // 1. Check reports in 'Municipal_Waste'
        const reportsRef = db.ref('reports/by_department/Municipal_Waste');
        const reportsSnap = await reportsRef.once('value');

        if (reportsSnap.exists()) {
            const reports = Object.values(reportsSnap.val());
            // Sort by createdAt descending
            reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            console.log(`✅ Reports found in Municipal_Waste: ${reports.length}`);

            // Log top 3
            reports.slice(0, 3).forEach((r, i) => {
                console.log(`[${i}] ID: ${r.id}`);
                console.log(`    Type: ${r.type}`);
                console.log(`    ImageUrl: ${r.imageUrl}`);
            });
        } else {
            console.log("❌ NO reports found in Municipal_Waste node.");
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSpecificAdmin();
