# ── Stage 1: Build the Spring Boot JAR ──────────────────────────
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# ── Stage 2: Runtime with MongoDB bundled inside ─────────────────
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Install MongoDB 7
RUN apt-get update && apt-get install -y gnupg curl && \
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
        | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
        https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && apt-get install -y mongodb-org && \
    rm -rf /var/lib/apt/lists/*

# Copy JAR and startup script
COPY --from=builder /app/target/*.jar app.jar
COPY start.sh .
RUN chmod +x start.sh

# Create required directories
RUN mkdir -p /data/db /app/uploads

EXPOSE 8080
CMD ["./start.sh"]
