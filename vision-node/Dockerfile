FROM python:3.11-slim

# Evitar prompts interactivos y buffers en logs
ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Instalar dependencias de sistema para OpenCV y video sin GUI
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-descargar el modelo YOLO11-pose en la imagen para inicio instantáneo
RUN python -c "from ultralytics import YOLO; YOLO('yolo11n-pose.pt')"

# Copiar el código del nodo de visión y configuración
COPY . .

# Puertos: 8765 (WebSocket telemetría), 8766 (Stream HTTP MJPEG)
EXPOSE 8765 8766

CMD ["python", "-m", "vision_node.main", "--no-gui"]
