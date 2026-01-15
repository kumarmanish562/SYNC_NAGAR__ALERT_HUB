
import React, { useState } from 'react';
import { Trophy, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';

import { getDatabase, ref, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { auth } from '../../services/firebase';

const Leaderboard = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('Weekly');

    const [users, setUsers] = useState([]);
    const [currentUserData, setCurrentUserData] = useState(null);

    // Fetch Leaderboard from Firebase
    React.useEffect(() => {
        const fetchLeaderboard = () => {
            const db = getDatabase(auth.app);

            // Fetch Top 100
            const usersRef = query(ref(db, 'users/citizens'), orderByChild('points'), limitToLast(100));

            onValue(usersRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const leaderboardData = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key],
                        name: (data[key].firstName && data[key].lastName) ? `${data[key].firstName} ${data[key].lastName}` : (data[key].name || 'Anonymous Citizen'),
                        points: data[key].points || 0,
                        avatar: data[key].profilePic || `https://ui-avatars.com/api/?name=${data[key].firstName || 'User'}+${data[key].lastName || ''}&background=random`,
                        isMe: auth.currentUser?.uid === key
                    }));

                    // Sort descending
                    leaderboardData.sort((a, b) => b.points - a.points);

                    // Assign Rank
                    const rankedData = leaderboardData.map((u, index) => ({
                        ...u,
                        rank: index + 1
                    }));

                    setUsers(rankedData);
                }
            });
        };
        fetchLeaderboard();
    }, []);

    // Fetch My Data Separate (to ensure sticky row always works)
    React.useEffect(() => {
        if (!auth.currentUser) return;
        const db = getDatabase(auth.app);
        const myRef = ref(db, `users/citizens/${auth.currentUser.uid}`);

        const unsub = onValue(myRef, (snap) => {
            if (snap.exists()) {
                const d = snap.val();
                setCurrentUserData({
                    id: auth.currentUser.uid,
                    ...d,
                    name: (d.firstName && d.lastName) ? `${d.firstName} ${d.lastName}` : (d.name || 'Me'),
                    points: d.points || 0,
                    avatar: d.profilePic || `https://ui-avatars.com/api/?name=${d.firstName}+${d.lastName}&background=random`
                });
            }
        });
        return () => unsub();
    }, []);

    return (
        <CivicLayout>
            <div className="space-y-8">

                {/* Header Area */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Trophy className="text-yellow-500 fill-current" /> Leaderboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">See who's making the biggest impact in Nagar City.</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl flex items-center">
                        {['Weekly', 'Monthly', 'All Time'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${filter === f ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Top 3 Podium (Left Panel) */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-end items-center h-[500px]">

                        {/* 1st Place Name Display */}
                        <div className="absolute top-8 left-0 right-0 text-center">
                            <div className="text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2">Current Champion</div>
                            <div className="text-3xl font-extrabold">{users[0]?.name || 'No Data'}</div>
                        </div>

                        {/* Podium Visual */}
                        <div className="flex items-end gap-4 relative z-10 w-full justify-center">
                            {/* 2nd Place */}
                            <div className="flex flex-col items-center group cursor-pointer hover:-translate-y-2 transition-transform opacity-90">
                                <div className="w-16 h-16 rounded-full border-4 border-slate-400 mb-2 relative bg-slate-800">
                                    {users[1] ? (
                                        <img src={users[1].avatar} className="w-full h-full rounded-full" alt="2nd" />
                                    ) : <div className="w-full h-full rounded-full bg-slate-700" />}
                                    <div className="absolute -bottom-2 inset-x-0 mx-auto w-6 h-6 bg-slate-400 rounded-full flex items-center justify-center font-bold text-slate-900 text-xs">2</div>
                                </div>
                                <div className="w-20 h-32 bg-slate-700 rounded-t-2xl flex items-end justify-center pb-2">
                                    <span className="font-bold text-slate-300">{users[1]?.points || 0}</span>
                                </div>
                            </div>

                            {/* 1st Place */}
                            <div className="flex flex-col items-center group cursor-pointer hover:-translate-y-2 transition-transform">
                                <div className="relative">
                                    <div className="absolute -top-8 left-0 right-0 mx-auto text-yellow-400 animate-bounce flex justify-center"><Trophy size={24} fill="currentColor" /></div>
                                    <div className="w-20 h-20 rounded-full border-4 border-yellow-400 mb-2 relative shadow-[0_0_20px_rgba(250,204,21,0.5)] bg-slate-800">
                                        {users[0] ? (
                                            <img src={users[0].avatar} className="w-full h-full rounded-full" alt="1st" />
                                        ) : <div className="w-full h-full rounded-full bg-slate-700" />}
                                        <div className="absolute -bottom-2 inset-x-0 mx-auto w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-slate-900 text-sm">1</div>
                                    </div>
                                </div>
                                <div className="w-24 h-48 bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-2xl flex items-end justify-center pb-4">
                                    <span className="font-bold text-xl text-yellow-400">{users[0]?.points || 0}</span>
                                </div>
                            </div>

                            {/* 3rd Place */}
                            <div className="flex flex-col items-center group cursor-pointer hover:-translate-y-2 transition-transform opacity-80">
                                <div className="w-16 h-16 rounded-full border-4 border-orange-700 mb-2 relative bg-slate-800">
                                    {users[2] ? (
                                        <img src={users[2].avatar} className="w-full h-full rounded-full" alt="3rd" />
                                    ) : <div className="w-full h-full rounded-full bg-slate-700" />}
                                    <div className="absolute -bottom-2 inset-x-0 mx-auto w-6 h-6 bg-orange-700 rounded-full flex items-center justify-center font-bold text-white text-xs">3</div>
                                </div>
                                <div className="w-20 h-24 bg-slate-700 rounded-t-2xl flex items-end justify-center pb-2">
                                    <span className="font-bold text-slate-400">{users[2]?.points || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rest of Leaderboard Table (Right Panel) */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white">Top Contributors</h3>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Rank</th>
                                        <th className="px-6 py-4">Citizen</th>
                                        <th className="px-6 py-4">Level</th>
                                        <th className="px-6 py-4 text-right">Karma Points</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-slate-900 dark:text-slate-200">
                                    {users.slice(3).map((user) => (
                                        <tr key={user.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-sm">
                                                    #{user.rank}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={user.avatar} className="w-10 h-10 rounded-full" alt="" />
                                                    <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                                    <Shield size={12} /> Lvl 3
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                                {user.points} pts
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Sticky 'Me' Row if scroll needed */}
                        {(currentUserData || users.find(u => u.isMe)) && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-t border-blue-100 dark:border-blue-800/30 flex items-center justify-between sticky bottom-0 z-10 backdrop-blur-sm">
                                <div className="flex items-center gap-4">
                                    <div className="font-bold text-blue-600 dark:text-blue-400">
                                        #{users.find(u => u.isMe)?.rank || '100+'}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={currentUserData?.avatar || users.find(u => u.isMe)?.avatar}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800"
                                            alt=""
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 dark:text-white leading-tight">You</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {currentUserData?.name || users.find(u => u.isMe)?.name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {currentUserData?.points ?? users.find(u => u.isMe)?.points ?? 0} pts
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </CivicLayout>
    );
};

export default Leaderboard;
