import React from 'react';
import { Heart, Globe, Github, Users, CheckSquare, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';

const AboutStats = () => {
    const navigate = useNavigate();

    return (
        <CivicLayout>
            <div className="space-y-12 max-w-7xl mx-auto">

                {/* Hero Section */}
                <div className="text-center space-y-4 py-8">
                    <div className="inline-block p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
                        <div className="w-24 h-24 bg-gradient-to-tr from-green-400 to-blue-500 rounded-xl flex items-center justify-center text-5xl shadow-lg shadow-blue-500/20 transform hover:-rotate-3 transition-transform duration-500">
                            🏙️
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">Nagar Alert Hub</h1>
                    <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
                        Empowering citizens to build smarter, safer, and cleaner cities through AI and real-time collaboration.
                    </p>
                    <div className="flex gap-2 justify-center pt-2">
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-500/30 uppercase tracking-widest">v1.0.2-beta</span>
                    </div>
                </div>

                {/* Mission Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
                            <Globe size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Mission</h2>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                            To bridge the gap between citizens and municipal authorities. We believe that every pothole reported and every street light fixed is a step towards a better quality of life.
                        </p>
                    </div>
                    <div className="bg-slate-900 dark:bg-indigo-950 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[300px] border border-slate-800 dark:border-indigo-900">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold mb-2">Join the Movement</h3>
                            <p className="text-slate-400 mb-8">Be part of the 10,000+ citizens making a difference today.</p>
                            <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors">
                                Read Manifesto
                            </button>
                        </div>
                        {/* Abstract Shapes */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-30 -mr-16 -mt-16"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600 rounded-full blur-[60px] opacity-30 -ml-10 -mb-10"></div>
                    </div>
                </div>

                {/* Stats Counter */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={<Users />} value="10k+" label="Active Citizens" color="text-blue-500" />
                    <StatCard icon={<CheckSquare />} value="5.2k" label="Issues Resolved" color="text-green-500" />
                    <StatCard icon={<Zap />} value="98%" label="AI Accuracy" color="text-yellow-500" />
                    <StatCard icon={<Clock />} value="24h" label="Avg Response" color="text-purple-500" />
                </div>

                {/* Footer Credits */}
                <div className="text-center pt-12 pb-8 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-slate-400 font-medium flex items-center justify-center gap-1.5 mb-2">
                        Built with <Heart size={16} className="text-red-500 fill-current animate-pulse bg-red-100 dark:bg-red-500/20 rounded-full p-0.5" /> by the Nagar Team
                    </p>
                    <div className="flex justify-center gap-6 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                        <a href="#" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><Github size={20} /></a>
                        <a href="#" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><Globe size={20} /></a>
                    </div>
                </div>

            </div>
        </CivicLayout>
    );
};

const StatCard = ({ icon, value, label, color }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 text-center hover:-translate-y-1 transition-transform duration-300">
        <div className={`mx-auto w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3 ${color}`}>
            {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">{value}</div>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
);

export default AboutStats;
