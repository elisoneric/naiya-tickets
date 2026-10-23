import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

interface MetadataVerificationFormProps {
    onSubmit: (payload: { name: string; nin: string; email: string; phone: string }) => void;
}

export const MetadataVerificationForm: React.FC<MetadataVerificationFormProps> = ({ onSubmit }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({ name: '', nin: '', email: '', phone: '' });

    const handleFormSubmit = () => {
        if (!formData.name || !formData.nin || !formData.email || !formData.phone) {
            showToast('Please fill out all fields', 'error');
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 mb-4 mt-2 shadow-sm animate-fade-in-up w-full max-w-[85%] self-start">
            <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm border-b dark:border-dark-border pb-2">Status Confirmation Form</h4>
            <div className="space-y-3">
                <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200" 
                />
                <input 
                    type="text" 
                    placeholder="NIN" 
                    value={formData.nin} 
                    onChange={e => setFormData({...formData, nin: e.target.value})} 
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200" 
                />
                <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200" 
                />
                <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-dark-border focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-gray-800 dark:text-gray-200" 
                />
                <button 
                    onClick={handleFormSubmit} 
                    className="w-full py-2.5 mt-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors text-sm shadow-sm"
                >
                    Submit to IT
                </button>
            </div>
        </div>
    );
};
