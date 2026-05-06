const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // Модуль для работы с файлами

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 
});

const WIDTH = 1000;
const HEIGHT = 1000;
const FILE_PATH = path.join(__dirname, 'canvas_data.bin'); // Имя файла хранилища

// 1. Пытаемся загрузить данные из файла, если он есть
let canvasData;
if (fs.existsSync(FILE_PATH)) {
    console.log('Загружаем холст из файла...');
    canvasData = fs.readFileSync(FILE_PATH);
} else {
    console.log('Создаем новый чистый холст...');
    canvasData = Buffer.alloc(WIDTH * HEIGHT * 3, 255); // Белый фон
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.emit('init', canvasData);

    socket.on('pixel', (data) => {
        const { index, r, g, b } = data;

        if (index >= 0 && index < WIDTH * HEIGHT) {
            const offset = index * 3;
            canvasData[offset] = r;
            canvasData[offset + 1] = g;
            canvasData[offset + 2] = b;

            io.emit('update', { index, r, g, b });
            
            // Сохраняем в файл (можно делать это не при каждом клике, а по таймеру)
            // Но для небольшого количества игроков можно и сразу
            saveToFile();
        }
    });
});

// Функция для сохранения данных на диск
function saveToFile() {
    try {
        fs.writeFileSync(FILE_PATH, canvasData);
    } catch (err) {
        console.error('Ошибка при сохранении файла:', err);
    }
}

// Периодическое сохранение (на всякий случай) — раз в 1 минуту
setInterval(saveToFile, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер с хранилищем запущен на порту ${PORT}`);
});
