import { ref, nextTick } from 'vue';
import { authFetch } from './api.js';

// Variable global para la instancia del gráfico
let chartInstance = null;

export function useAnalytics() {
    const kpis = ref([
        { label: 'Ventas Hoy', value: '$0', icon: 'fa-solid fa-dollar-sign', colorBg: 'bg-emerald-100', colorText: 'text-emerald-600' },
        { label: 'Pedidos Hoy', value: '0', icon: 'fa-solid fa-receipt', colorBg: 'bg-blue-100', colorText: 'text-blue-600' },
        { label: 'Visitas Hoy', value: '0', icon: 'fa-solid fa-eye', colorBg: 'bg-orange-100', colorText: 'text-orange-600' },
        { label: 'Clientes Totales', value: '0', icon: 'fa-solid fa-users', colorBg: 'bg-purple-100', colorText: 'text-purple-600' },
    ]);

    const topProducts = ref([]);
    const chartConfig = ref({ labels: [], data: [] });

    // Función independiente para renderizar
    const renderChart = async () => {
        // 1. Esperamos al ciclo de actualización de Vue
        await nextTick();
        // 2. Esperamos un poco más para asegurar que el v-if terminó de pintar el canvas
        setTimeout(() => {
            const ctx = document.getElementById('salesChart');
            
            // Si el usuario cambió de vista rápido y ya no está el canvas, no hacemos nada
            if (!ctx) return;

            // Destruir instancia previa para evitar "glitches" visuales o superposiciones
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            // Crear nueva instancia
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartConfig.value.labels,
                    datasets: [{
                        label: 'Ventas ($)',
                        data: chartConfig.value.data,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#6366f1',
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: '#1e293b',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 10,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9', drawBorder: false },
                            ticks: { font: { family: "'Outfit', sans-serif" } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: "'Outfit', sans-serif" } }
                        }
                    }
                }
            });
        }, 100); // 100ms de seguridad es imperceptible para el ojo pero vital para el DOM
    };

    const fetchDashboardStats = async () => {
        try {
            const res = await authFetch('/api/analytics/dashboard');
            if (res.ok) {
                const data = await res.json();
                
                kpis.value = [
                    { label: 'Ventas Hoy', value: `$${data.salesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, icon: 'fa-solid fa-dollar-sign', colorBg: 'bg-emerald-100', colorText: 'text-emerald-600' },
                    { label: 'Pedidos Hoy', value: data.ordersTodayCount.toString(), icon: 'fa-solid fa-receipt', colorBg: 'bg-blue-100', colorText: 'text-blue-600' },
                    { label: 'Visitas Hoy', value: data.visitsToday.toString(), icon: 'fa-solid fa-eye', colorBg: 'bg-orange-100', colorText: 'text-orange-600' },
                    { label: 'Clientes Únicos', value: data.uniqueUsers.toString(), icon: 'fa-solid fa-users', colorBg: 'bg-purple-100', colorText: 'text-purple-600' },
                ];

                topProducts.value = data.topProducts;
                chartConfig.value = data.chart;
                
                // Llamamos a la función de renderizado
                renderChart();
            }
        } catch (e) {
            console.error("Error cargando analíticas", e);
        }
    };

    return {
        kpis,
        topProducts,
        fetchDashboardStats,
        renderChart // Exportamos renderChart por si necesitamos forzar el repintado manualmente
    };
}