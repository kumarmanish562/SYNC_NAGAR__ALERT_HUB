import React, { useState, useEffect } from 'react';
import {
    Trophy, Star, Award, Shield, Zap, MapPin, Trash2,
    Flame, Stethoscope, AlertTriangle, CheckCircle, Lock, Crown
} from 'lucide-react';
import CivicLayout from './CivicLayout';
import { useAuth } from '../../context/AuthContext';
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from '../../services/firebase';

const Achievements = () => {
    const { currentUser } = useAuth();
    const [earnedBadges, setEarnedBadges] = useState([]);
    const [stats, setStats] = useState({ reports: 0, points: 0, distinctTypes: 0 });

    // Define all possible badges
    const ALL_BADGES = [
        { id: 'first_report', label: 'First Step', description: 'Submit your first civic report', icon: <Star />, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
        { id: 'verified', label: 'Verified Citizen', description: 'Link your mobile number', icon: <Shield />, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
        { id: 'pothole_pro', label: 'Pothole Pro', description: 'Report a road hazard', icon: <MapPin />, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
        { id: 'clean_city', label: 'Clean City', description: 'Report a garbage issue', icon: <Trash2 />, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
        { id: 'guardian', label: 'Guardian', description: 'Report a fire or safety hazard', icon: <Flame />, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
        { id: 'lifesaver', label: 'Lifesaver', description: 'Report a medical emergency', icon: <Stethoscope />, color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20' },
        { id: 'traffic_watch', label: 'Traffic Watch', description: 'Report a traffic issue', icon: <AlertTriangle />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
        { id: 'civic_hero', label: 'Civic Hero', description: 'Reach 50 Karma Points', icon: <Zap />, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
        { id: 'active_citizen', label: 'Active Citizen', description: 'Submit 5+ reports', icon: <CheckCircle />, color: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/20' },
        { id: 'super_reporter', label: 'Super Reporter', description: 'Submit 20+ reports', icon: <Award />, color: 'text-indigo-400', bg: 'bg-indigo-400/10 border-indigo-400/20' },
        { id: 'elite', label: 'Elite Status', description: 'Reach Level 5 or 500 points', icon: <Crown />, color: 'text-yellow-600', bg: 'bg-yellow-600/10 border-yellow-600/20' },
        { id: 'contributor', label: 'Top Contributor', description: 'Get 3 reports verified', icon: <Trophy />, color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20' }
    ];

    useEffect(() => {
        if (!currentUser) return;

        const db = getDatabase(auth.app);

        // 1. Listen to Reports
        const reportsRef = ref(db, 'reports');
        const unsubReports = onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const allData = snapshot.val();
                const myReports = Object.values(allData).filter(r => r.userId === currentUser.uid);

                // Calculate Stats
                const count = myReports.length;
                const verifiedCount = myReports.filter(r => r.status === 'Resolved' || r.status === 'Verified').length;
                const types = new Set(myReports.map(r => r.type || r.department)).size;

                setStats(prev => ({ ...prev, reports: count }));

                // Calculate Badges
                const earned = new Set();

                if (count >= 1) earned.add('first_report');
                if (count >= 5) earned.add('active_citizen');
                if (count >= 20) earned.add('super_reporter');
                if (verifiedCount >= 3) earned.add('contributor');

                if (myReports.some(r => JSON.stringify(r).toLowerCase().includes('pothole'))) earned.add('pothole_pro');
                if (myReports.some(r => JSON.stringify(r).toLowerCase().includes('garbage'))) earned.add('clean_city');
                if (myReports.some(r => JSON.stringify(r).toLowerCase().includes('fire'))) earned.add('guardian');
                if (myReports.some(r => JSON.stringify(r).toLowerCase().includes('medical') || JSON.stringify(r).toLowerCase().includes('accident'))) earned.add('lifesaver');
                if (myReports.some(r => JSON.stringify(r).toLowerCase().includes('traffic'))) earned.add('traffic_watch');

                setEarnedBadges(Array.from(earned));
            }
        });

        // 2. Listen to User Profile (Points, Mobile)
        const userRef = ref(db, `users/registry/${currentUser.uid}`);
        const unsubUser = onValue(userRef, (snap) => {
            if (snap.exists()) {
                const u = snap.val();
                const points = u.points || 0; // Registry might not have points, fallback to citizen node if needed

                // Check Mobile Verify
                // Actually need to check main auth or citizen node for points mostly
                setStats(prev => ({ ...prev, points }));
            }
        });

        // 3. Listen to Citizen Node for Points specifically (as registry is master contact, citizen is master gamification)
        const citizenRef = ref(db, `users/citizens/${currentUser.uid}`);
        const unsubCitizen = onValue(citizenRef, (snap) => {
            if (snap.exists()) {
                const c = snap.val();
                if ((c.points || 0) >= 50) setEarnedBadges(prev => [...new Set([...prev, 'civic_hero'])]);
                if ((c.points || 0) >= 500) setEarnedBadges(prev => [...new Set([...prev, 'elite'])]);
            }
        });

        // Check Auth data for verification
        if (currentUser.mobile || currentUser.phoneNumber) {
            setEarnedBadges(prev => [...new Set([...prev, 'verified'])]);
        }

        return () => {
            unsubReports();
            unsubUser();
            unsubCitizen();
        };
    }, [currentUser]);

    const progressPercentage = Math.round((earnedBadges.length / ALL_BADGES.length) * 100);

    return (
        <CivicLayout>
            <div className="space-y-8">
                {/* Header Section */}
                <div className="bg-[#1e293b] rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                                <Trophy className="text-yellow-400" size={32} />
                                Your Hall of Fame
                            </h1>
                            <p className="text-slate-400 text-lg mb-6">
                                Unlock badges by contributing to your community.
                            </p>

                            {/* Progress Bar */}
                            <div className="bg-slate-700/50 rounded-full h-4 w-full max-w-md overflow-hidden backdrop-blur-sm border border-slate-600">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between max-w-md mt-2 text-sm font-bold text-slate-400">
                                <span>{earnedBadges.length} Earned</span>
                                <span>{ALL_BADGES.length} Total</span>
                            </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <StatCard label="Total Badges" value={earnedBadges.length} icon={<Award size={20} />} />
                            <StatCard label="Reports" value={stats.reports} icon={<CheckCircle size={20} />} />
                            <StatCard label="Next Level" value="Lvl 4" icon={<Zap size={20} />} opacity={0.5} />
                        </div>
                    </div>

                    {/* Decorative BG */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] -ml-16 -mb-16 pointer-events-none"></div>
                </div>



            </div>
        </CivicLayout>
    );
};

const StatCard = ({ label, value, icon, opacity = 1 }) => (
    <div className={`bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-md flex flex-col items-center justify-center text-center opacity-[${opacity}]`}>
        <div className="text-slate-400 mb-2">{icon}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
    </div>
);

export default Achievements;
