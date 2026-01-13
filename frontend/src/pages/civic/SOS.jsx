import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Shield, AlertTriangle, Siren, CheckCircle, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';

const SOS = () => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
        let timer;
        if (active && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else if (active && countdown === 0) {
            // Trigger SOS
            setActive(false);
        }
        return () => clearTimeout(timer);
    }, [active, countdown]);

    const handleSOSClick = () => {
        if (!active) {
            setActive(true);
            setCountdown(5);
        } else {
            setActive(false);
            setCountdown(null);
        }
    };

    return (
        <CivicLayout>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-100px)] items-center">

                {/* Left Col: Explainer & Contacts */}
                <div className="space-y-8">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full font-bold text-sm mb-4">
                            <Siren size={18} /> Emergency Mode
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Emergency SOS</h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
                            In case of immediate danger, use this tool to silence your phone and broadcast your live location to the nearest police station and your emergency contacts.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Shield size={20} className="text-blue-500" /> Trusted Contacts
                        </h3>
                        <div className="space-y-4">
                            <ContactRow icon={<Phone size={20} />} name="Police Control Room" number="100" type="Official" />
                            <ContactRow icon={<AlertTriangle size={20} />} name="Fire Brigade" number="101" type="Official" />
                            <ContactRow icon={<UserIcon />} name="Dad (Family)" number="+91 98765 43210" type="Personal" />
                        </div>
                    </div>
                </div>

                {/* Right Col: The BIG Button */}
                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800 rounded-[3rem] border border-slate-200 dark:border-slate-700 relative overflow-hidden h-full min-h-[500px]">

                    {/* Background Pulse Effect */}
                    {active && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <motion.div
                                animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="w-[500px] h-[500px] bg-red-500 rounded-full blur-3xl"
                            />
                        </div>
                    )}

                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-12 relative z-10 text-center">
                        {active ? "Sending Alert in..." : "Tap to activate Emergency SOS"}
                    </h2>

                    <button
                        onClick={handleSOSClick}
                        className={`w-72 h-72 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 relative z-10 border-8 ${active
                            ? 'bg-white border-red-500 text-red-600'
                            : 'bg-gradient-to-br from-red-500 to-red-600 border-red-100 text-white shadow-red-500/40 hover:shadow-red-500/60'
                            }`}
                    >
                        {active ? (
                            <>
                                <span className="text-8xl font-black mb-2">{countdown}</span>
                                <span className="text-lg font-bold uppercase tracking-wider">Cancel</span>
                            </>
                        ) : (
                            <>
                                <BellRing size={80} className="mb-6 animate-pulse" />
                                <span className="text-4xl font-black tracking-widest">SOS</span>
                            </>
                        )}
                    </button>

                    {/* Status Message */}
                    {countdown === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-12 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-8 py-4 rounded-xl font-bold flex items-center gap-3 text-lg"
                        >
                            <CheckCircle size={24} />
                            Alert Sent Successfully! Staying silent...
                        </motion.div>
                    )}
                </div>

            </div>
        </CivicLayout>
    );
};

const ContactRow = ({ icon, name, number, type }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm">
                {icon}
            </div>
            <div>
                <div className="font-bold text-base text-slate-900 dark:text-white">{name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{number}</div>
            </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${type === 'Official' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'}`}>
            {type}
        </span>
    </div>
);

const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export default SOS;
