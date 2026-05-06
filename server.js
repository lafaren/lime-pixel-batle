const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Настройки поля
const WIDTH = 100; 
const HEIGHT = 100;
// (белый цвет)
let canvasData = Array(WIDTH * HEIGHT).fill('#FFFFFF');

//  файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Новый игрок подключился:', socket.id);

  
    socket.emit('init', canvasData);

    //пиксель
    socket.on('pixel', (data) => {
        const { index, color } = data;

        // Проверка
        if (index >= 0 && index < canvasData.length && /^#[0-9A-F]{6}$/i.test(color)) {
            canvasData[index] = color;
            // Рассылаем это изменение всем остальным
            io.emit('update', { index, color });
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился');
    });
});

// Порт для хостинга
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
