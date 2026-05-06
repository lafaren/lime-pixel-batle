const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // Увеличиваем лимит данных для передачи большого холста
});

const WIDTH = 1000;
const HEIGHT = 1000;
// Создаем массив на 1 миллион пикселей. Изначально все белые.
let canvasData = Buffer.alloc(WIDTH * HEIGHT * 3, 255); // Используем Buffer для экономии памяти (RGB)

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Игрок вошел');

    // Отправляем текущее состояние холста
    socket.emit('init', canvasData);

    socket.on('pixel', (data) => {
        const { index, r, g, b } = data;

        if (index >= 0 && index < WIDTH * HEIGHT) {
            const offset = index * 3;
            canvasData[offset] = r;
            canvasData[offset + 1] = g;
            canvasData[offset + 2] = b;

            // Рассылаем всем только изменения
            io.emit('update', { index, r, g, b });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
});
