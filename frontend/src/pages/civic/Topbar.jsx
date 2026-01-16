
import { Link } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon } from 'lucide-react';

import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from '../../services/firebase';

import { useAuth } from '../../context/AuthContext';

import { useTheme } from '../../context/ThemeContext';

const Topbar = ({ isSidebarOpen, toggleSidebar }) => {
    const { currentUser } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const userName = currentUser
        ? (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}` : (currentUser.displayName || "User"))
        : "Guest";

    return (
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between z-20 sticky top-0 transition-colors">

            <div className="flex items-center gap-4">
                <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
                    <Menu size={20} />
                </button>

                {/* Search - Hidden on small screens */}
                <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all w-64 lg:w-96">
                    <Search size={18} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search city, area, or issue..."
                        className="bg-transparent outline-none text-sm w-full text-slate-900 dark:text-white placeholder-slate-400 ml-1"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 md:gap-4">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
                    title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {theme === 'dark' ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-slate-600" />}
                </button>

                {/* Search Icon for Mobile */}
                <button className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400">
                    <Search size={20} />
                </button>

                <Link to="/notifications" className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                </Link>

                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

                <Link to="/civic/profile" className="flex items-center gap-3 pl-1">
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-bold text-slate-900 dark:text-white leading-none">{userName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1">{currentUser?.role || 'Citizen'}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm overflow-hidden ring-2 ring-transparent hover:ring-blue-500/20 transition-all">
                        <img src={currentUser?.profilePic || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${userName}&background=0284c7&color=fff`} className="w-full h-full object-cover" alt="User" />
                    </div>
                </Link>
            </div>

        </header>
    );
};

export default Topbar;
