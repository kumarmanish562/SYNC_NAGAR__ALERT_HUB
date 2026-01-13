import React from 'react';

export default function WhatsAppIntegration() {
    return (
        <section id="whatsapp" className="py-24 bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex flex-col md:flex-row items-center gap-16">

                    {/* Text Content */}
                    <div className="flex-1 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 rounded-full text-green-700 dark:text-green-400 text-sm font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            WhatsApp First Solution
                        </div>

                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                            Reporting issues is now as easy as <span className="text-[#25D366]">chatting with a friend.</span>
                        </h2>

                        <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                            No new apps to install. Our AI-powered WhatsApp bot guides you through reporting potholes, garbage dumps, or street light failures in less than 30 seconds.
                        </p>

                        <ul className="space-y-4">
                            {[
                                "Send 'Hi' to start reporting",
                                "Share location and photo instantly",
                                "Get a unique tracking ID"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">✓</div>
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <button className="bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/30 flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            Try Demo on WhatsApp
                        </button>
                    </div>

                    {/* Mockup */}
                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-green-200/40 to-blue-200/40 blur-3xl rounded-full -z-10 w-[120%] h-[120%] -left-[10%]"></div>

                        {/* Phone Frame */}
                        <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-2xl flex flex-col overflow-hidden">
                            <div className="h-[32px] w-[3px] bg-gray-800 absolute -left-[17px] top-[72px] rounded-l-lg"></div>
                            <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                            <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>

                            {/* Screen Content */}
                            <div className="flex-1 bg-[#ECE5DD] overflow-hidden flex flex-col relative px-4 pt-12 pb-4">
                                {/* Chat Header */}
                                <div className="absolute top-0 left-0 w-full bg-[#075E54] h-16 flex items-center px-4 gap-3 text-white z-10">
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">NH</div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Nagar Helper</div>
                                        <div className="text-[10px] opacity-80">Online</div>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex flex-col gap-4 mt-8 text-[13px]">
                                    {/* Bot */}
                                    <div className="self-start bg-white p-3 rounded-tr-lg rounded-bl-lg rounded-br-lg shadow-sm max-w-[85%]">
                                        Hello! 👋 Welcome to Nagar Alert Hub. How can I help you today?
                                        <div className="text-[10px] text-gray-400 text-right mt-1">10:00 AM</div>
                                    </div>

                                    {/* User */}
                                    <div className="self-end bg-[#DCF8C6] p-3 rounded-tl-lg rounded-bl-lg rounded-br-lg shadow-sm max-w-[85%]">
                                        Found a broken streetlight on Main Road.
                                        <div className="text-[10px] text-gray-500 text-right mt-1">10:01 AM</div>
                                    </div>

                                    {/* Bot */}
                                    <div className="self-start bg-white p-3 rounded-tr-lg rounded-bl-lg rounded-br-lg shadow-sm max-w-[85%]">
                                        Thanks for reporting. Please share a photo or location for verification. 📸📍
                                        <div className="text-[10px] text-gray-400 text-right mt-1">10:01 AM</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
