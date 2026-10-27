#!/bin/bash
set -e

echo "Starting MongoDB..."
mkdir -p /data/db
mongod --dbpath /data/db --bind_ip 127.0.0.1 --fork --logpath /var/log/mongod.log

echo "Waiting for MongoDB to be ready..."
until mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null; do
  sleep 1
done

echo "MongoDB is ready. Starting Spring Boot..."
exec java -jar /app/app.jar
