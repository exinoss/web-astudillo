# Se incluye en cada location: un add_header dentro de un location anula los del bloque server.
# HSTS lo pone Cloudflare. CSP mínima: no limita scripts, estilos ni imágenes; la completa queda
# pendiente de probarla con Google, el visor 3D y Lottie.
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" always;
