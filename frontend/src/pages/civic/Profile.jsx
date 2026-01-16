import React from 'react';
import { User, Mail, Phone, MapPin, Edit2, LogOut, Settings as SettingsIcon, Shield, ChevronRight, BarChart, Star, Trash2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { useAuth } from '../../context/AuthContext';

import { getDatabase, ref, onValue, update } from "firebase/database";
import { auth } from '../../services/firebase';

const Profile = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [userData, setUserData] = React.useState({
        firstName: '',
        lastName: '',
        email: '',
        mobile: '',
        address: '',
        profilePic: '',
        points: 0,
        reportCount: 0,
        role: 'Citizen',
        badges: []
    });
    const [isEditing, setIsEditing] = React.useState(false);
    const [editedData, setEditedData] = React.useState({});

    // Sync local state when Auth finishes loading user
    React.useEffect(() => {
        if (currentUser) {
            // First, RESET state to avoid stale data from previous user leaking in
            setUserData({
                firstName: '', lastName: '', email: '', mobile: '', address: '',
                profilePic: '', points: 0, reportCount: 0, role: 'Citizen', badges: []
            });

            setUserData(prev => ({
                ...prev,
                firstName: currentUser.firstName || currentUser.displayName?.split(' ')[0] || 'User',
                lastName: currentUser.lastName || currentUser.displayName?.split(' ').slice(1).join(' ') || '',
                email: currentUser.email || '',
                mobile: currentUser.mobile || (currentUser.phoneNumber ? currentUser.phoneNumber.replace('+91', '') : 'N/A'),
                address: currentUser.address || 'No address set',
                profilePic: currentUser.profilePic || currentUser.photoURL || '',
                points: currentUser.points || 0,
                role: currentUser.role || 'Citizen'
            }));

            // Sync with Registry (Master Record) for full details
            const db = getDatabase(auth.app);
            const registryRef = ref(db, `users/registry/${currentUser.uid}`);
            const unsubRegistry = onValue(registryRef, (snap) => {
                if (snap.exists()) {
                    const reg = snap.val();
                    setUserData(prev => ({
                        ...prev,
                        firstName: reg.firstName || prev.firstName,
                        lastName: reg.lastName || prev.lastName,
                        mobile: reg.mobile || prev.mobile,
                        address: reg.address || prev.address,
                        email: reg.email || prev.email,
                        profilePic: reg.profilePic || prev.profilePic
                    }));
                }
            });

            // Listen for reports count and generate badges
            const reportsRef = ref(db, 'reports');
            const unsubscribeReports = onValue(reportsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const allReports = snapshot.val();
                    const myReports = Object.values(allReports).filter(r => r.userId === currentUser.uid);

                    // Logic for badges
                    const newBadges = [];
                    // 1. First Report
                    if (myReports.length > 0) newBadges.push({ id: 'first', label: 'First Report', icon: <Star size={24} />, color: 'bg-yellow-500' });
                    // 2. Pothole Pro
                    if (myReports.some(r => (r.type || '').toLowerCase().includes('pothole'))) newBadges.push({ id: 'pothole', label: 'Pothole Pro', icon: <MapPin size={24} />, color: 'bg-blue-500' });
                    // 3. Clean City (Garbage)
                    if (myReports.some(r => (r.type || '').toLowerCase().includes('garbage'))) newBadges.push({ id: 'clean', label: 'Clean City', icon: <Trash2 size={24} />, color: 'bg-green-500' });
                    // 4. Verified (Mobile present)
                    // We check currentUser.mobile directly
                    if (currentUser.mobile || (currentUser.phoneNumber)) newBadges.push({ id: 'verified', label: 'Verified', icon: <Shield size={24} />, color: 'bg-purple-600' });
                    // 5. Civic Hero (Points > 50)
                    if ((currentUser.points || 0) > 50) newBadges.push({ id: 'hero', label: 'Civic Hero', icon: <Zap size={24} />, color: 'bg-red-500' });

                    setUserData(prev => ({ ...prev, reportCount: myReports.length, badges: newBadges }));
                } else {
                    setUserData(prev => ({ ...prev, reportCount: 0, badges: [] }));
                }
            });

            return () => {
                unsubRegistry();
                unsubscribeReports();
            };
        } else {
            // ... (logout logic)
            navigate('/login');
        }
    }, [currentUser, navigate]);

    if (!currentUser) return null;

    return (
        <CivicLayout>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ... Left Col code ... */}
                <div className="space-y-6">
                    {/* ... Profile Card ... */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-8 flex flex-col items-center text-center relative overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute top-0 w-full h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

                        <div className="relative w-32 h-32 mb-4">
                            <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-900 shadow-lg bg-slate-200 overflow-hidden relative z-10 transition-transform hover:scale-105">
                                <img
                                    src={userData.profilePic || `https://ui-avatars.com/api/?name=${userData.firstName}+${userData.lastName}&background=0D8ABC&color=fff&size=128`}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    const url = prompt("Enter Image URL for profile picture:", userData.profilePic);
                                    if (url !== null) {
                                        const db = getDatabase(auth.app);
                                        const userRef = ref(db, `users/citizens/${auth.currentUser.uid}`);
                                        update(userRef, { profilePic: url })
                                            .then(() => setUserData(p => ({ ...p, profilePic: url })))
                                            .catch(e => alert("Update failed: " + e.message));
                                    }
                                }}
                                className="absolute bottom-1 right-1 z-20 bg-slate-900 dark:bg-slate-700 text-white p-2.5 rounded-full border-2 border-white dark:border-slate-900 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md group"
                            >
                                <Edit2 size={14} className="group-hover:rotate-12 transition-transform" />
                            </button>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{userData.firstName} {userData.lastName}</h1>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-6 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 capitalize">
                            {userData.role} • {userData.address}
                        </p>

                        <div className="grid grid-cols-3 gap-2 w-full mb-6">
                            <StatBox label="Reports" value={userData.reportCount} />
                            <StatBox label="Points" value={userData.points} highlighted />
                            <StatBox label="Rank" value="#3" />
                        </div>

                        <button
                            onClick={() => {
                                setEditedData(userData);
                                setIsEditing(true);
                            }}
                            className="w-full py-3 bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-xl font-bold transition-colors"
                        >
                            Edit Public Profile
                        </button>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Account</h3>
                        <div className="space-y-1">
                            <ActionRow icon={<Shield size={18} />} label="Privacy & Security" onClick={() => navigate('/civic/privacy')} />
                            <ActionRow icon={<SettingsIcon size={18} />} label="Preferences" onClick={() => navigate('/civic/preferences')} />
                            <ActionRow icon={<BarChart size={18} />} label="Data Usage" onClick={() => navigate('/civic/data-usage')} />
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 my-4"></div>
                        <button onClick={() => auth.signOut()} className="w-full py-3 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl flex items-center justify-center gap-2 transition-colors">
                            <LogOut size={18} /> Log Out
                        </button>
                    </div>
                </div>

                {/* Right Col: Details Board */}
                <div className="lg:col-span-2 space-y-8">

                    {/* NEW: Achievements Section (LeetCode Style) */}
                    <div className="bg-[#1e293b] rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold">Your Achievements</h2>
                                    <p className="text-slate-400 mt-1">You have earned {userData.badges.length} badges.</p>
                                </div>
                                <button
                                    onClick={() => navigate('/civic/achievements')}
                                    className="bg-slate-700/50 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition backdrop-blur-sm"
                                >
                                    View All
                                </button>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                {userData.badges.length > 0 ? userData.badges.map(badge => (
                                    <div key={badge.id} className="flex flex-col items-center gap-3 bg-slate-800/50 p-4 rounded-2xl min-w-[110px] border border-slate-700 hover:bg-slate-800 transition-colors">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${badge.color} text-white shadow-lg`}>
                                            {badge.icon}
                                        </div>
                                        <span className="text-[10px] font-extrabold text-center uppercase tracking-widest text-slate-300">{badge.label}</span>
                                    </div>
                                )) : (
                                    <div className="text-slate-400 italic text-sm py-4">
                                        Submit your first report to unlock badges!
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Decorative Background Blur */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 -mr-16 -mt-16 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-600 rounded-full blur-[100px] opacity-20 -ml-16 -mb-16 pointer-events-none"></div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal Information</h2>
                            <button
                                onClick={() => {
                                    if (isEditing) {
                                        // Save Logic
                                        const db = getDatabase(auth.app);
                                        const updates = {
                                            firstName: editedData.firstName || userData.firstName,
                                            lastName: editedData.lastName || userData.lastName,
                                            mobile: editedData.mobile || userData.mobile,
                                            address: editedData.address || userData.address,
                                            // profilePic handled separately via prompt, but good to ensure consistency if we had input
                                        };

                                        const p1 = update(ref(db, `users/citizens/${auth.currentUser.uid}`), updates);
                                        const p2 = update(ref(db, `users/registry/${auth.currentUser.uid}`), updates);

                                        Promise.all([p1, p2]).then(() => {
                                            setIsEditing(false);
                                            // Optimistic update
                                            setUserData(prev => ({ ...prev, ...updates }));
                                        }).catch(err => alert("Update failed: " + err.message));
                                    } else {
                                        // Start Editing
                                        setEditedData(userData);
                                        setIsEditing(true);
                                    }
                                }}
                                className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {isEditing ? 'Save Changes' : 'Update'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* First Name Input */}
                            {isEditing ? (
                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                                        <User size={20} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">First Name</div>
                                        <input
                                            value={editedData.firstName}
                                            onChange={(e) => setEditedData({ ...editedData, firstName: e.target.value })}
                                            className="w-full bg-transparent font-bold text-slate-900 outline-none"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {isEditing ? (
                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                                        <User size={20} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Last Name</div>
                                        <input
                                            value={editedData.lastName}
                                            onChange={(e) => setEditedData({ ...editedData, lastName: e.target.value })}
                                            className="w-full bg-transparent font-bold text-slate-900 outline-none"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {!isEditing && (
                                <>
                                    <InfoCard icon={<Mail className="text-blue-500" />} label="Email Address" value={userData.email} verified={!!userData.email} />
                                    <InfoCard icon={<Phone className="text-green-500" />} label="Phone Number" value={`+91 ${userData.mobile}`} verified={userData.mobile && userData.mobile !== 'N/A'} />
                                </>
                            )}

                            {isEditing && (
                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                                        <Phone size={20} className="text-green-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Mobile</div>
                                        <input
                                            value={editedData.mobile}
                                            onChange={(e) => setEditedData({ ...editedData, mobile: e.target.value })}
                                            className="w-full bg-transparent font-bold text-slate-900 outline-none"
                                            placeholder="Enter mobile..."
                                        />
                                    </div>
                                </div>
                            )}

                            {isEditing ? (
                                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-4 col-span-full">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                                        <MapPin size={20} className="text-indigo-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Address</div>
                                        <input
                                            value={editedData.address}
                                            onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                                            className="w-full bg-transparent font-bold text-slate-900 outline-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <InfoCard icon={<MapPin className="text-indigo-500" />} label="Home Address" value={userData.address} fullWidth verified={userData.address && userData.address !== 'No address set'} />
                            )}
                        </div>
                    </div>



                </div>

            </div>
        </CivicLayout>
    );
};

const StatBox = ({ label, value, highlighted }) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl border ${highlighted ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}>
        <div className="font-bold text-xl leading-none mb-1">{value}</div>
        <div className={`text-[10px] font-bold uppercase tracking-wider ${highlighted ? 'text-slate-400 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>{label}</div>
    </div>
);

const InfoCard = ({ icon, label, value, verified, fullWidth }) => (
    <div className={`p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-start gap-4 ${fullWidth ? 'col-span-full md:col-span-2' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}>
        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-center shrink-0">
            {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="flex-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-2">
                {label} {verified && <CheckCircle size={12} className="text-green-500 fill-current bg-white dark:bg-slate-900 rounded-full" />}
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug break-words">{value}</div>
        </div>
    </div>
);

const ActionRow = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors text-left group">
        <div className="flex items-center gap-3">
            <div className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{icon}</div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{label}</span>
        </div>
        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
    </button>
);

const BadgeBox = ({ icon, name }) => (
    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-white/10 transition-colors cursor-pointer">
        <div className="text-xl">{icon}</div>
        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-tight">{name}</div>
    </div>
);

// Helper for InfoCard verification check mark
const CheckCircle = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export default Profile;
