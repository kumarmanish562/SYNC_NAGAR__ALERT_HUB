import React from 'react';

export default function Features() {
    const features = [
        {
            title: "Instant Reporting",
            description: "Report civic issues directly through WhatsApp. No app download required - just send a hi.",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            )
        },
        {
            title: "AI Analysis",
            description: "Smart categorization and duplication checks ensure authorities focus on real problems, not noise.",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                    <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10Zm0 14a1 1 0 1 1 1-1 1 1 0 0 1-1 1Zm1-4a1 1 0 0 1-2 0V8a1 1 0 0 1 2 0Z"></path>
                </svg>
            )
        },
        {
            title: "Real-time Updates",
            description: "Get instant notifications on the status of your reported issues right in your chat window.",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            )
        }
    ];

    return (
        <section id="features" className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">Why Nagar Alert Hub?</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Bridging the gap between citizens and administration with technology that works for everyone.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <div key={index} className="p-8 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm group">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-50 dark:group-hover:bg-slate-600 transition-colors">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
