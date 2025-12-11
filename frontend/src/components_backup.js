// MapPicker Component
function MapPicker({ onSelect }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (mapRef.current && !mapInstance.current && window.L) {
            mapInstance.current = window.L.map(mapRef.current).setView([20, 78], 4); // Default India view
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance.current);

            mapInstance.current.on('click', (e) => {
                const { lat, lng } = e.latlng;
                if (markerRef.current) markerRef.current.remove();
                markerRef.current = window.L.marker([lat, lng]).addTo(mapInstance.current);
                onSelect({ lat, lng });
            });

            // Try to get current location
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    mapInstance.current.setView([latitude, longitude], 13);
                },
                () => { },
                { timeout: 5000 }
            );
        }

        // Cleanup
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [onSelect]);

    return <div ref={mapRef} style={{ height: '300px', width: '100%', borderRadius: '12px', marginTop: '16px' }} />;
}

// Booking Modal Component
function BookingModal({ isOpen, onClose, onSubmit, office, user }) {
    if (!isOpen) return null;
    const [form, setForm] = useState({
        customerName: user?.name || '',
        customerEmail: '', // Explicitly empty as requested
        customerContact: '',
        serviceType: '',
        userLat: null,
        userLng: null
    });
    const [locationStatus, setLocationStatus] = useState('');

    const handleSubmit = () => {
        onSubmit(form);
        onClose();
    };

    const detectLocation = () => {
        setLocationStatus('Detecting...');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(prev => ({ ...prev, userLat: pos.coords.latitude, userLng: pos.coords.longitude }));
                setLocationStatus('detected');
            },
            () => setLocationStatus('failed'),
            { timeout: 5000 }
        );
    };

    return (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div className="modal-content" style={{ background: '#fff', padding: '24px', borderRadius: '24px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '20px' }}>Book Appointment</h3>

                <div className="field-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
                    <label className="field">
                        <span>Name</span>
                        <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <label className="field">
                            <span>Email</span>
                            <input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} required />
                        </label>
                        <label className="field">
                            <span>Phone (Optional)</span>
                            <input type="tel" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} />
                        </label>
                    </div>
                    <label className="field">
                        <span>Service Type</span>
                        <select value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--gray-300)', background: '#fff' }}>
                            <option value="">Select Service...</option>
                            <option value="General Inquiry">General Inquiry</option>
                            <option value="Billing">Billing</option>
                            <option value="Technical Support">Technical Support</option>
                            <option value="New Connection">New Connection</option>
                        </select>
                    </label>

                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '500', fontSize: '14px' }}>Location for ETA</span>
                            <button type="button" className="ghost" onClick={detectLocation} style={{ fontSize: '12px', padding: '4px 8px' }}>
                                📍 Detect Current
                            </button>
                        </div>
                        {locationStatus === 'detected' && <div style={{ fontSize: '12px', color: 'green', marginBottom: '8px' }}>✓ Location acquired</div>}
                        {locationStatus === 'failed' && <div style={{ fontSize: '12px', color: 'red', marginBottom: '8px' }}>⚠ Detection failed, please pick on map</div>}

                        <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>Or select on map:</div>
                        <MapPicker onSelect={({ lat, lng }) => {
                            setForm(f => ({ ...f, userLat: lat, userLng: lng }));
                            setLocationStatus('detected');
                        }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button className="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={!form.customerName || !form.serviceType || (!form.userLat && !form.userLng)} style={{ flex: 1 }}>
                        Confirm Booking
                    </button>
                </div>
            </div>
        </div>
    );
}
