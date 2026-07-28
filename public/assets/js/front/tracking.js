const { createApp, ref, onMounted, computed, onUnmounted } = Vue;

const app = createApp({
    setup() {
        const sharedCust = window.createSharedCustomer();
        
        const loading = ref(true);
        const error = ref(null);
        const orderId = ref(null);
        const pollInterval = ref(null);
        
        // Modal de Reseña
        const showReviewModal = ref(false);
        const submittingReview = ref(false);
        const businessInfo = ref({ name: '', slug: '' });
        const newReview = ref({
            customerName: sharedCust.customer.value ? sharedCust.customer.value.name : '',
            rating: 5,
            comment: ''
        });

        const fetchBusinessInfo = async (businessId) => {
            try {
                const res = await fetch(`/api/public/business-slug/${businessId}`);
                const data = await res.json();
                if (data.slug) {
                    businessInfo.value = { slug: data.slug, name: data.name };
                }
            } catch (e) {
                console.error('Error fetching business info:', e);
            }
        };

        const triggerReviewModal = async () => {
            if (order.value && order.value.businessId) {
                await fetchBusinessInfo(order.value.businessId);
                showReviewModal.value = true;
            }
        };

        const submitReview = async () => {
            if (!newReview.value.comment || !newReview.value.customerName) {
                return toastr.warning('Completa tu nombre y comentario.');
            }
            if (!businessInfo.value.slug) {
                return toastr.error('No se pudo determinar el negocio.');
            }
            submittingReview.value = true;
            try {
                const res = await fetch('/api/public/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug: businessInfo.value.slug, ...newReview.value })
                });

                if (res.ok) {
                    toastr.success('Pedido entregado. ¡Gracias por tu reseña!');
                    setTimeout(() => {
                        window.location.href = '/profile';
                    }, 1500);
                } else {
                    const err = await res.json();
                    toastr.error(err.message || 'Hubo un error al enviar tu reseña.');
                }
            } catch (e) {
                toastr.error('Error de conexión.');
            } finally {
                submittingReview.value = false;
            }
        };

        const skipReview = () => {
            showReviewModal.value = false;
            window.location.href = '/profile';
        };
        
        // El pedido actual basado en el orderId extraído
        const order = computed(() => {
            if (!sharedCust.orders.value || !orderId.value) return null;
            return sharedCust.orders.value.find(o => o._id === orderId.value);
        });

        // Configurar título del estado actual
        const currentStatusTitle = computed(() => {
            if (!order.value) return '';
            switch (order.value.status) {
                case 'pending': return 'Recibido, esperando confirmación';
                case 'preparing': return 'Tu pedido se está preparando';
                case 'ready': return '¡Tu pedido está en camino!';
                case 'completed': return 'Pedido Entregado';
                case 'cancelled': return 'Pedido Cancelado';
                default: return 'Estado desconocido';
            }
        });

        // Descripción secundaria
        const currentStatusDescription = computed(() => {
            if (!order.value) return '';
            switch (order.value.status) {
                case 'pending': return 'El restaurante revisará tu pedido en breve.';
                case 'preparing': return 'El chef está trabajando en tu orden.';
                case 'ready': return 'El repartidor va de camino a tu ubicación.';
                case 'completed': return '¡Esperamos que lo disfrutes!';
                case 'cancelled': return 'Contacta al soporte para más información.';
                default: return '';
            }
        });

        // Índice para la línea de tiempo (1 a 4)
        const stepIndex = computed(() => {
            if (!order.value) return 0;
            switch (order.value.status) {
                case 'pending': return 1;
                case 'preparing': return 2;
                case 'ready': return 3;
                case 'completed': return 4;
                default: return 0;
            }
        });

        // Calcular ancho de la barra de progreso (Timeline)
        const progressWidth = computed(() => {
            if (!order.value) return '0%';
            if (order.value.status === 'cancelled') return '0%';
            switch (order.value.status) {
                case 'pending': return '0%';       // Apenas empieza
                case 'preparing': return '33%';    // 1/3
                case 'ready': return '66%';        // 2/3
                case 'completed': return '100%';   // Completo
                default: return '0%';
            }
        });

        // Mensaje simulado de tiempo estimado
        const estimatedTimeMsg = computed(() => {
            if (!order.value) return '-- min';
            if (order.value.status === 'pending') return 'Calculando...';
            if (order.value.status === 'preparing') return '15 - 20 min';
            if (order.value.status === 'ready') return '5 - 10 min';
            return 'Entregado';
        });

        const initTracking = async () => {
            // Leer el ID de la URL
            const urlParams = new URLSearchParams(window.location.search);
            const id = urlParams.get('orderId');
            
            if (!id) {
                error.value = "URL inválida. No se especificó número de pedido.";
                loading.value = false;
                return;
            }
            orderId.value = id;

            try {
                // Forzar una descarga de órdenes para asegurar que tenemos la más reciente
                await sharedCust.fetchOrders();
                
                if (!order.value) {
                    error.value = "No se encontró el pedido o no tienes permisos para verlo.";
                } else if (order.value.status === 'completed') {
                    // Mostrar modal si ya está completado
                    setTimeout(triggerReviewModal, 1000);
                }
            } catch (err) {
                error.value = "Ocurrió un error al cargar el pedido.";
                console.error(err);
            } finally {
                loading.value = false;
            }
        };

        const startPolling = () => {
            pollInterval.value = setInterval(async () => {
                if (order.value && (order.value.status === 'completed' || order.value.status === 'cancelled')) {
                    clearInterval(pollInterval.value);
                    return;
                }
                await sharedCust.fetchOrders();
                if (order.value && order.value.status === 'completed') {
                    clearInterval(pollInterval.value);
                    triggerReviewModal();
                }
            }, 5000); // Poll cada 5 segundos
        };

        onMounted(() => {
            if (!sharedCust.token.value) {
                // Si no está logueado, mandarlo al index
                window.location.href = '/';
                return;
            }
            initTracking().then(() => {
                if (!error.value) {
                    startPolling();
                }
            });
        });

        onUnmounted(() => {
            if (pollInterval.value) {
                clearInterval(pollInterval.value);
            }
        });

        return {
            sharedCust,
            loading,
            error,
            order,
            currentStatusTitle,
            currentStatusDescription,
            stepIndex,
            progressWidth,
            estimatedTimeMsg,
            showReviewModal,
            submittingReview,
            businessInfo,
            newReview,
            submitReview,
            skipReview
        };
    }
});

app.mount('#app');
