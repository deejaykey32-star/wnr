FROM python:3.10-slim

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

# Copy backend Python scripts
COPY server.py .
COPY pipeline.py .
COPY generate_media.py .
COPY assemble_video.py .

# Create output folder
RUN mkdir -p output && chmod 777 output

# Expose default Hugging Face Spaces port
EXPOSE 7860

# Run Python server
CMD ["python", "server.py"]
