import React, { useEffect, useRef } from 'react';

const SurvivalChart = ({ data }) => {
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current) return;

        // Destroy previous instance
        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const ctx = canvasRef.current.getContext('2d');

        // Simple Chart.js Config
        chartRef.current = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Resolved', 'Pending', 'In Progress'],
                datasets: [{
                    label: 'Impact Stats',
                    data: data || [12, 19, 3],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 10 }
                        }
                    }
                }
            }
        });

        // Cleanup
        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [data]);

    return (
        <div className="w-full h-full relative">
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

export default SurvivalChart;
