import React, { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from '../../services/firebase';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../mapsConfig';

const containerStyle = {
    width: '100%',
    height: '100%'
};

// Default center (Bhilai/Ranchi approximate)
const center = {
    lat: 21.2514,
    lng: 81.6296
};

const LiveMap = () => {
    const [libraries] = useState(['places']);
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    const [selectedPin, setSelectedPin] = useState(null);
    const [pins, setPins] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const db = getDatabase(auth.app);
        const reportsRef = ref(db, 'reports');

        onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const loadedPins = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    // Use real locations if available, else random fallback near center
                    lat: data[key].location?.lat || (21.2514 + (Math.random() - 0.5) * 0.05),
                    lng: data[key].location?.lng || (81.6296 + (Math.random() - 0.5) * 0.05),
                }));
                setPins(loadedPins);
            }
        });
    }, []);

    return (
        <CivicLayout noPadding>
            <div className="relative h-full w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                {/* Google Map */}
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={12}
                        options={{
                            disableDefaultUI: true, // Clean look
                            zoomControl: true,
                        }}
                    >
                        {/* Markers */}
                        {pins.map(pin => (
                            <Marker
                                key={pin.id}
                                position={{
                                    lat: pin.location?.lat || (pin.lat), // Handle both data structures safely
                                    lng: pin.location?.lng || (pin.lng)
                                }}
                                onClick={() => setSelectedPin(pin)}
                            />
                        ))}
                    </GoogleMap>
                ) : (
                    <div className="flex items-center justify-center h-full w-full bg-slate-200">
                        Loading Map...
                    </div>
                )}

                {/* Map Controls Overlay */}
                <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none z-10">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur p-4 rounded-2xl shadow-sm pointer-events-auto border border-white/20">
                        <h2 className="font-bold text-slate-900 dark:text-white">Active Reports</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{pins.length} Issues Live</p>
                    </div>
                </div>

                {/* Bottom Sheet Detail */}
                {selectedPin && (
                    <div className="absolute bottom-6 left-6 right-6 bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-2xl z-20 animate-in slide-in-from-bottom flex gap-4 items-center border border-slate-100 dark:border-slate-800">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl">
                            {selectedPin.type === 'pothole' ? '🚧' : selectedPin.type === 'garbage' ? '🗑️' : '🚩'}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white capitalize">{selectedPin.type}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Status: {selectedPin.status}</p>
                        </div>
                        <button onClick={() => navigate(`/civic/report`)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">Route</button>
                        <button onClick={() => setSelectedPin(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={16} /></button>
                    </div>
                )}
            </div>
        </CivicLayout>
    );
};

export default LiveMap;