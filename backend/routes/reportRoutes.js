const express = require('express');
const router = express.Router();
const { verifyReportImage, createReport, getUserReports, getSingleReport, getDepartmentReports } = require('../controllers/reportController');

router.post('/verify-image', verifyReportImage);
router.post('/create', createReport);
router.post('/update-status', require('../controllers/reportController').updateReportStatus);
router.post('/broadcast', require('../controllers/reportController').sendBroadcast);
router.get('/user/:uid', getUserReports);
router.get('/department/:department', getDepartmentReports);
router.get('/:id', getSingleReport);

module.exports = router;