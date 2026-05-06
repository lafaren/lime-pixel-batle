const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');

const SIZE = 100; // Размер должен совпадать с серверным
const SCALE = 8;  // Размер одного пикселя на экране

canvas.width = SIZE * SCALE;
canvas.height = SIZE * SCALE;

// Рисуем один пиксель
function drawPixel(index, color) {
    const x = (index % SIZE) * SCALE;
    const y = Math.floor(index / SIZE) * SCALE;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, SCALE, SCALE);
}

// Получаем всё поле при входе
socket.on('init', (data) => {
    data.forEach((color, index) => {
        drawPixel(index, color);
    });
});

// Получаем обновления от других
socket.on('update', ({ index, color }) => {
    drawPixel(index, color);
});

// Клик по холсту
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / SIZE));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / SIZE));
    
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        const index = y * SIZE + x;
        const color = colorPicker.value;
        
        // Оптимистичное рисование (сразу у себя)
        drawPixel(index, color);
        // Отправка на сервер
        socket.emit('pixel', { index, color });
    }
});
