import React, { useState, useEffect } from 'react';
import { Camera, Map, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { getDatabase, ref, onValue, query, limitToLast, orderByChild } from "firebase/database";
import { auth } from '../../services/firebase';

import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
    const [recentReports, setRecentReports] = useState([]);

    useEffect(() => {
        const db = getDatabase(auth.app);

        // 1. Listen to Global Reports Stream
        const reportsRef = ref(db, 'reports');
        const unsubscribeReports = onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const reportsArray = Object.values(data);
                const pending = reportsArray.filter(r => r.status === 'Pending').length;
                const resolved = reportsArray.filter(r => r.status === 'Resolved').length;
                setStats({ total: reportsArray.length, pending, resolved });
                const sorted = reportsArray.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
                setRecentReports(sorted);
            }
        });

        return () => unsubscribeReports();
    }, []);

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
                            to="/report"
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
                                        loc={`Lat: ${report.location?.lat?.toFixed(4) || '??'}`}
                                        time={new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        status={report.status}
                                    />
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm">No reports yet. Be the first!</p>
                            )}
                        </div>
                    </div>
                </div>
                {/* Right Col */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">Your Impact</div>
                        <div className="text-3xl font-bold mb-4">{userPoints > 1000 ? 'Gold Tier' : 'Silver Tier'}</div>
                        <div className="text-5xl font-black mb-6">{userPoints} <span className="text-lg">Pts</span></div>
                    </div>
                    <Link to="/leaderboard" className="block w-full py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl text-center font-bold text-sm transition-colors">View Leaderboard</Link>
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