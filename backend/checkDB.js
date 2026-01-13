const { db } = require('./config/firebase');

async function checkDepartments() {
    try {
        console.log("Checking Admin Departments...");
        const snapshot = await db.ref('users/admins').once('value');
        if (snapshot.exists()) {
            const admins = snapshot.val();
            console.log("Admin Data Raw:", JSON.stringify(admins, null, 2));
            Object.values(admins).forEach(admin => {
                console.log(`Admin ${admin.email}: Department='${admin.department}'`);
            });
        } else {
            console.log("No admins found in users/admins.");
        }

        console.log("\nChecking Reports by Department...");
        const reportSnap = await db.ref('reports/by_department').once('value');
        if (reportSnap.exists()) {
            const keys = Object.keys(reportSnap.val());
            console.log("Available Department Nodes:", keys);
        } else {
            console.log("No department reports found.");
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDepartments();
