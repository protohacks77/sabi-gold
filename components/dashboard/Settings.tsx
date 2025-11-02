import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Settings as SettingsType } from '../../types';
import Spinner from '../common/Spinner';

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<SettingsType>({
        shiftStart: '07:30',
        shiftEnd: '18:00',
        dailyRate: 10,
        overtimeRate: 10,
        annualLeaveDays: 21,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            const settingsRef = doc(db, 'app-settings', 'main');
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as SettingsType);
            }
            setIsLoading(false);
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setStatusMessage('');
        try {
            const settingsRef = doc(db, 'app-settings', 'main');
            await setDoc(settingsRef, settings, { merge: true });
            setStatusMessage('Settings saved successfully!');
        } catch (error) {
            setStatusMessage('Error saving settings.');
            console.error("Error saving settings: ", error);
        }
        setIsSaving(false);
        setTimeout(() => setStatusMessage(''), 3000);
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    if (isLoading) {
        return <div className="flex justify-center items-center pt-10"><Spinner /></div>;
    }

    const inputClasses = "w-full p-2 bg-gray-800 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";
    const labelClasses = "block text-sm font-medium text-gray-400 mb-1";

    return (
        <div className="max-w-3xl">
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                <div className="space-y-8">
                    <div>
                        <h2 className="text-xl font-semibold mb-1 text-white">Work Schedule</h2>
                        <p className="text-gray-400 mb-4">Define the standard shift times for calculating overtime.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Shift Start Time</label>
                                <input type="time" name="shiftStart" value={settings.shiftStart} onChange={handleChange} className={inputClasses}/>
                            </div>
                            <div>
                                <label className={labelClasses}>Shift End Time</label>
                                <input type="time" name="shiftEnd" value={settings.shiftEnd} onChange={handleChange} className={inputClasses}/>
                            </div>
                        </div>
                    </div>
                     <div>
                        <h2 className="text-xl font-semibold mb-1 text-white">Payroll Rates</h2>
                         <p className="text-gray-400 mb-4">Set the financial rates for payroll calculation.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClasses}>Standard Daily Pay ($)</label>
                                <input type="number" name="dailyRate" value={settings.dailyRate} onChange={handleChange} className={inputClasses}/>
                            </div>
                            <div>
                                <label className={labelClasses}>Overtime Hourly Rate ($)</label>
                                <input type="number" name="overtimeRate" value={settings.overtimeRate} onChange={handleChange} className={inputClasses}/>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold mb-1 text-white">Leave Policy</h2>
                        <p className="text-gray-400 mb-4">Set the standard annual leave allowance for employees.</p>
                        <div>
                            <label className={labelClasses}>Annual Leave Days</label>
                            <input type="number" name="annualLeaveDays" value={settings.annualLeaveDays || 21} onChange={handleChange} className={inputClasses}/>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                        <button onClick={handleSave} className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition-colors flex items-center justify-center min-w-[140px]" disabled={isSaving}>
                            {isSaving ? <Spinner /> : 'Save Settings'}
                        </button>
                        {statusMessage && <p className={`text-sm ${statusMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{statusMessage}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
