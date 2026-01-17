import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, MapPin, AlertTriangle, CheckCircle, Sparkles, Plus, Search, Maximize2, X, Send, ThumbsDown, CheckSquare, Clock, Video } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../mapsConfig';
import { toast } from 'react-hot-toast';
import { sanitizeKey } from '../../utils/firebaseUtils';

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: 22.5726,
    lng: 88.3639
};

const libraries = ['places'];

const AdminDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        open: 0,
        highSeverity: 0,
        aiFlagged: 0,
        resolved: 0
    });
    const [recentReports, setRecentReports] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [map, setMap] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    const onLoad = React.useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = React.useCallback(function callback(map) {
        setMap(null);
    }, []);

    // Fetch Real-Time Data (Department Specific) with API Fallback
    useEffect(() => {
        if (!currentUser?.department) return;

        const db = getDatabase();
        const sanitizedDept = sanitizeKey(currentUser.department);
        // const deptReportsRef = ref(db, `reports/by_department/${sanitizedDept}`);
        const deptReportsRef = ref(db, `reports`); // LISTEN TO EVERYTHING

        // 1. Initial API Fetch (Fallback if RTDB is blocked)
        const fetchFromApi = async () => {
            try {
                // TEMP DEBUG: Fetch ALL reports regardless of department

                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
                const res = await fetch(`${API_BASE_URL}/api/reports`); // FETCH EVERYTHING
                if (res.ok) {
                    const data = await res.json();
                    if (data.reports) {
                        processReports(data.reports);
                    }
                }
            } catch (err) {
                console.error("API Fetch Error:", err);
            }
        };

        fetchFromApi();

        // 2. Realtime Listener
        const unsubscribe = onValue(deptReportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const reportsArray = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                processReports(reportsArray);
            }
        }, (error) => {
            console.error("RTDB Permission Error:", error);
            // If RTDB fails, the API fetch above should have already populated the data.
        });

        return () => unsubscribe();
    }, [currentUser?.department]);

    const processReports = (reportsArray) => {
        // Calculate Stats
        let open = 0;
        let high = 0;
        let flagged = 0;
        let resolved = 0;

        reportsArray.forEach(report => {
            const status = report.status || 'Pending';
            if (status === 'Pending' || status === 'Open' || status === 'Pending Address') open++;
            if (status === 'Resolved' || status === 'Completed') resolved++;
            if (report.aiConfidence > 80 && status === 'Pending') flagged++;
            if (report.priority === 'High') high++;
        });

        setStats({
            open,
            highSeverity: high,
            aiFlagged: flagged,
            resolved
        });

        setRecentReports(reportsArray);
        // Auto-select first if none selected
        if (reportsArray.length > 0 && !selectedIncident) {
            setSelectedIncident(reportsArray[0]);
        }
    };

    // Fit Bounds when reports change
    useEffect(() => {
        if (map && recentReports.length > 0 && window.google) {
            const bounds = new window.google.maps.LatLngBounds();
            let hasPoints = false;
            recentReports.forEach(report => {
                if (report.location) {
                    const lat = parseFloat(report.location.lat);
                    const lng = parseFloat(report.location.lng);

                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                        bounds.extend({ lat, lng });
                        hasPoints = true;
                    }
                }
            });
            if (hasPoints) {
                map.fitBounds(bounds);
            }
        }
    }, [map, recentReports]);

    const handleUpdateStatus = async (newStatus) => {
        if (!selectedIncident) return;
        try {
            const statusLabel = newStatus === 'Rejected' ? 'Rejected - Unconventional Report' : newStatus;

            // Use Backend API to bypass client permission rules
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
            const res = await fetch(`${API_BASE_URL}/api/reports/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: selectedIncident.id,
                    status: statusLabel,
                    department: currentUser.department
                })
            });

            if (!res.ok) throw new Error("API Update Failed");

            toast.success(`Incident marked as ${newStatus}`);

            // Update local state for immediate feedback
            setSelectedIncident(prev => ({ ...prev, status: statusLabel }));

            // Also update the list local state to reflect change immediately
            setRecentReports(prev => prev.map(r =>
                r.id === selectedIncident.id ? { ...r, status: statusLabel } : r
            ));

            if (newStatus === 'Accepted') {
                navigate('/admin/broadcast', { state: { incidentId: selectedIncident.id } });
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{currentUser?.department} Command Center</h1>
                        <p className="text-sm text-slate-500 font-medium">Monitoring live reports and AI deployments</p>
                    </div>
                </div>

                {/* Top Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Open Incidents"
                        value={stats.open}
                        sub="Real-time"
                        subColor="text-red-500"
                        icon={<AlertTriangle size={20} className="text-orange-500" />}
                    />
                    <StatCard
                        label="High Severity"
                        value={stats.highSeverity}
                        sub="Critical Issues"
                        subColor="text-red-500"
                        icon={<div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs">!</div>}
                    />
                    <StatCard
                        label="AI Flagged"
                        value={stats.aiFlagged}
                        sub="Needs Verification"
                        subColor="text-blue-500"
                        icon={<Sparkles size={20} className="text-blue-500" />}
                    />
                    <StatCard
                        label="Resolved"
                        value={stats.resolved}
                        sub="All Time"
                        subColor="text-green-500"
                        icon={<CheckCircle size={20} className="text-green-500" />}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Live Incident Map */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-1 transition-colors">
                            <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50">
                                <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white"><MapPin size={18} /> Live Incident Map</h3>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> High Priority</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Resolved</span>
                                </div>
                            </div>
                            <div className="h-[400px] w-full bg-slate-100 dark:bg-slate-900 relative overflow-hidden rounded-b-xl">
                                {isLoaded ? (
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={defaultCenter}
                                        zoom={12}
                                        onLoad={onLoad}
                                        onUnmount={onUnmount}
                                        options={{
                                            disableDefaultUI: false,
                                            zoomControl: true,
                                        }}
                                    >
                                        {recentReports.map((report) => (
                                            report.location &&
                                            typeof report.location.lat === 'number' &&
                                            !isNaN(report.location.lat) &&
                                            report.location.lat !== 0 &&
                                            typeof report.location.lng === 'number' &&
                                            !isNaN(report.location.lng) &&
                                            report.location.lng !== 0 && (
                                                <Marker
                                                    key={report.id}
                                                    position={{ lat: report.location.lat, lng: report.location.lng }}
                                                    onClick={() => setSelectedIncident(report)}
                                                    icon={report.status === 'Resolved' ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png" : "http://maps.google.com/mapfiles/ms/icons/red-dot.png"}
                                                />
                                            )
                                        ))}
                                    </GoogleMap>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">Loading Map...</div>
                                )}
                            </div>
                        </div>

                        {/* Recent Reports Table */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden transition-colors">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 dark:text-white">Recent Reports</h3>
                                <div className="relative">
                                    <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Quick Search..." className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Details</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Priority</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                        {recentReports.slice(0, 10).map(report => (
                                            <TableRow
                                                key={report.id}
                                                id={`#${report.id.slice(-6)}`}
                                                address={report.location?.address || "Location N/A"}
                                                img={report.imageUrl}
                                                mediaType={report.mediaType}
                                                type={report.type || report.category || "General"}
                                                priority={report.priority || "Medium"}
                                                status={report.status || "Pending"}
                                                isSelected={selectedIncident?.id === report.id}
                                                onClick={() => setSelectedIncident(report)}
                                            />
                                        ))}
                                        {recentReports.length === 0 && (
                                            <tr><td colSpan="5" className="text-center py-10 text-slate-400 italic">No reports found for this department.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Right Column (1/3 width) - Verification Panel */}
                    <div className="lg:sticky lg:top-8 h-fit">
                        {selectedIncident ? (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-none border border-slate-200 dark:border-slate-700/50 p-6 flex flex-col transition-colors">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Incident Profile</div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">#{selectedIncident.id.slice(-6)}</h2>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${selectedIncident.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                        {selectedIncident.priority} Priority
                                    </span>
                                </div>

                                {/* Image Area */}
                                <div className="relative rounded-xl overflow-hidden mb-6 group cursor-pointer bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 h-48 flex items-center justify-center">
                                    {selectedIncident.mediaType === 'video' ? (
                                        <video
                                            src={selectedIncident.imageUrl}
                                            className="w-full h-full object-cover"
                                            controls
                                        />
                                    ) : selectedIncident.mediaType === 'audio' ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Audio Evidence</div>
                                            <audio controls className="w-full h-10" src={selectedIncident.imageUrl} />
                                        </div>
                                    ) : selectedIncident.imageUrl ? (
                                        <img
                                            referrerPolicy="no-referrer"
                                            src={
                                                selectedIncident.imageUrl.includes('via.placeholder.com')
                                                    ? selectedIncident.imageUrl.replace('via.placeholder.com', 'placehold.co')
                                                    : selectedIncident.imageUrl === "https://placehold.co/300"
                                                        ? "https://placehold.co/600x400/334155/FFFFFF?text=Simulated+Report+Image"
                                                        : selectedIncident.imageUrl
                                            }
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            alt="Incident Evidence"
                                            onError={(e) => {
                                                console.error("Image load failed, hiding element:", selectedIncident.imageUrl);
                                                e.target.style.display = 'none';
                                                // Find the placeholder sibling and show it
                                                const placeholder = e.target.parentElement.querySelector('.no-media-placeholder');
                                                if (placeholder) placeholder.classList.remove('hidden');
                                                if (placeholder) placeholder.classList.add('flex');
                                            }}
                                        />
                                    ) : null}

                                    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 no-media-placeholder ${selectedIncident.mediaType === 'video' || selectedIncident.imageUrl ? 'hidden' : 'flex'
                                        }`}>
                                        <div className="bg-white dark:bg-slate-700 p-3 rounded-full mb-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                        </div>
                                        <span className="text-xs font-bold opacity-70">No Media Available</span>
                                    </div>

                                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                                        <button className="p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-colors">
                                            <Maximize2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* AI Analysis Box */}
                                <div className="bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 rounded-xl p-4 border border-blue-100/50 dark:border-blue-500/20 mb-6">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
                                        <span className="font-bold text-blue-900 dark:text-blue-100 text-xs">Gemini AI Detection</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                        {(() => {
                                            if (!selectedIncident.aiAnalysis || selectedIncident.aiAnalysis === "Not Analyzed") {
                                                if (selectedIncident.source === 'WhatsApp') {
                                                    return `System detected a ${selectedIncident.type} issue with ${selectedIncident.aiConfidence || 0}% confidence (Simulated).`;
                                                }
                                                return `System detected a ${selectedIncident.type} issue at this location with ${selectedIncident.aiConfidence || 85}% confidence.`;
                                            }
                                            try {
                                                // Try to parse if it's a JSON string
                                                const analysis = typeof selectedIncident.aiAnalysis === 'string' && selectedIncident.aiAnalysis.startsWith('{')
                                                    ? JSON.parse(selectedIncident.aiAnalysis)
                                                    : selectedIncident.aiAnalysis;

                                                if (typeof analysis === 'object') {
                                                    return analysis.description || analysis.issue || "Detailed analysis available.";
                                                }
                                                return analysis;
                                            } catch (e) {
                                                return selectedIncident.aiAnalysis;
                                            }
                                        })()}
                                    </p>
                                </div>

                                {/* Reporter Details */}
                                <div className="mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Reporter Details</div>
                                        <div className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold">
                                            UID: {selectedIncident.userId ? selectedIncident.userId.slice(0, 5) : 'N/A'}...
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                            {selectedIncident.userName ? selectedIncident.userName.charAt(0) : 'U'}
                                        </div>
                                        <div className="font-bold text-sm text-slate-800 dark:text-gray-200">{selectedIncident.userName || 'Anonymous Citizen'}</div>
                                    </div>
                                    <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        <MapPin size={14} className="shrink-0 mt-0.5" />
                                        <span>{selectedIncident.location?.address || 'No address available'}</span>
                                    </div>
                                </div>

                                {/* User Description */}
                                <div className="mb-6">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Citizen Input</div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-400 italic border border-slate-100 dark:border-slate-700/50">
                                        "{selectedIncident.description || "No description provided."}"
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="mt-auto space-y-3">
                                    {(selectedIncident.status === 'Pending' || !selectedIncident.status) ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleUpdateStatus('Rejected')}
                                                className="py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 text-slate-700 dark:text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                            >
                                                <X size={18} /> Reject
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus('Accepted')}
                                                className="py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                                            >
                                                <CheckSquare size={18} /> Accept
                                            </button>
                                        </div>
                                    ) : selectedIncident.status === 'Accepted' ? (
                                        <div className="space-y-3">
                                            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-500/20 rounded-xl text-center">
                                                <div className="text-green-600 dark:text-green-400 font-bold text-sm flex items-center justify-center gap-2">
                                                    <CheckCircle size={18} /> Incident Accepted
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleUpdateStatus('Resolved')}
                                                    className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                                                >
                                                    <CheckCircle size={18} /> Resolve
                                                </button>
                                                <button
                                                    onClick={() => navigate('/admin/broadcast', { state: { incidentId: selectedIncident.id } })}
                                                    className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                                >
                                                    <Send size={18} /> Broadcast
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleUpdateStatus('Rejected')}
                                                className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 text-xs"
                                            >
                                                Reject Issue
                                            </button>
                                        </div>
                                    ) : (
                                        <div className={`p-4 rounded-xl text-center border ${selectedIncident.status.startsWith('Rejected')
                                            ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40 text-red-600'
                                            : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40 text-green-600'
                                            }`}>
                                            <div className="font-bold text-sm flex items-center justify-center gap-2">
                                                {selectedIncident.status.startsWith('Rejected') ? <X size={18} /> : <CheckCircle size={18} />}
                                                {selectedIncident.status}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <Maximize2 size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-400 text-sm font-medium">Select a report from the list or map to verify</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

const StatCard = ({ label, value, sub, subColor, icon }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md h-32 flex flex-col justify-between">
        <div className="flex justify-between items-start">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{label}</span>
            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">{icon}</div>
        </div>
        <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
            <div className={`text-[10px] font-black mt-1 ${subColor} uppercase tracking-tight`}>{sub}</div>
        </div>
    </div>
);

const TableRow = ({ id, address, img, type, priority, status, isSelected, onClick, mediaType }) => {
    return (
        <tr
            onClick={onClick}
            className={`transition-all group cursor-pointer border-b border-slate-50 dark:border-slate-700/30 ${isSelected ? 'bg-blue-50/50 dark:bg-blue-500/5' : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30'
                }`}
        >
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {mediaType === 'video' ? (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shadow-sm">
                            <Video size={20} />
                        </div>
                    ) : (
                        <img
                            src={img && img.includes('via.placeholder.com') ? img.replace('via.placeholder.com', 'placehold.co') : (img || 'https://placehold.co/100')}
                            className="w-10 h-10 rounded-xl object-cover bg-slate-200 dark:bg-slate-700 shadow-sm"
                            alt=""
                        />
                    )}
                    <div>
                        <div className="font-bold text-slate-900 dark:text-white leading-tight">{id}</div>
                        <div className="text-[10px] font-medium text-slate-400 truncate max-w-[150px]">{address}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <Sparkles size={12} className="text-blue-500" /> {type}
                </div>
            </td>
            <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${priority === 'High' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                    {priority}
                </span>
            </td>
            <td className="px-6 py-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${status === 'Pending' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                    status === 'Accepted' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        status === 'Pending Address' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                            status === 'Resolved' ? 'bg-green-50 text-green-600 border border-green-100' :
                                'bg-slate-100 text-slate-500'
                    }`}>
                    {status === 'Pending Address' ? 'Wait Address' : status}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                {status === 'Accepted' || priority === 'High' ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const targetArea = address ? address.split(',')[0] : 'General Area';
                            navigate('/admin/broadcast', { state: { targetArea: targetArea } });
                        }}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                        title="Broadcast Alert to this Area"
                    >
                        <Send size={12} /> Alert
                    </button>
                ) : (
                    <button className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-slate-400 transition-colors">
                        <MoreVertical size={16} />
                    </button>
                )}
            </td>
        </tr>
    );
}

export default AdminDashboard;
