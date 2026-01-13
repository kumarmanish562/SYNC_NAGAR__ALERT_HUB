import React from 'react';

export default function About() {
    return (
        <section id="about" className="py-24 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="max-w-4xl mx-auto px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-8">Empowering Communities, One Alert at a Time</h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-12">
                    Nagar Alert Hub is born from a simple idea: that every citizen should have the power to improve their city. By leveraging the ubiquity of WhatsApp and the power of AI, we're removing the friction from civic engagement. We partner with local municipal bodies to ensure that your voice isn't just heard—it's acted upon.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-slate-100 dark:border-slate-800 pt-12">
                    <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">50k+</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Citizens Active</div>
                    </div>
                    <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">12k</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Issues Resolved</div>
                    </div>
                    <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">24h</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Avg. Response</div>
                    </div>
                    <div>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">15+</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">Cities Covered</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
