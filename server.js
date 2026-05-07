const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

const WIDTH = 1000;
const HEIGHT = 1000;
const FILE_PATH = path.join(__dirname, 'canvas_data.bin');

let canvasData;
if (fs.existsSync(FILE_PATH)) {
    canvasData = fs.readFileSync(FILE_PATH);
} else {
    canvasData = Buffer.alloc(WIDTH * HEIGHT * 3, 255);
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.emit('init', canvasData);

    // Обработка одного пикселя (старая логика)
    socket.on('pixel', (data) => {
        handlePixel(data);
        io.emit('update', data);
    });

    // Обработка ПАКЕТА пикселей (для разлома и кисти)
    socket.on('pixels_batch', (batch) => {
        batch.forEach(p => handlePixel(p));
        io.emit('update_batch', batch); // Рассылаем всем сразу пачкой
    });
});

function handlePixel({ index, r, g, b }) {
    if (index >= 0 && index < WIDTH * HEIGHT) {
        const offset = index * 3;
        canvasData[offset] = r;
        canvasData[offset + 1] = g;
        canvasData[offset + 2] = b;
    }
}

function saveToFile() {
    try { fs.writeFileSync(FILE_PATH, canvasData); } catch (e) {}
}
setInterval(saveToFile, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server: ${PORT}`));
