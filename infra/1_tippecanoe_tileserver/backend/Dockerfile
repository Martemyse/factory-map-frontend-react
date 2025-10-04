FROM node:18-bookworm

# Install build tools + OpenGL/Mesa + image libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    unzip \
    ca-certificates \
    # Mesa software OpenGL stack
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    libglu1-mesa \
    libegl1 \
    libgles2 \
    libopengl0 \
    libgbm1 \
    # image/font/text libraries
    libjpeg62-turbo \
    libjpeg-dev \
    libpng16-16 \
    libwebp7 \
    libtiff6 \
    libgif7 \
    libfreetype6 \
    libharfbuzz0b \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libicu72 \
    libuv1 \
    && rm -rf /var/lib/apt/lists/*


# Build Tippecanoe
RUN git clone https://github.com/mapbox/tippecanoe.git /tippecanoe \
    && cd /tippecanoe \
    && make -j \
    && make install

# Install tileserver-gl globally
RUN npm install -g tileserver-gl

# Install additional libjpeg packages and create symlinks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg8-dev \
    libjpeg-turbo8-dev \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for libjpeg compatibility
RUN ln -sf /usr/lib/x86_64-linux-gnu/libjpeg.so.62 /usr/lib/x86_64-linux-gnu/libjpeg.so.8 || true
RUN ln -sf /usr/lib/x86_64-linux-gnu/libjpeg.so.62 /usr/lib/libjpeg.so.8 || true

WORKDIR /data

# Default entrypoint = bash so you can debug
CMD ["/bin/bash"]
