import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MapPin, CheckCircle, AlertTriangle, Trash2, Lightbulb, Droplets, X, Loader2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CivicLayout from './CivicLayout';
import { verifyImageWithAI, submitReportToBackend } from '../../services/backendService';
import { uploadImage } from '../../services/storageService';
import { auth } from '../../services/firebase';
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../mapsConfig';
import { toast } from 'react-hot-toast';

const libraries = ['places'];

const ReportIssue = () => {
    const navigate = useNavigate();
    const [selectedImage, setSelectedImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [category, setCategory] = useState(null);
    const [department, setDepartment] = useState('');
    const [location, setLocation] = useState({ lat: 22.5726, lng: 88.3639, address: 'Fetching location...' });
    const [map, setMap] = useState(null);
    const [searchResult, setSearchResult] = useState(null);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    React.useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setLocation(prev => ({ ...prev, ...pos }));
                    // Attempt fetch, but if script isn't loaded, Effect below will catch it
                    if (window.google?.maps?.Geocoder) {
                        fetchAddress(pos.lat, pos.lng);
                    }
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setLocation({ lat: 23.3441, lng: 85.3096, address: 'Ranchi, Jharkhand (Default)' }); // Ranchi Coordinates
                }
            );
        }
    }, []);

    // Retry address fetch when API loads
    React.useEffect(() => {
        if (isLoaded && location.lat && location.address === 'Fetching location...') {
            fetchAddress(location.lat, location.lng);
        }
    }, [isLoaded, location.lat, location.lng]);

    const fetchAddress = (lat, lng) => {
        if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;

        try {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === "OK" && results[0]) {
                    setLocation(prev => ({ ...prev, lat, lng, address: results[0].formatted_address }));
                } else {
                    console.warn("Geocoder failed:", status);
                    setLocation(prev => ({ ...prev, lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
                }
            });
        } catch (error) {
            console.error("Geocoder error:", error);
        }
    };

    const onMapLoad = React.useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onMarkerDragEnd = (e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        fetchAddress(newLat, newLng);
    };

    const onPlaceChanged = () => {
        if (searchResult !== null) {
            const place = searchResult.getPlace();
            if (place.geometry) {
                const newLat = place.geometry.location.lat();
                const newLng = place.geometry.location.lng();
                setLocation({
                    lat: newLat,
                    lng: newLng,
                    address: place.formatted_address
                });
                map.panTo({ lat: newLat, lng: newLng });
                map.setZoom(17);
            }
        }
    };

    const onLoadAutocomplete = (autocomplete) => {
        setSearchResult(autocomplete);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            // Preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result);
            };
            reader.readAsDataURL(file);

            // AI Verification
            setAnalyzing(true);
            setAiResult(null);

            try {
                const result = await verifyImageWithAI(file);
                if (result) {
                    setAiResult({
                        detected: result.explanation || 'Issue Detected',
                        confidence: result.ai_confidence ? `${Math.round(result.ai_confidence * 100)}%` : 'N/A',
                        severity: result.verified ? 'High' : 'Low', // Simplified logic
                        recommendation: result.verified ? 'Verified by Gemini AI' : 'Low confidence detection',
                        isVerified: result.verified
                    });

                    // Auto-categorize based on explanation (simple keyword match)
                    const explanation = result.explanation.toLowerCase();
                    if (explanation.includes('pothole')) { setCategory('pothole'); setDepartment('Municipal/Waste'); }
                    else if (explanation.includes('garbage') || explanation.includes('trash')) { setCategory('garbage'); setDepartment('Municipal/Waste'); }
                    else if (explanation.includes('light') || explanation.includes('dark')) { setCategory('light'); setDepartment('Electricity Board'); }
                    else if (explanation.includes('water') || explanation.includes('flood')) { setCategory('water'); setDepartment('Water Supply'); }
                    else if (explanation.includes('traffic')) { setDepartment('Traffic'); }
                    else if (explanation.includes('police') || explanation.includes('crime')) { setDepartment('Police'); }
                    else if (explanation.includes('fire')) { setDepartment('Fire & Safety'); }
                    else if (explanation.includes('medical') || explanation.includes('ambulance')) { setDepartment('Medical/Ambulance'); }
                }
            } catch (error) {
                console.error("AI Analysis Failed:", error);
                // Fallback or error state
                setAiResult({
                    detected: 'Analysis Failed',
                    confidence: '0%',
                    severity: 'Unknown',
                    recommendation: 'Could not connect to AI backend.'
                });
            } finally {
                setAnalyzing(false);
            }
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let imageUrl = selectedImage; // Fallback

            if (imageFile) {
                // Upload to Firebase Storage
                imageUrl = await uploadImage(imageFile, 'civic-reports');
            }

            const reportData = {
                type: category || 'General',
                department: department,
                description: e.target.elements.description.value,
                location: { lat: location.lat, lng: location.lng, address: location.address },
                imageUrl: imageUrl,
                aiVerified: aiResult?.isVerified || false,
                aiAnalysis: aiResult?.detected || 'No analysis available',
                aiConfidence: aiResult?.confidence ? parseInt(aiResult.confidence) : 0,
                priority: aiResult?.severity === 'High' ? 'High' : 'Normal',
                status: 'Pending',
                timestamp: Date.now(),
                userId: auth.currentUser?.uid,
                userName: auth.currentUser?.displayName || 'Anonymous'
            };

            await submitReportToBackend(reportData);
            toast.success('Report Submitted Successfully! You earned 10 points.');
            setTimeout(() => navigate('/civic/my-reports'), 1000);
        } catch (error) {
            console.error("Submission failed:", error);
            toast.error('Failed to submit report: ' + error.message);
        }
    };

    return (
        <CivicLayout>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: Form Info */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Report an Incident</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            Help us keep the city clean and safe. Upload a photo, and our AI will automatically categorize the issue for you.
                        </p>

                        {/* Location Preview Card */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                                    <MapPin size={20} className="text-blue-500" /> Detected Location
                                </div>
                            </div>

                            {/* Autocomplete Input */}
                            {isLoaded && (
                                <div className="mb-4">
                                    <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged}>
                                        <input
                                            type="text"
                                            placeholder="Search location manually..."
                                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </Autocomplete>
                                </div>
                            )}

                            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl relative overflow-hidden">
                                {isLoaded ? (
                                    <GoogleMap
                                        mapContainerStyle={{ width: '100%', height: '100%' }}
                                        center={{ lat: location.lat || 22.5726, lng: location.lng || 88.3639 }}
                                        zoom={15}
                                        onLoad={onMapLoad}
                                        options={{
                                            streetViewControl: false,
                                            mapTypeControl: false,
                                            fullscreenControl: false
                                        }}
                                    >
                                        <Marker
                                            position={{ lat: location.lat || 22.5726, lng: location.lng || 88.3639 }}
                                            draggable={true}
                                            onDragEnd={onMarkerDragEnd}
                                        />
                                    </GoogleMap>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="animate-spin text-slate-400" />
                                    </div>
                                )}

                                <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-600 border border-slate-200 shadow-sm truncate">
                                    {location.address}
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 text-center">Drag pin to refine location</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Target Department</label>
                                    <select
                                        required
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-300"
                                    >
                                        <option value="">Select Department</option>
                                        <option value="Police">Police</option>
                                        <option value="Traffic">Traffic</option>
                                        <option value="Fire & Safety">Fire & Safety</option>
                                        <option value="Medical/Ambulance">Medical/Ambulance</option>
                                        <option value="Municipal/Waste">Municipal/Waste</option>
                                        <option value="Electricity Board">Electricity Board</option>
                                        <option value="Water Supply">Water Supply</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Issue Category</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <CategoryCard id="pothole" icon={<AlertTriangle />} label="Pothole" selected={category === 'pothole'} onClick={() => { setCategory('pothole'); setDepartment('Municipal/Waste'); }} />
                                        <CategoryCard id="garbage" icon={<Trash2 />} label="Garbage" selected={category === 'garbage'} onClick={() => { setCategory('garbage'); setDepartment('Municipal/Waste'); }} />
                                        <CategoryCard id="light" icon={<Lightbulb />} label="Light" selected={category === 'light'} onClick={() => { setCategory('light'); setDepartment('Electricity Board'); }} />
                                        <CategoryCard id="water" icon={<Droplets />} label="Water" selected={category === 'water'} onClick={() => { setCategory('water'); setDepartment('Water Supply'); }} />
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Description (Optional)</label>
                                <textarea
                                    name="description"
                                    placeholder="Describe the issue... (e.g., 'Big pothole on Main St')"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32 text-slate-700 dark:text-slate-300"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={!selectedImage || analyzing || !department}
                                className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-300 disabled:cursor-not-allowed text-white dark:text-slate-900 font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                Submit Report <CheckCircle size={20} />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Upload Area */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 h-full flex flex-col">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Upload Evidence</h2>

                        <div className="flex-1 min-h-[400px]">
                            {!selectedImage ? (
                                <div className="relative group h-full">
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                                    <div className="w-full h-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/10 group-hover:border-blue-400 dark:group-hover:border-blue-500/50 transition-all">
                                        <div className="w-20 h-20 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                                            <Upload size={32} />
                                        </div>
                                        <p className="font-bold text-lg text-slate-700 dark:text-slate-300">Drag & Drop or Click to Upload</p>
                                        <p className="text-slate-400 mt-2">Supports JPG, PNG (Max 5MB)</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md group">
                                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedImage(null); setAiResult(null); }}
                                            className="bg-white/20 hover:bg-white/40 backdrop-blur rounded-full p-4 text-white transition"
                                        >
                                            <X size={32} />
                                        </button>
                                    </div>

                                    {/* AI Result Card Overlay */}
                                    <AnimatePresence>
                                        {(analyzing || aiResult) && (
                                            <motion.div
                                                initial={{ y: 100, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="absolute bottom-6 inset-x-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800"
                                            >
                                                {analyzing ? (
                                                    <div className="flex items-center gap-4">
                                                        <Loader2 size={24} className="animate-spin text-blue-600" />
                                                        <div>
                                                            <div className="font-bold text-slate-900 dark:text-white">Gemini AI Analysis</div>
                                                            <div className="text-xs text-slate-500">Scanning image for hazards...</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${aiResult.detected === 'Analysis Failed' ? 'bg-red-100 text-red-500' : 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'}`}>
                                                            {aiResult.detected === 'Analysis Failed' ? <AlertTriangle size={24} /> : <Lightbulb size={24} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h4 className="font-bold text-slate-900 dark:text-white border-l-4 border-purple-500 pl-3">{aiResult.detected}</h4>
                                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${aiResult.detected === 'Analysis Failed' ? 'bg-red-100 text-red-600' : 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>{aiResult.severity}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{aiResult.recommendation}</p>

                                                            {aiResult.detected === 'Analysis Failed' ? (
                                                                <button
                                                                    onClick={() => handleImageUpload({ target: { files: [imageFile] } })}
                                                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                                                                >
                                                                    Retry Analysis
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                                        <div className="bg-purple-500 h-full w-[98%]"></div>
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 text-right mt-1">AI Confidence: {aiResult.confidence}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </CivicLayout>
    );
};

const CategoryCard = ({ id, icon, label, selected, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-200 h-28 ${selected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-md transform scale-105' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600'}`}
    >
        <div className={`mb-2 ${selected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
            {React.cloneElement(icon, { size: 28 })}
        </div>
        <span className="text-sm font-bold">{label}</span>
    </button>
);

export default ReportIssue;
