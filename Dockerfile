FROM python:3.10-slim

# Force Python stdout/stderr unbuffered mode
ENV PYTHONUNBUFFERED=1

# Install FFmpeg and system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-dejavu-core \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend Python scripts and audio sample
COPY analyze.py .
COPY server.py .
COPY pipeline.py .
COPY generate_media.py .
COPY assemble_video.py .
COPY VID-20260727-WA0000.mp3 .

# Create output folder
RUN mkdir -p output && chmod 777 output

# Expose default port
EXPOSE 7860

# Run Python server unbuffered
CMD ["python", "-u", "server.py"]
