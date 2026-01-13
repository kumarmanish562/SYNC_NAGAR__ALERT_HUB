import React from 'react';

export default function Hero() {
    return (
        <section id="home" className="relative flex flex-col items-center justify-center pt-20 pb-32 px-4 text-center overflow-hidden bg-gradient-to-br from-blue-50/50 via-white to-orange-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 transition-colors duration-300">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-3xl -z-10 opacity-60"></div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full shadow-sm mb-8 animate-fade-in-up">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">National Civic Tech Initiative</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl font-black text-[#0f172a] dark:text-white tracking-tight mb-6 max-w-5xl leading-[1.1]">
                Empowering Citizens,<br />
                <span className="text-[#1a36ca] dark:text-blue-400">Transforming Cities</span>
            </h1>

            {/* Subheading */}
            <h2 className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 font-medium mb-4">
                Real-Time, Verified City Alerts on WhatsApp
            </h2>

            <p className="max-w-2xl text-gray-500 dark:text-gray-400 mb-10 leading-relaxed">
                India's first WhatsApp-based civic intelligence platform connecting citizens, authorities, and communities for faster incident reporting and resolution.
            </p>

            {/* CTA Buttons (Hidden in screenshot somewhat, but standard practice) */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Placeholder for potential cards visible at bottom of screenshot */}
            </div>

            {/* Card Placeholders to match the cut-off bottom of image */}
            <div className="absolute -bottom-24 w-full flex justify-center gap-6 px-4 opacity-40 blur-[1px]">
                <div className="w-64 h-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700"></div>
                <div className="w-64 h-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 mt-8"></div>
                <div className="w-64 h-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700"></div>
                <div className="w-64 h-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 mt-8"></div>
            </div>
        </section>
    );
}
