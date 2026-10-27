FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train model on container startup if not already trained
RUN python train_model.py

EXPOSE 5001
CMD ["python", "app.py"]
