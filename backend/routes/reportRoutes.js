const express = require('express');
const router = express.Router();
const {
    verifyReportImage,
    createReport,
    getUserReports,
    getSingleReport,
    getDepartmentReports,
    getAllReports,
    updateReportStatus,
    sendBroadcast,
    getNearbyReports
} = require('../controllers/reportController');

router.post('/verify-image', verifyReportImage);
router.post('/create', createReport);
router.post('/update-status', updateReportStatus);
router.post('/broadcast', sendBroadcast);
router.get('/user/:uid', getUserReports);
router.get('/department/:department', getDepartmentReports);
router.get('/nearby', getNearbyReports);
// NEW: Get ALL reports (Global View)
router.get('/', getAllReports);
router.get('/:id', getSingleReport);

module.exports = router;