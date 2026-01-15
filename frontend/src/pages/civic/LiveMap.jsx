import React, { useState, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { getDatabase, ref, onValue } from "firebase/database";
import { auth } from '../../services/firebase';
import { GoogleMap, useJsApiLoader, Marker, OverlayView } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../mapsConfig';

const containerStyle = {
    width: '100%',
    height: '100%'
};

const LiveMap = () => {
    const [libraries] = useState(['places']);
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    const [mapCenter, setMapCenter] = useState(null); // Start with NULL to enforce real-time location
    const [selectedPin, setSelectedPin] = useState(null);
    const [pins, setPins] = useState([]);
    const navigate = useNavigate();

    // Get Real-Time User Location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setMapCenter({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.log("Location access denied or unavailable. Defaulting to India View.");
                    // Fallback to Center of India (Nagpur) only if permission denied
                    setMapCenter({ lat: 21.1458, lng: 79.0882 });
                }
            );
        } else {
            // Fallback if browser doesn't support Geolocation
            setMapCenter({ lat: 21.1458, lng: 79.0882 });
        }
    }, []);

    useEffect(() => {
        const db = getDatabase(auth.app);
        const reportsRef = ref(db, 'reports');

        onValue(reportsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const loadedPins = Object.keys(data)
                    .map(key => ({
                        id: key,
                        ...data[key]
                    }))
                    // Filter out reports that don't have valid coordinates
                    .filter(pin => pin.location && pin.location.lat && pin.location.lng);

                setPins(loadedPins);
            }
        });
    }, []);

    return (
        <CivicLayout noPadding>
            <div className="relative h-full w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                {/* Google Map - Only render when we have a Location (mapCenter) */}
                {isLoaded && mapCenter ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={mapCenter}
                        zoom={15} // Close zoom for precision
                        options={{
                            disableDefaultUI: true,
                            zoomControl: true,
                        }}
                    >
                        {/* Current User Location Marker (Blue Dot) */}
                        <Marker
                            position={mapCenter}
                            icon={{
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillOpacity: 1,
                                strokeWeight: 2,
                                fillColor: '#4285F4',
                                strokeColor: '#ffffff',
                            }}
                            title="You are here"
                        />

                        {/* Incident Markers */}
                        {pins.map(pin => {
                            const isCritical = ['Fire & Safety', 'Medical/Ambulance', 'Police'].includes(pin.department) || pin.priority === 'Critical';

                            if (isCritical) {
                                return (
                                    <OverlayView
                                        key={pin.id}
                                        position={{ lat: parseFloat(pin.location.lat), lng: parseFloat(pin.location.lng) }}
                                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                    >
                                        <div
                                            className="relative flex items-center justify-center w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                                            onClick={() => setSelectedPin(pin)}
                                        >
                                            {/* Blinking Ring - Prediction 3: Emergency Escalation UI */}
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75 animate-ping"></span>
                                            <span className="absolute inline-flex h-8 w-8 rounded-full bg-red-500 opacity-50"></span>

                                            {/* Core Icon */}
                                            <div className="relative w-8 h-8 bg-red-600 rounded-full shadow-lg flex items-center justify-center border-2 border-white z-10 text-white font-bold text-xs">
                                                SOS
                                            </div>
                                        </div>
                                    </OverlayView>
                                );
                            }

                            return (
                                <Marker
                                    key={pin.id}
                                    position={{
                                        lat: parseFloat(pin.location.lat),
                                        lng: parseFloat(pin.location.lng)
                                    }}
                                    onClick={() => setSelectedPin(pin)}
                                    icon={pin.status === 'Resolved'
                                        ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                                        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png"}
                                />
                            );
                        })}
                    </GoogleMap>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-200 dark:bg-slate-900 text-slate-500">
                        <MapPin className="animate-bounce mb-2 text-blue-500" size={32} />
                        <span className="font-bold animate-pulse">Locating you...</span>
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