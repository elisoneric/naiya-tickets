import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

interface WebmailResetFormProps {
    onSubmit: (payload: { username: string; domain: string }) => void;
}

export const WebmailResetForm: React.FC<WebmailResetFormProps> = ({ onSubmit }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({ username: '', domain: '@naiyatechnology.org' });

    const handleFormSubmit = () => {
        if (!formData.username) {
            showToast('Please provide your current username', 'error');
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 mb-4 mt-2 shadow-sm animate-fade-in-up w-full max-w-[85%] self-start">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm border-b dark:border-dark-border pb-2">Webmail Password Reset Request</h4>
            <div className="space-y-3">
                <input 
                    type="text" 
                    placeholder="Username (e.g. first.last)" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200" 
                />
                <select 
                    value={formData.domain} 
                    onChange={e => setFormData({...formData, domain: e.target.value})}
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200"
                >
                    <option value="@naiyatechnology.org">@naiyatechnology.org</option>
                    <option value="@naiyatech.com.ng">@naiyatech.com.ng</option>
                    <option value="@samuikyglobal.com.ng">@samuikyglobal.com.ng</option>
                </select>
                <button 
                    onClick={handleFormSubmit} 
                    className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors text-sm shadow-sm"
                >
                    Submit Reset Request
                </button>
            </div>
        </div>
    );
};
