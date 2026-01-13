import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Map, FileText, BarChart2, User, Shield,
    AlertTriangle, Camera, TrendingUp, MessageCircle, Bell, LogOut
} from 'lucide-react';

const Sidebar = ({ isOpen }) => {
    const location = useLocation();

    // Helper to check partial match for highlighting parent items if needed, or exact match
    const isActive = (path) => location.pathname === path;

    return (
        <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-64' : 'w-20'}`}>
            <div className="h-16 flex items-center justify-center border-b border-slate-100 dark:border-slate-800/50">
                <Link to="/civic/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0">
                        <Shield size={18} />
                    </div>
                    {isOpen && (
                        <div>
                            <h1 className="text-lg font-bold leading-none text-slate-900 dark:text-white">नगर Alert Hub</h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Citizen Console</p>
                        </div>
                    )}
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                {/* Main Navigation */}
                {isOpen && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2 px-3">Menu</div>}

                <SidebarItem
                    icon={<LayoutDashboard size={20} />}
                    label="Overview"
                    to="/civic/dashboard"
                    active={isActive('/civic/dashboard')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<Map size={20} />}
                    label="Live Map"
                    to="/civic/map"
                    active={isActive('/civic/map')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<Camera size={20} />}
                    label="New Report"
                    to="/report"
                    active={isActive('/report')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<FileText size={20} />}
                    label="My Reports"
                    to="/civic/my-reports"
                    active={isActive('/civic/my-reports')}
                    expanded={isOpen}
                />

                {/* Community & Stats */}
                {isOpen && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 px-3">Community</div>}

                <SidebarItem
                    icon={<BarChart2 size={20} />}
                    label="Leaderboard"
                    to="/leaderboard"
                    active={isActive('/leaderboard')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<TrendingUp size={20} />}
                    label="City Stats"
                    to="/civic/stats"
                    active={isActive('/civic/stats')}
                    expanded={isOpen}
                />

                {/* Tools */}
                {isOpen && <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 px-3">Tools</div>}

                <SidebarItem
                    icon={<User size={20} />}
                    label="Profile"
                    to="/civic/profile"
                    active={isActive('/civic/profile')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<Bell size={20} />}
                    label="Notifications"
                    to="/notifications"
                    active={isActive('/notifications')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<MessageCircle size={20} />}
                    label="WhatsApp Guide"
                    to="/civic/guide"
                    active={isActive('/civic/guide')}
                    expanded={isOpen}
                />
                <SidebarItem
                    icon={<AlertTriangle size={20} />}
                    label="Emergency SOS"
                    to="/sos"
                    active={isActive('/sos')}
                    expanded={isOpen}
                />

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50">
                    <SidebarItem
                        icon={<LogOut size={20} />}
                        label="Logout"
                        to="/login"
                        active={false}
                        expanded={isOpen}
                        danger={true}
                    />
                </div>

            </div>
        </aside>
    );
};

const SidebarItem = ({ icon, label, to, active, expanded, danger = false }) => (
    <Link
        to={to}
        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative
            ${active
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                : danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
            }
            ${!expanded && 'justify-center'}
        `}
    >
        <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </div>

        {expanded ? (
            <span className="text-sm truncate">{label}</span>
        ) : (
            // Tooltip for collapsed state
            <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {label}
            </div>
        )}
    </Link>
);

export default Sidebar;
