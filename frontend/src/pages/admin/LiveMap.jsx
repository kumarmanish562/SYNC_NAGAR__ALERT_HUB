import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../mapsConfig';
import { useAuth } from '../../context/AuthContext';
import { getDatabase, ref, onValue } from 'firebase/database';
import { MapPin, Shield, AlertTriangle, Clock } from 'lucide-react';

const libraries = ['places'];

const AdminMap = () => {
    const { currentUser } = useAuth();
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [center, setCenter] = useState({ lat: 22.5726, lng: 88.3639 });

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    useEffect(() => {
        if (!currentUser?.department) return;

        const db = getDatabase();
        const deptReportsRef = ref(db, `reports/by_department/${currentUser.department}`);

        const unsubscribe = onValue(deptReportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setIncidents(list);

                // Set center to first incident if exists
                if (list.length > 0 && list[0].location) {
                    setCenter({ lat: list[0].location.lat, lng: list[0].location.lng });
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser?.department]);

    if (!isLoaded) return <div className="h-full w-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 animate-pulse rounded-3xl" />;

    return (
        <AdminLayout>
            <div className="h-[calc(100vh-150px)] flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Department Live Monitor</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Geospatial view of all reports assigned to your department.
                    </p>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
                    <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={center}
                        zoom={13}
                        options={{
                            styles: [
                                {
                                    "featureType": "all",
                                    "elementType": "geometry.fill",
                                    "stylers": [{ "weight": "2.00" }]
                                },
                                // Add custom dark mode styles if needed or use default
                            ],
                            disableDefaultUI: false,
                            zoomControl: true,
                        }}
                    >
                        {incidents.map((incident) => (
                            incident.location &&
                            typeof incident.location.lat === 'number' && !isNaN(incident.location.lat) &&
                            typeof incident.location.lng === 'number' && !isNaN(incident.location.lng) && (
                                <Marker
                                    key={incident.id}
                                    position={{ lat: incident.location.lat, lng: incident.location.lng }}
                                    onClick={() => setSelectedIncident(incident)}
                                    icon={{
                                        url: incident.status === 'Resolved' ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                                    }}
                                />
                            )))}

                        {selectedIncident && (
                            <InfoWindow
                                position={{ lat: selectedIncident.location?.lat, lng: selectedIncident.location?.lng }}
                                onCloseClick={() => setSelectedIncident(null)}
                            >
                                <div className="p-2 min-w-[250px] max-w-[300px]">
                                    <div className="flex gap-3 mb-3">
                                        <img
                                            src={selectedIncident.imageUrl || 'https://placehold.co/100'}
                                            className="w-16 h-16 rounded-lg object-cover border border-slate-100"
                                            alt="Incident"
                                        />
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">{selectedIncident.userName}</h4>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${selectedIncident.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {selectedIncident.priority}
                                            </span>
                                            <p className="text-[10px] text-slate-500 mt-1">{selectedIncident.type}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 italic mb-2 line-clamp-2">"{selectedIncident.description}"</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                            <Clock size={10} />
                                            {new Date(selectedIncident.createdAt).toLocaleDateString()}
                                        </div>
                                        <Link to={`/admin/incident/${selectedIncident.id}`} className="text-[10px] font-bold text-blue-600 hover:underline">Full Details</Link>
                                    </div>
                                </div>
                            </InfoWindow>
                        )}
                    </GoogleMap>

                    {/* Legend */}
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 z-10">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Legend</h5>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pending</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resolved</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminMap;
