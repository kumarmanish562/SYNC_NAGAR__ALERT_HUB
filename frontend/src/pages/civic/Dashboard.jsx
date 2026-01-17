import React, { useState, useEffect } from 'react';
import { Camera, Map, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { getDatabase, ref, onValue, query, limitToLast, orderByChild } from "firebase/database";
import { auth } from '../../services/firebase';
import SurvivalChart from '../../components/SurvivalChart';

import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
    const [recentReports, setRecentReports] = useState([]);
    const [nearbyReports, setNearbyReports] = useState([]);

    useEffect(() => {
        const db = getDatabase(auth.app);

        // 1. Listen to Global Reports Stream
        const reportsRef = ref(db, 'reports');
        const unsubscribeReports = onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const reportsArray = Object.values(data);

                // Filter specifically for the current user (Private Stats)
                const userReports = reportsArray.filter(r => {
                    const cleanMobile = currentUser?.mobile?.replace(/\D/g, '') || "";
                    const reportUser = (r.userId || "").replace(/\D/g, "");
                    return r.userId === currentUser?.uid || (cleanMobile && reportUser.includes(cleanMobile));
                });

                // Filter for SAME AREA/CITY (Public Stream for this user's area)
                // "No other city" logic: Match the city name from the user's profile address.
                let areaReports = [];
                if (currentUser?.address) {
                    const userAddrParts = currentUser.address.split(',');
                    // Assistive Heuristic: Assume City is the last or 2nd to last part if address is comma separated
                    // e.g. "123 St, Sector 1, Noida" -> "Noida"
                    const userCity = userAddrParts.length > 1
                        ? userAddrParts[userAddrParts.length - 1].trim().toLowerCase()
                        : currentUser.address.toLowerCase();

                    areaReports = reportsArray.filter(r => {
                        const rAddr = (r.location?.address || "").toLowerCase();
                        return rAddr.includes(userCity);
                    });
                } else {
                    // Fallback: If user has no address, show everything or nothing? 
                    // Let's show everything to encourage them to set address, or keep same as userReports
                    areaReports = reportsArray;
                }

                // Stats are PERSONAL
                const pending = userReports.filter(r => r.status === 'Pending').length;
                const resolved = userReports.filter(r => r.status === 'Resolved' || r.status === 'Accepted').length;
                setStats({ total: userReports.length, pending, resolved });

                // Stream is LOCAL COMMUNITY (Area Reports)
                // Sort by newest first
                const sorted = areaReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
                setRecentReports(sorted);
            }
        });

        // 2. Fetch Nearby Reports (Hackathon Feature)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
                    const { latitude, longitude } = pos.coords;
                    const res = await fetch(`${API_BASE_URL}/api/reports/nearby?lat=${latitude}&lng=${longitude}&radius=5`);
                    if (res.ok) {
                        const data = await res.json();
                        setNearbyReports(data.reports || []);
                    }
                } catch (e) {
                    console.error("Nearby Fetch Error", e);
                }
            }, (err) => console.log("Geo Denied", err));
        }

        return () => unsubscribeReports();
    }, [currentUser]);

    // Points now come directly from AuthContext
    const userPoints = currentUser?.points || 0;

    return (
        <CivicLayout>
            {/* Stats Row */}
            <div className="flex flex-col md:flex-row gap-6 md:items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Live Updates from Nagar Alert Hub</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-4 py-2 rounded-xl bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 font-bold text-sm border border-green-200 dark:border-green-500/30">
                        Resolved: {stats.resolved} / {stats.total}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ActionCard
                            to="/civic/report"
                            title="Report Issue"
                            icon={<Camera size={28} />}
                            color="bg-slate-900 dark:bg-slate-800 text-white"
                        />
                        <ActionCard
                            to="/civic/map"
                            title="Live Map"
                            icon={<Map size={28} />}
                            color="bg-blue-600 text-white"
                        />
                        <ActionCard
                            to="/sos"
                            title="SOS"
                            icon={<AlertTriangle size={28} />}
                            color="bg-red-500 text-white"
                        />
                    </div>
                    {/* Recent Activity */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Live Reports Stream</h2>
                        <div className="space-y-4">
                            {recentReports.length > 0 ? (
                                recentReports.map((report, index) => (
                                    <ActivityRow
                                        key={index}
                                        icon={report.type === 'pothole' ? '🚧' : report.type === 'garbage' ? '🗑️' : '🚩'}
                                        title={`${report.type} Reported`}
                                        loc={report.location?.address || (report.location?.lat ? `Lat: ${report.location.lat.toString().slice(0, 7)}` : 'Location N/A')}
                                        time={new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        status={report.status}
                                    />
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm">No reports yet. Be the first!</p>
                            )}
                        </div>
                    </div>

                    {/* Nearby Alerts (Geo Feature) */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-orange-500" /> Nearby Alerts (5km Radius)
                        </h2>
                        <div className="space-y-4">
                            {nearbyReports.length > 0 ? (
                                nearbyReports.slice(0, 3).map(report => (
                                    <ActivityRow
                                        key={report.id}
                                        icon="📍"
                                        title={report.type || 'Issue'}
                                        loc={`${report.distance} km away`}
                                        status={report.status || 'Active'}
                                        time="Right Now"
                                    />
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm">Safe Zone! No alerts nearby.</p>
                            )}
                        </div>
                    </div>
                </div>
                {/* Right Col */}
                <div className="flex flex-col gap-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between min-h-[220px]">
                        <div>
                            <div className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Your Impact</div>
                            <div className="text-3xl font-bold mb-4">{userPoints > 1000 ? 'Gold Tier' : 'Silver Tier'}</div>
                            <div className="text-5xl font-black mb-6">{userPoints} <span className="text-lg">Pts</span></div>
                        </div>
                        <Link to="/leaderboard" className="block w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-center font-bold text-sm transition-colors">View Leaderboard</Link>
                    </div>

                    {/* Survival Kit Chart */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-72">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm uppercase tracking-wider">My Stats</h3>
                        <SurvivalChart data={[stats.resolved, stats.pending, Math.max(0, stats.total - stats.resolved - stats.pending)]} />
                    </div>
                </div>
            </div>
        </CivicLayout>
    );
};

const ActionCard = ({ to, title, icon, color }) => (
    <Link to={to} className={`p-6 rounded-3xl ${color} hover:-translate-y-1 transition-transform shadow-lg block`}>
        <div className="mb-4 opacity-80">{icon}</div>
        <h3 className="text-lg font-bold">{title}</h3>
    </Link>
);

const ActivityRow = ({ icon, title, loc, time, status }) => (
    <div className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xl border border-slate-200 dark:border-slate-700">{icon}</div>
        <div className="flex-1">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{loc}</p>
        </div>
        <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">{status}</span>
    </div>
);

export default Dashboard;